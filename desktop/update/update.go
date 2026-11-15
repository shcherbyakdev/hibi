// Package update is hibi.app's self-updater: it reads latest.json from the
// latest GitHub Release, downloads the signed .app.zip, verifies it with the
// Ed25519 public key compiled into the app, and swaps the bundle in place.
// If any step fails the old app stays. User data lives in Application
// Support, never in the bundle, so an update can't touch it.
package update

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/ed25519"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const (
	ReleasesPage = "https://github.com/shcherbyakdev/hibi/releases/latest"
	maxZip       = 256 << 20
)

// FeedURL is a var only so a test build can point at a local feed with
// -ldflags "-X .../update.FeedURL=..."; there's no runtime switch.
var FeedURL = "https://github.com/shcherbyakdev/hibi/releases/latest/download/latest.json"

var (
	ErrBadSignature = errors.New("update: signature doesn't match")
	ErrNotInstalled = errors.New("update: hibi isn't in Applications; download the new version instead")
)

// The release signing key (Task 6 commits it; empty = updates disabled).
//
//go:embed pubkey.txt
var pubkeyB64 string

// PublicKey is the compiled-in release key, or nil if there is none.
func PublicKey() ed25519.PublicKey {
	b, err := base64.StdEncoding.DecodeString(strings.TrimSpace(pubkeyB64))
	if err != nil || len(b) != ed25519.PublicKeySize {
		return nil
	}
	return b
}

// Release is latest.json.
// ponytail: only the zip is signed, not this feed; HTTPS to GitHub is what
// stops a replayed older release. Sign the feed if it's ever served elsewhere.
type Release struct {
	Version   string `json:"version"`
	URL       string `json:"url"`
	Signature string `json:"signature"` // base64 Ed25519 over the zip bytes
	Notes     string `json:"notes"`
}

// Check returns the feed's release if it's newer than current, else nil.
// A current version that isn't x.y.z (a dev build) is never offered one.
func Check(ctx context.Context, feedURL, current string) (*Release, error) {
	body, err := get(ctx, feedURL, 1<<20)
	if err != nil {
		return nil, err
	}
	var r Release
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("update: feed: %w", err)
	}
	if r.URL == "" || r.Signature == "" || !newer(r.Version, current) {
		return nil, nil
	}
	return &r, nil
}

// rename is swapped in tests to fail the second step of the swap.
var rename = os.Rename

// Install downloads r, verifies it, and swaps it in at appPath, keeping the
// previous bundle as appPath+".old" (Cleanup removes it on the next start).
func Install(ctx context.Context, r *Release, appPath string, pub ed25519.PublicKey) error {
	z, err := get(ctx, r.URL, maxZip)
	if err != nil {
		return err
	}
	sig, err := base64.StdEncoding.DecodeString(r.Signature)
	if err != nil || len(pub) != ed25519.PublicKeySize || !ed25519.Verify(pub, z, sig) {
		return ErrBadSignature
	}
	// Staged next to the app so both renames stay on one volume.
	staging, err := os.MkdirTemp(filepath.Dir(appPath), ".hibi-update-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(staging)
	if err := unzip(z, staging); err != nil {
		return err
	}
	fresh := filepath.Join(staging, "hibi.app")
	if !valid(fresh) {
		return errors.New("update: the zip has no hibi.app/Contents/MacOS/hibi")
	}
	old := appPath + ".old"
	if err := os.RemoveAll(old); err != nil {
		return err
	}
	if err := rename(appPath, old); err != nil {
		return err
	}
	if err := rename(fresh, appPath); err != nil {
		if rerr := rename(old, appPath); rerr != nil {
			return fmt.Errorf("update: %w; restoring also failed (Cleanup retries on next start): %v", err, rerr)
		}
		return err
	}
	return nil
}

// Cleanup runs at startup: after a finished update it removes .old; after
// an interrupted swap (no app, only .old) it puts the old app back.
func Cleanup(appPath string) error {
	old := appPath + ".old"
	if valid(appPath) {
		return os.RemoveAll(old)
	}
	if !valid(old) {
		return nil
	}
	if err := os.RemoveAll(appPath); err != nil {
		return err
	}
	return os.Rename(old, appPath)
}

// Relaunch opens appPath once this process has exited (the single-instance
// lock would otherwise hand the launch back to us). The caller then quits.
func Relaunch(appPath string) error {
	cmd := exec.Command("/bin/sh", "-c", `while kill -0 "$1" 2>/dev/null; do sleep 0.2; done; exec /usr/bin/open "$2"`,
		"sh", strconv.Itoa(os.Getpid()), appPath)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	return cmd.Start()
}

// InApplications reports whether appPath is somewhere Install may swap it:
// /Applications or ~/Applications. Anywhere else, including App
// Translocation's read-only copy, gets the manual download.
func InApplications(appPath string) bool {
	p := filepath.Clean(appPath)
	if p != appPath {
		return false
	}
	home, _ := os.UserHomeDir()
	for _, dir := range []string{"/Applications", filepath.Join(home, "Applications")} {
		if filepath.Dir(p) == dir {
			return true
		}
	}
	return false
}

func valid(app string) bool {
	fi, err := os.Stat(filepath.Join(app, "Contents", "MacOS", "hibi"))
	return err == nil && fi.Mode().IsRegular()
}

func get(ctx context.Context, url string, limit int64) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("update: GET %s: %s", url, res.Status)
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, limit+1))
	if err == nil && int64(len(b)) > limit {
		err = fmt.Errorf("update: %s is over %d bytes", url, limit)
	}
	return b, err
}

