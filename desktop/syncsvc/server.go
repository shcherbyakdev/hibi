package syncsvc

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Options configures the HTTP handler.
type Options struct {
	Port int   // the loopback port it's served on (for the Host/Origin guards)
	UI   fs.FS // the static web UI (Next.js desktop export); nil = none
	// Token, when set, is required on every request as the hibi_token
	// cookie, which GET /auth?t=<token> hands out. The app always sets one;
	// "" (no check) is for the dev binary and tests only.
	Token string
}

// Handler serves the sync API (the HTTP mirror of SyncTransport in
// src/lib/sync/transport.ts), prefs, change hints (SSE) and the web UI.
//
// Loopback isn't private: any page in the user's browser can send requests
// to 127.0.0.1. Every request therefore passes three guards: Host must be
// our own (defeats DNS rebinding), a present Origin must be our own, and
// writes must be application/json (forces a CORS preflight, which we never
// answer). Loopback isn't per-user either: other accounts on the Mac can
// reach it, so the app also requires a per-launch token (Options.Token).
// Project 3 adds device tokens before anything listens beyond
// loopback.
func Handler(store *Store, opts Options) http.Handler {
	hub := &hub{subs: map[chan struct{}]struct{}{}}
	store.OnChange(hub.broadcast)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /sync/{table}", func(w http.ResponseWriter, r *http.Request) {
		var rows []Row
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<20)).Decode(&rows); err != nil {
			writeJSON(w, http.StatusConflict, refuse("22P02", "body: %v", err))
			return
		}
		rerr, err := store.Upsert(r.PathValue("table"), rows)
		switch {
		case errors.Is(err, ErrUnknownTable):
			http.NotFound(w, r)
		case err != nil:
			serverError(w, err)
		case rerr != nil:
			writeJSON(w, http.StatusConflict, rerr)
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	})
	mux.HandleFunc("GET /sync/events", hub.serve)
	mux.HandleFunc("GET /sync/{table}/{id}", func(w http.ResponseWriter, r *http.Request) {
		row, ok, err := store.Get(r.PathValue("table"), r.PathValue("id"))
		switch {
		case errors.Is(err, ErrUnknownTable), err == nil && !ok:
			http.NotFound(w, r)
		case err != nil:
			serverError(w, err)
		default:
			writeJSON(w, http.StatusOK, row)
		}
	})
	mux.HandleFunc("GET /sync/{table}", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		limit, _ := strconv.Atoi(q.Get("limit"))
		if limit <= 0 || limit > 1000 {
			limit = 500
		}
		var since *time.Time
		var after *Keyset
		if s := q.Get("since"); s != "" {
			t, err := time.Parse(time.RFC3339Nano, s)
			if err != nil {
				http.Error(w, "bad since", http.StatusBadRequest)
				return
			}
			since = &t
		} else if s := q.Get("after_synced_at"); s != "" {
			t, err := time.Parse(time.RFC3339Nano, s)
			if err != nil || q.Get("after_id") == "" {
				http.Error(w, "bad keyset", http.StatusBadRequest)
				return
			}
			after = &Keyset{SyncedAt: t, ID: q.Get("after_id")}
		}
		rows, err := store.Pull(r.PathValue("table"), since, after, limit)
		switch {
		case errors.Is(err, ErrUnknownTable):
			http.NotFound(w, r)
		case err != nil:
			serverError(w, err)
		default:
			writeJSON(w, http.StatusOK, rows)
		}
	})
	mux.HandleFunc("GET /prefs", func(w http.ResponseWriter, r *http.Request) {
		p, err := store.Prefs()
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, p)
	})
	mux.HandleFunc("PUT /prefs", func(w http.ResponseWriter, r *http.Request) {
		var p Row
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&p); err != nil {
			http.Error(w, "bad body", http.StatusBadRequest)
			return
		}
		if err := store.PutPrefs(p); err != nil {
			var rerr *RowError
			if errors.As(err, &rerr) {
				writeJSON(w, http.StatusConflict, rerr)
				return
			}
			serverError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	if opts.UI != nil {
		mux.Handle("GET /", uiHandler(opts.UI))
	}
	return guard(opts.Port, opts.Token, mux)
}

func guard(port int, token string, next http.Handler) http.Handler {
	hosts := map[string]bool{fmt.Sprintf("127.0.0.1:%d", port): true, fmt.Sprintf("localhost:%d", port): true}
	origins := map[string]bool{fmt.Sprintf("http://127.0.0.1:%d", port): true, fmt.Sprintf("http://localhost:%d", port): true}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !hosts[r.Host] {
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		if o := r.Header.Get("Origin"); o != "" && !origins[o] {
			http.Error(w, "forbidden origin", http.StatusForbidden)
			return
		}
		if r.Method == http.MethodPost || r.Method == http.MethodPut {
			if mt, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type")); mt != "application/json" {
				http.Error(w, "application/json required", http.StatusUnsupportedMediaType)
				return
			}
		}
		if token != "" {
			if r.URL.Path == "/auth" {
				if !sameSecret(r.URL.Query().Get("t"), token) {
					http.Error(w, "forbidden", http.StatusForbidden)
					return
				}
				http.SetCookie(w, &http.Cookie{Name: tokenCookie, Value: token, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode})
				// A same-origin hop, not a 303: a redirect still counts as the
				// wails:// start page's cross-site navigation, and WebKit
				// wouldn't send the Strict cookie with it.
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.Header().Set("Cache-Control", "no-store")
				_, _ = io.WriteString(w, `<!doctype html><meta charset="utf-8"><title>hibi</title><script>location.replace("/plan/day")</script>`)
				return
			}
			if c, err := r.Cookie(tokenCookie); err != nil || !sameSecret(c.Value, token) {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

const tokenCookie = "hibi_token"

func sameSecret(got, want string) bool {
	return subtle.ConstantTimeCompare([]byte(got), []byte(want)) == 1
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func serverError(w http.ResponseWriter, err error) {
	log.Printf("[sync] %v", err)
	http.Error(w, "server error", http.StatusInternalServerError)
}

// goalRoute matches /goals/<id>, its RSC payload (/goals/<id>.txt) and its
// segment files (/goals/<id>/__next.*.txt): the export has one placeholder
// page, goals/_ (+ goals/_/…), whose client reads the real id from
// usePathname() (spike, 2026-11-15).
var goalRoute = regexp.MustCompile(`^/goals/[^/]+?(\.txt|\.html|/.+)?$`)

func uiHandler(ui fs.FS) http.Handler {
	exists := func(p string) bool {
		st, err := fs.Stat(ui, strings.TrimPrefix(p, "/"))
		return err == nil && !st.IsDir()
	}
	// ServeContent, not FileServer: FileServer redirects */index.html to */.
	serve := func(w http.ResponseWriter, r *http.Request, p string) {
		body, err := fs.ReadFile(ui, strings.TrimPrefix(p, "/"))
		if err != nil {
			http.NotFound(w, r)
			return
		}
		http.ServeContent(w, r, path.Base(p), time.Time{}, bytes.NewReader(body))
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean(r.URL.Path)
		switch {
		case p == "/":
			serve(w, r, "/index.html")
		case exists(p):
			serve(w, r, p)
		case exists(p + ".html"):
			serve(w, r, p+".html")
		case exists(p + "/index.html"):
			serve(w, r, p+"/index.html")
		case goalRoute.MatchString(p):
			rest := goalRoute.FindStringSubmatch(p)[1]
			if rest == "" {
				rest = ".html"
			}
			if !exists("/goals/_" + rest) {
				http.NotFound(w, r)
				return
			}
			serve(w, r, "/goals/_"+rest)
		default:
			body, err := fs.ReadFile(ui, "404.html")
			if err != nil {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write(body)
		}
	})
}

// hub fans "something changed" out to every SSE client. Hints only: they
// carry no data, so a missed one costs at most a later pull.
type hub struct {
	mu   sync.Mutex
	subs map[chan struct{}]struct{}
}

func (h *hub) broadcast() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.subs {
		select {
		case c <- struct{}{}:
		default: // already has a pending hint
		}
	}
}

func (h *hub) serve(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	c := make(chan struct{}, 1)
	h.mu.Lock()
	h.subs[c] = struct{}{}
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.subs, c)
		h.mu.Unlock()
	}()
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprint(w, "retry: 2000\n\n")
	flusher.Flush()
	keepalive := time.NewTicker(25 * time.Second)
	defer keepalive.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-c:
			fmt.Fprint(w, "data: change\n\n")
			flusher.Flush()
		case <-keepalive.C:
			fmt.Fprint(w, ": keepalive\n\n")
			flusher.Flush()
		}
	}
}
