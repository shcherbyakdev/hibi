package syncsvc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"
)

func newServer(t *testing.T) (*httptest.Server, string) {
	t.Helper()
	s := openTemp(t)
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	ui := fstest.MapFS{
		"index.html":       {Data: []byte("home")},
		"plan/day.html":    {Data: []byte("day")},
		"goals/_.html":     {Data: []byte("goal page")},
		"goals/_.txt":      {Data: []byte("goal rsc")},
		"goals/_/__next._tree.txt": {Data: []byte("goal tree")},
		"goals/__next._tree.txt":   {Data: []byte("goals list tree")},
		"404.html":         {Data: []byte("not found")},
	}
	srv := httptest.NewUnstartedServer(Handler(s, Options{Port: port, UI: ui}))
	srv.Listener.Close()
	srv.Listener = ln
	srv.Start()
	t.Cleanup(srv.Close)
	return srv, fmt.Sprintf("http://127.0.0.1:%d", port)
}

func do(t *testing.T, method, url, contentType, body string, hdr map[string]string) (*http.Response, string) {
	t.Helper()
	req, _ := http.NewRequest(method, url, strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	for k, v := range hdr {
		if k == "Host" {
			req.Host = v
		} else {
			req.Header.Set(k, v)
		}
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(res.Body)
	res.Body.Close()
	return res, string(b)
}

const itemJSON = `[{"id":"a","title":"A","sort_key":"a0","updated_at":"2026-11-15T10:00:00Z","synced_at":"2000-01-01T00:00:00Z"}]`

func TestGuards(t *testing.T) {
	_, base := newServer(t)
	if res, _ := do(t, "POST", base+"/sync/items", "text/plain", itemJSON, nil); res.StatusCode != 415 {
		t.Fatalf("text/plain POST (no-cors from a web page): want 415, got %d", res.StatusCode)
	}
	if res, _ := do(t, "GET", base+"/sync/items/a", "", "", map[string]string{"Host": "evil.example:80"}); res.StatusCode != 403 {
		t.Fatalf("DNS rebinding Host: want 403, got %d", res.StatusCode)
	}
	if res, _ := do(t, "GET", base+"/sync/items/a", "", "", map[string]string{"Origin": "https://evil.example"}); res.StatusCode != 403 {
		t.Fatalf("foreign Origin: want 403, got %d", res.StatusCode)
	}
	if res, _ := do(t, "GET", base+"/sync/items/a", "", "", map[string]string{"Origin": base}); res.StatusCode != 404 {
		t.Fatalf("own Origin passes the guard: want 404 (no row), got %d", res.StatusCode)
	}
	if _, body := do(t, "GET", base+"/sync/items/a", "", "", nil); body == "" {
		t.Fatal("unreachable")
	}
}

func TestSyncAPI(t *testing.T) {
	_, base := newServer(t)
	if res, _ := do(t, "POST", base+"/sync/items", "application/json", itemJSON, nil); res.StatusCode != 204 {
		t.Fatalf("upsert: want 204, got %d", res.StatusCode)
	}
	res, body := do(t, "GET", base+"/sync/items/a", "", "", nil)
	if res.StatusCode != 200 || !strings.Contains(body, `"title":"A"`) {
		t.Fatalf("get: %d %s", res.StatusCode, body)
	}
	if res, _ := do(t, "GET", base+"/sync/items/zzz", "", "", nil); res.StatusCode != 404 {
		t.Fatalf("missing: want 404, got %d", res.StatusCode)
	}
	res, body = do(t, "POST", base+"/sync/items", "application/json", `[{"id":"b","title":"","sort_key":"a0","updated_at":"2026-11-15T10:00:00Z"}]`, nil)
	var rerr RowError
	_ = json.Unmarshal([]byte(body), &rerr)
	if res.StatusCode != 409 || rerr.Code != "23514" {
		t.Fatalf("refusal: want 409 23514, got %d %s", res.StatusCode, body)
	}
	res, body = do(t, "GET", base+"/sync/items?since=1970-01-01T00:00:00.000Z&limit=10", "", "", nil)
	var rows []Row
	_ = json.Unmarshal([]byte(body), &rows)
	if res.StatusCode != 200 || len(rows) != 1 {
		t.Fatalf("pull since: %d %s", res.StatusCode, body)
	}
	q := fmt.Sprintf("/sync/items?after_synced_at=%s&after_id=a&limit=10", rows[0]["synced_at"])
	if _, body = do(t, "GET", base+q, "", "", nil); strings.TrimSpace(body) != "[]" {
		t.Fatalf("pull after keyset: want [], got %s", body)
	}
	if res, _ := do(t, "GET", base+"/sync/nope/a", "", "", nil); res.StatusCode != 404 {
		t.Fatalf("unknown table: want 404, got %d", res.StatusCode)
	}
}

func TestEventsHintOnChange(t *testing.T) {
	_, base := newServer(t)
	res, err := http.Get(base + "/sync/events")
	if err != nil || res.StatusCode != 200 || !strings.HasPrefix(res.Header.Get("Content-Type"), "text/event-stream") {
		t.Fatalf("events: %v %v", res, err)
	}
	defer res.Body.Close()
	got := make(chan string, 1)
	go func() {
		sc := bufio.NewScanner(res.Body)
		for sc.Scan() {
			if strings.HasPrefix(sc.Text(), "data:") {
				got <- sc.Text()
				return
			}
		}
	}()
	time.Sleep(100 * time.Millisecond)
	do(t, "POST", base+"/sync/items", "application/json", itemJSON, nil)
	select {
	case <-got:
	case <-time.After(3 * time.Second):
		t.Fatal("no change event after an upsert")
	}
}

func TestPrefsEndpoint(t *testing.T) {
	_, base := newServer(t)
	if res, _ := do(t, "PUT", base+"/prefs", "application/json", `{"week_start":0,"updated_at":"2026-11-15T10:00:00Z"}`, nil); res.StatusCode != 204 {
		t.Fatalf("put prefs: %d", res.StatusCode)
	}
	if _, body := do(t, "GET", base+"/prefs", "", "", nil); !strings.Contains(body, `"week_start":0`) {
		t.Fatalf("get prefs: %s", body)
	}
}

func TestServesUIWithGoalFallback(t *testing.T) {
	_, base := newServer(t)
	for path, want := range map[string]string{"/": "home", "/plan/day": "day", "/goals/abc-123": "goal page", "/goals/abc-123.txt": "goal rsc", "/goals/abc-123/__next._tree.txt": "goal tree", "/goals/__next._tree.txt": "goals list tree"} {
		if _, body := do(t, "GET", base+path, "", "", nil); body != want {
			t.Errorf("%s: want %q, got %q", path, want, body)
		}
	}
	if res, body := do(t, "GET", base+"/nope", "", "", nil); res.StatusCode != 404 || body != "not found" {
		t.Errorf("unknown page: %d %q", res.StatusCode, body)
	}
}
