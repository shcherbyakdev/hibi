package update

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type entry struct {
	name, body string
	mode       os.FileMode
}

func makeZip(t *testing.T, entries ...entry) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, e := range entries {
		h := &zip.FileHeader{Name: e.name, Method: zip.Deflate}
		h.SetMode(e.mode)
		w, err := zw.CreateHeader(h)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write([]byte(e.body))
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// A bundle the way `ditto -c -k --keepParent hibi.app` zips it.
func newBundleZip(t *testing.T) []byte {
	return makeZip(t,
		entry{"hibi.app/Contents/MacOS/hibi", "new", 0o755},
		entry{"hibi.app/Contents/Info.plist", "plist", 0o644},
		entry{"hibi.app/Contents/Resources/link", "../Info.plist", os.ModeSymlink | 0o777},
	)
}

func installedApp(t *testing.T) string {
	t.Helper()
	app := filepath.Join(t.TempDir(), "hibi.app")
	if err := os.MkdirAll(filepath.Join(app, "Contents", "MacOS"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(app, "Contents", "MacOS", "hibi"), []byte("old"), 0o755); err != nil {
		t.Fatal(err)
	}
	return app
}

func binary(t *testing.T, app string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(app, "Contents", "MacOS", "hibi"))
	if err != nil {
		t.Fatalf("read %s: %v", app, err)
	}
	return string(b)
}

func keys(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return pub, priv
}

func serveBytes(t *testing.T, b []byte) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(b) }))
	t.Cleanup(srv.Close)
	return srv.URL
}

func release(t *testing.T, zipBytes []byte, priv ed25519.PrivateKey, signed []byte) *Release {
	return &Release{Version: "0.2.0", URL: serveBytes(t, zipBytes), Signature: base64.StdEncoding.EncodeToString(ed25519.Sign(priv, signed))}
}

func assertUntouched(t *testing.T, app string) {
	t.Helper()
	if got := binary(t, app); got != "old" {
		t.Fatalf("original app changed: %q", got)
	}
	if _, err := os.Stat(app + ".old"); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("want no .old after a refused update, stat err = %v", err)
	}
	if left, _ := filepath.Glob(filepath.Join(filepath.Dir(app), ".hibi-update-*")); len(left) != 0 {
		t.Fatalf("staging dirs left behind: %v", left)
	}
}

func TestInstallGoodSignatureSwapsTheBundle(t *testing.T) {
	pub, priv := keys(t)
	app := installedApp(t)
	z := newBundleZip(t)
	if err := Install(context.Background(), release(t, z, priv, z), app, pub); err != nil {
		t.Fatal(err)
	}
	if got := binary(t, app); got != "new" {
		t.Fatalf("want the new binary, got %q", got)
	}
	if fi, _ := os.Stat(filepath.Join(app, "Contents", "MacOS", "hibi")); fi.Mode().Perm()&0o100 == 0 {
		t.Fatalf("binary lost its exec bit: %v", fi.Mode())
	}
	if target, err := os.Readlink(filepath.Join(app, "Contents", "Resources", "link")); err != nil || target != "../Info.plist" {
		t.Fatalf("symlink: got %q, %v", target, err)
	}
	if got := binary(t, app+".old"); got != "old" {
		t.Fatalf("want the previous bundle kept as .old until the next start, got %q", got)
	}
}

func TestInstallBadSignatureLeavesTheOriginal(t *testing.T) {
	pub, priv := keys(t)
	app := installedApp(t)
	z := newBundleZip(t)
	err := Install(context.Background(), release(t, z, priv, []byte("something else")), app, pub)
	if !errors.Is(err, ErrBadSignature) {
		t.Fatalf("want ErrBadSignature, got %v", err)
	}
	assertUntouched(t, app)
}

func TestInstallTruncatedZipLeavesTheOriginal(t *testing.T) {
	pub, priv := keys(t)
	z := newBundleZip(t)
	cut := z[:len(z)/2]

	app := installedApp(t)
	if err := Install(context.Background(), release(t, cut, priv, z), app, pub); !errors.Is(err, ErrBadSignature) {
		t.Fatalf("truncated download: want ErrBadSignature, got %v", err)
	}
	assertUntouched(t, app)

	// Even a correctly signed but broken zip must not get as far as the swap.
	app = installedApp(t)
	if err := Install(context.Background(), release(t, cut, priv, cut), app, pub); err == nil {
		t.Fatal("signed truncated zip: want an error")
	}
	assertUntouched(t, app)
}

