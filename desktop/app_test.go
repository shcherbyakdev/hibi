package main

import (
	"net"
	"path/filepath"
	"strings"
	"testing"
)

func TestDataDirIsInApplicationSupport(t *testing.T) {
	dir, err := dataDir()
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(dir) != bundleID {
		t.Fatalf("data dir %q must end in %q", dir, bundleID)
	}
}

func TestListenExplainsABusyPort(t *testing.T) {
	taken, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer taken.Close()
	_, err = listen(taken.Addr().(*net.TCPAddr).Port)
	if err == nil || !strings.Contains(err.Error(), "already running") {
		t.Fatalf("want a friendly 'already running' error, got %v", err)
	}
}

func TestListenBindsLoopbackOnly(t *testing.T) {
	ln, err := listen(0)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	if ip := ln.Addr().(*net.TCPAddr).IP; !ip.IsLoopback() {
		t.Fatalf("must bind loopback only, bound %v", ip)
	}
}

func TestBundlePath(t *testing.T) {
	for exe, want := range map[string]string{
		"/Applications/hibi.app/Contents/MacOS/hibi": "/Applications/hibi.app",
		"/tmp/go-build123/exe/hibi":                  "",
		"/Applications/hibi.app/Contents/hibi":       "",
	} {
		got, ok := bundlePath(exe)
		if got != want || ok != (want != "") {
			t.Fatalf("%s: want %q, got %q %v", exe, want, got, ok)
		}
	}
}