// unzip extracts z into dest, refusing any entry or symlink that would land
// outside it (the zip is signed by us; this is defence in depth).
func unzip(z []byte, dest string) error {
	zr, err := zip.NewReader(bytes.NewReader(z), int64(len(z)))
	if err != nil {
		return fmt.Errorf("update: zip: %w", err)
	}
	for _, f := range zr.File {
		name := strings.TrimSuffix(f.Name, "/")
		if !filepath.IsLocal(name) {
			return fmt.Errorf("update: zip entry %q is outside the bundle", f.Name)
		}
		path := filepath.Join(dest, name)
		mode := f.Mode()
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return err
		}
		switch {
		case mode.IsDir():
			err = os.MkdirAll(path, 0o755)
		case mode&fs.ModeSymlink != 0:
			err = unzipSymlink(f, name, path)
		default:
			err = unzipFile(f, path, mode.Perm())
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func unzipSymlink(f *zip.File, name, path string) error {
	target, err := readEntry(f, 4096)
	if err != nil {
		return err
	}
	if filepath.IsAbs(string(target)) || !filepath.IsLocal(filepath.Join(filepath.Dir(name), string(target))) {
		return fmt.Errorf("update: symlink %q points outside the bundle", f.Name)
	}
	return os.Symlink(string(target), path)
}

func unzipFile(f *zip.File, path string, perm fs.FileMode) error {
	b, err := readEntry(f, maxZip)
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, perm|0o600)
}

func readEntry(f *zip.File, limit int64) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, fmt.Errorf("update: zip %s: %w", f.Name, err)
	}
	defer rc.Close()
	b, err := io.ReadAll(io.LimitReader(rc, limit+1))
	if err == nil && int64(len(b)) > limit {
		err = fmt.Errorf("update: zip %s is too big", f.Name)
	}
	if err != nil {
		return nil, fmt.Errorf("update: zip %s: %w", f.Name, err)
	}
	return b, nil
}

// newer reports whether version a is a higher x.y.z than b.
func newer(a, b string) bool {
	va, okA := semver(a)
	vb, okB := semver(b)
	if !okA || !okB {
		return false
	}
	for i := range va {
		if va[i] != vb[i] {
			return va[i] > vb[i]
		}
	}
	return false
}

func semver(s string) ([3]int, bool) {
	var v [3]int
	parts := strings.Split(strings.TrimPrefix(s, "v"), ".")
	if len(parts) != 3 {
		return v, false
	}
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 {
			return v, false
		}
		v[i] = n
	}
	return v, true
}

// Status is GET /app/update's answer.
type Status struct {
	Available bool   `json:"available"`
	Version   string `json:"version,omitempty"`
	Notes     string `json:"notes,omitempty"`
	Page      string `json:"page"`            // the manual download, for when installing fails
	Error     string `json:"error,omitempty"` // POST only
}

// Service serves /app/update (GET checks, POST installs and relaunches) and
// POST /app/releases, which opens the release page in the default browser
// (the webview can't leave 127.0.0.1 without losing the app).
// syncsvc mounts it behind the same guards as everything else.
type Service struct {
	Feed, Current, AppPath string
	Pub                    ed25519.PublicKey
	Relaunch               func() // after a successful install
	OpenPage               func() // opens ReleasesPage in the browser
}

func (s *Service) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/app/releases" && r.Method == http.MethodPost && s.OpenPage != nil {
		s.OpenPage()
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.URL.Path != "/app/update" {
		http.NotFound(w, r)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()
	reply := func(code int, st Status) {
		st.Page = ReleasesPage
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		_ = json.NewEncoder(w).Encode(st)
	}
	var rel *Release
	var err error
	if s.Pub != nil {
		rel, err = Check(ctx, s.Feed, s.Current)
	}
	if err != nil {
		reply(http.StatusBadGateway, Status{Error: err.Error()})
		return
	}
	if r.Method == http.MethodGet {
		if rel == nil {
			reply(http.StatusOK, Status{})
		} else {
			reply(http.StatusOK, Status{Available: true, Version: rel.Version, Notes: rel.Notes})
		}
		return
	}
	switch {
	case rel == nil:
		reply(http.StatusConflict, Status{Error: "no update available"})
	case !InApplications(s.AppPath):
		reply(http.StatusConflict, Status{Error: ErrNotInstalled.Error()})
	default:
		if err := Install(ctx, rel, s.AppPath, s.Pub); err != nil {
			reply(http.StatusInternalServerError, Status{Error: err.Error()})
			return
		}
		reply(http.StatusAccepted, Status{Version: rel.Version})
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
		go s.Relaunch()
	}
}