func TestInstallRefusesEntriesOutsideTheBundle(t *testing.T) {
	pub, priv := keys(t)
	for name, z := range map[string][]byte{
		"zip slip": makeZip(t, entry{"hibi.app/Contents/MacOS/hibi", "new", 0o755}, entry{"../evil", "x", 0o644}),
		"symlink out": makeZip(t, entry{"hibi.app/Contents/MacOS/hibi", "new", 0o755},
			entry{"hibi.app/Contents/x", "../../../../etc/passwd", os.ModeSymlink | 0o777}),
		"no binary": makeZip(t, entry{"hibi.app/Contents/Info.plist", "plist", 0o644}),
	} {
		app := installedApp(t)
		if err := Install(context.Background(), release(t, z, priv, z), app, pub); err == nil {
			t.Fatalf("%s: want an error", name)
		}
		assertUntouched(t, app)
		if _, err := os.Stat(filepath.Join(filepath.Dir(filepath.Dir(app)), "evil")); err == nil {
			t.Fatalf("%s: wrote outside the staging dir", name)
		}
	}
}

func TestFailedSecondRenameRestoresTheOriginal(t *testing.T) {
	pub, priv := keys(t)
	app := installedApp(t)
	z := newBundleZip(t)
	calls := 0
	rename = func(from, to string) error {
		if calls++; calls == 2 {
			return errors.New("disk full")
		}
		return os.Rename(from, to)
	}
	t.Cleanup(func() { rename = os.Rename })
	if err := Install(context.Background(), release(t, z, priv, z), app, pub); err == nil {
		t.Fatal("want the rename error")
	}
	assertUntouched(t, app)
}

func TestCleanup(t *testing.T) {
	// The swap was interrupted after the first rename: only .old exists.
	app := installedApp(t)
	if err := os.Rename(app, app+".old"); err != nil {
		t.Fatal(err)
	}
	if err := Cleanup(app); err != nil {
		t.Fatal(err)
	}
	assertUntouched(t, app)

	// A finished update: the new app is valid, so .old goes.
	if err := os.CopyFS(app+".old", os.DirFS(app)); err != nil {
		t.Fatal(err)
	}
	if err := Cleanup(app); err != nil {
		t.Fatal(err)
	}
	assertUntouched(t, app)
}

func feed(t *testing.T, version string) string {
	b, _ := json.Marshal(Release{Version: version, URL: "https://example.invalid/hibi.zip", Signature: "c2ln", Notes: "Faster."})
	return serveBytes(t, b)
}

func TestCheckOnlyOffersNewerVersions(t *testing.T) {
	url := feed(t, "0.2.0")
	for current, want := range map[string]bool{"0.1.9": true, "v0.1.0": true, "0.2.0": false, "0.10.0": false, "1.0.0": false, "dev": false} {
		r, err := Check(context.Background(), url, current)
		if err != nil {
			t.Fatalf("%s: %v", current, err)
		}
		if got := r != nil; got != want {
			t.Fatalf("current %s, feed 0.2.0: want offered=%v, got %v", current, want, got)
		}
	}
}

func TestServiceReportsAndRefusesOutsideApplications(t *testing.T) {
	pub, _ := keys(t)
	svc := &Service{Feed: feed(t, "0.2.0"), Current: "0.1.0", AppPath: installedApp(t), Pub: pub, Relaunch: func() { t.Fatal("must not relaunch") }}

	rec := httptest.NewRecorder()
	svc.ServeHTTP(rec, httptest.NewRequest("GET", "/app/update", nil))
	var got Status
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if rec.Code != 200 || !got.Available || got.Version != "0.2.0" || got.Notes != "Faster." {
		t.Fatalf("GET: want available 0.2.0, got %d %s", rec.Code, rec.Body)
	}

	// A temp dir stands in for a translocated app: offer the manual download.
	rec = httptest.NewRecorder()
	svc.ServeHTTP(rec, httptest.NewRequest("POST", "/app/update", strings.NewReader("{}")))
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), ReleasesPage) {
		t.Fatalf("POST outside /Applications: want 409 with the release page, got %d %s", rec.Code, rec.Body)
	}

	opened := false
	svc.OpenPage = func() { opened = true }
	rec = httptest.NewRecorder()
	svc.ServeHTTP(rec, httptest.NewRequest("POST", "/app/releases", strings.NewReader("{}")))
	if rec.Code != http.StatusNoContent || !opened {
		t.Fatalf("POST /app/releases: want 204 and the page opened, got %d %v", rec.Code, opened)
	}

	// No public key compiled in (dev build): never offers anything.
	svc.Pub = nil
	rec = httptest.NewRecorder()
	svc.ServeHTTP(rec, httptest.NewRequest("GET", "/app/update", nil))
	if strings.Contains(rec.Body.String(), `"available":true`) {
		t.Fatalf("dev build offered an update: %s", rec.Body)
	}
}

func TestInApplications(t *testing.T) {
	home, _ := os.UserHomeDir()
	for p, want := range map[string]bool{
		"/Applications/hibi.app":                             true,
		filepath.Join(home, "Applications", "hibi.app"):      true,
		"/private/var/folders/x/AppTranslocation/y/hibi.app": false,
		"/Users/me/Downloads/hibi.app":                       false,
		"/Applications/../tmp/hibi.app":                      false,
	} {
		if got := InApplications(p); got != want {
			t.Fatalf("%s: want %v, got %v", p, want, got)
		}
	}
}
