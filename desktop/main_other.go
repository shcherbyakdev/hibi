//go:build !darwin

package main

import "log"

// hibi for Mac is macOS-only for now; the sync service itself runs
// anywhere via cmd/hibi-sync.
func main() { log.Fatal("hibi desktop runs on macOS only") }
