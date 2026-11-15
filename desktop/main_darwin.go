//go:build darwin

package main

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/shcherbyakdev/hibi/desktop/syncsvc"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// The Next.js desktop export (npm run desktop:build copies out/ here).
//
//go:embed all:ui
var uiFiles embed.FS

// Wails' own start page: a redirect to the sync service, so the window's
// origin is http://127.0.0.1:<Port> — the same origin phones will use.
//
//go:embed all:frontend/dist
var shellFiles embed.FS

type app struct {
	ctx    context.Context
	store  *syncsvc.Store
	server *http.Server
	stop   context.CancelFunc // ends live SSE streams so Shutdown doesn't wait them out
}

func main() {
	a := &app{}
	err := wails.Run(&options.App{
		Title:       "hibi",
		Width:       1280,
		Height:      820,
		MinWidth:    420,
		MinHeight:   480,
		AssetServer: &assetserver.Options{Assets: shellFiles},
		Menu:        menu.NewMenuFromItems(menu.AppMenu(), menu.EditMenu(), menu.WindowMenu()),
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: bundleID,
			// Wails only calls this; bringing the window forward is ours.
			OnSecondInstanceLaunch: func(options.SecondInstanceData) {
				if a.ctx != nil {
					runtime.WindowUnminimise(a.ctx)
					runtime.Show(a.ctx)
				}
			},
		},
		OnStartup:  a.startup,
		OnShutdown: a.shutdown,
		Mac:        &mac.Options{About: &mac.AboutInfo{Title: "hibi", Message: "Plan your day, week and month."}},
	})
	if err != nil {
		log.Fatal(err)
	}
}

// startup runs before the start page loads: open the store and start
// serving, so the redirect lands on a live server.
func (a *app) startup(ctx context.Context) {
	a.ctx = ctx
	fail := func(err error) {
		_, _ = runtime.MessageDialog(ctx, runtime.MessageDialogOptions{Type: runtime.ErrorDialog, Title: "hibi can't start", Message: err.Error()})
		runtime.Quit(ctx)
	}
	dir, err := dataDir()
	if err == nil {
		err = os.MkdirAll(dir, 0o700)
	}
	if err != nil {
		fail(fmt.Errorf("can't create the data folder: %w", err))
		return
	}
	if a.store, err = syncsvc.Open(filepath.Join(dir, "hibi.sqlite")); err != nil {
		fail(fmt.Errorf("can't open your data: %w", err))
		return
	}
	ln, err := listen(Port)
	if err != nil {
		fail(err)
		return
	}
	ui, _ := fs.Sub(uiFiles, "ui")
	base, stop := context.WithCancel(context.Background())
	a.stop = stop
	a.server = &http.Server{
		Handler:           syncsvc.Handler(a.store, syncsvc.Options{Port: Port, UI: ui}),
		ReadHeaderTimeout: 10 * time.Second,
		BaseContext:       func(net.Listener) context.Context { return base },
	}
	go func() {
		if err := a.server.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("[hibi] server: %v", err)
		}
	}()
}

func (a *app) shutdown(ctx context.Context) {
	if a.server != nil {
		a.stop()
		c, cancel := context.WithTimeout(ctx, 3*time.Second)
		defer cancel()
		_ = a.server.Shutdown(c)
	}
	if a.store != nil {
		_ = a.store.Close()
	}
}
