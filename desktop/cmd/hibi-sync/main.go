// Command hibi-sync runs the desktop sync service on its own, for the
// TypeScript contract tests and CI (the app embeds the same package).
package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	"github.com/shcherbyakdev/hibi/desktop/syncsvc"
)

func main() {
	port := flag.Int("port", 0, "loopback port (0 = any free port)")
	dbPath := flag.String("db", "hibi.sqlite", "SQLite file")
	ui := flag.String("ui", "", "directory with the web UI export (optional)")
	flag.Parse()

	store, err := syncsvc.Open(*dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		log.Fatal(err)
	}
	opts := syncsvc.Options{Port: ln.Addr().(*net.TCPAddr).Port}
	if *ui != "" {
		opts.UI = os.DirFS(*ui)
	}
	fmt.Printf("listening on 127.0.0.1:%d\n", opts.Port)
	log.Fatal(http.Serve(ln, syncsvc.Handler(store, opts)))
}
