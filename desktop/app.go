// Package main is hibi for Mac: a Wails window on the built-in sync
// service (syncsvc), which serves the web UI and stores everything in one
// SQLite file under Application Support. The window code is macOS-only
// (main_darwin.go); these helpers build and test anywhere.
package main

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
)

const (
	bundleID = "app.hibi.desktop"
	// Port is fixed: the web UI's IndexedDB copy is per origin, so the
	// origin must not change between launches.
	Port = 47321
)

// version is set at release build time (-ldflags "-X main.version=x.y.z").
// "dev" never offers updates.
var version = "dev"

// bundlePath turns .../hibi.app/Contents/MacOS/hibi into .../hibi.app; ok
// is false when not running from a bundle (wails dev, go run).
func bundlePath(exe string) (string, bool) {
	app := filepath.Dir(filepath.Dir(filepath.Dir(exe)))
	if !strings.HasSuffix(app, ".app") || filepath.Join(app, "Contents", "MacOS", filepath.Base(exe)) != exe {
		return "", false
	}
	return app, true
}

// dataDir is ~/Library/Application Support/app.hibi.desktop on macOS —
// outside the .app bundle, so updates and reinstalls never touch it.
func dataDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, bundleID), nil
}

// listen binds the sync service to loopback only.
func listen(port int) (net.Listener, error) {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return nil, fmt.Errorf("hibi is already running, or port %d is in use by another app", port)
	}
	return ln, nil
}
