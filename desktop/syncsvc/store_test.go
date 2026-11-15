package syncsvc

import (
	"path/filepath"
	"testing"
	"time"
)

func openTemp(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "hibi.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

var tick = time.Date(2026, 11, 15, 10, 0, 0, 0, time.UTC)

func iso(t time.Time) string { return t.UTC().Format(time.RFC3339Nano) }

func goal(id, name string, updated time.Time) Row {
	return Row{"id": id, "name": name, "sort_key": "a0", "updated_at": iso(updated), "synced_at": "2000-01-01T00:00:00Z"}
}

func item(id, title string, updated time.Time) Row {
	return Row{"id": id, "title": title, "sort_key": "a0", "updated_at": iso(updated), "synced_at": "2000-01-01T00:00:00Z"}
}

func mustUpsert(t *testing.T, s *Store, table string, rows ...Row) {
	t.Helper()
	if rerr, err := s.Upsert(table, rows); err != nil || rerr != nil {
		t.Fatalf("upsert %s: %v %v", table, rerr, err)
	}
}

func get(t *testing.T, s *Store, table, id string) Row {
	t.Helper()
	r, ok, err := s.Get(table, id)
	if err != nil || !ok {
		t.Fatalf("get %s/%s: ok=%v err=%v", table, id, ok, err)
	}
	return r
}

func TestStampsOneSyncedAtPerBatchIncreasingAcrossBatches(t *testing.T) {
	s := openTemp(t)
	mustUpsert(t, s, "items", item("a", "A", tick), item("b", "B", tick))
	mustUpsert(t, s, "items", item("c", "C", tick))
	a, b, c := get(t, s, "items", "a")["synced_at"], get(t, s, "items", "b")["synced_at"], get(t, s, "items", "c")["synced_at"]
	if a != b {
		t.Fatalf("one batch, one stamp: %v %v", a, b)
	}
	if !(c.(string) > a.(string)) {
		t.Fatalf("later batch must stamp later: %v !> %v", c, a)
	}
	if len(a.(string)) != len("2026-11-15T10:00:00.000000Z") || a.(string)[len(a.(string))-1] != 'Z' {
		t.Fatalf("fixed-width µs UTC: %v", a)
	}
}

func TestDropsOlderWritesAndTiesOverwrite(t *testing.T) {
	s := openTemp(t)
	mustUpsert(t, s, "items", item("a", "first", tick))
	mustUpsert(t, s, "items", item("a", "stale", tick.Add(-time.Minute)))
	if got := get(t, s, "items", "a")["title"]; got != "first" {
		t.Fatalf("older write must be dropped, got %v", got)
	}
	mustUpsert(t, s, "items", item("a", "tie", tick))
	if got := get(t, s, "items", "a")["title"]; got != "tie" {
		t.Fatalf("a tie overwrites (sync_stamp uses <), got %v", got)
	}
}

func TestStampStaysMonotonicAcrossRestartsWithClockBehind(t *testing.T) {
	path := filepath.Join(t.TempDir(), "hibi.sqlite")
	s, _ := Open(path)
	future := time.Now().Add(time.Hour)
	s.now = func() time.Time { return future }
	mustUpsert(t, s, "items", item("a", "A", tick))
	first := get(t, s, "items", "a")["synced_at"].(string)
	s.Close()
	s2, err := Open(path) // real clock: an hour behind the stored stamp
	if err != nil {
		t.Fatal(err)
	}
	defer s2.Close()
	mustUpsert(t, s2, "items", item("b", "B", tick))
	if second := get(t, s2, "items", "b")["synced_at"].(string); !(second > first) {
		t.Fatalf("stamp went back after restart: %s !> %s", second, first)
	}
}

func TestBatchWithABadRowWritesNothing(t *testing.T) {
	s := openTemp(t)
	rerr, err := s.Upsert("items", []Row{item("ok", "fine", tick), item("bad", "", tick)})
	if err != nil || rerr == nil || rerr.Code != "23514" {
		t.Fatalf("want 23514, got %v %v", rerr, err)
	}
	if _, ok, _ := s.Get("items", "ok"); ok {
		t.Fatal("all or nothing: the good row must not be stored")
	}
}

func TestForeignKeys(t *testing.T) {
	s := openTemp(t)
	child := item("i", "linked", tick)
	child["goal_id"] = "g"
	if rerr, _ := s.Upsert("items", []Row{child}); rerr == nil || rerr.Code != "23503" {
		t.Fatalf("missing parent: want 23503, got %v", rerr)
	}
	g := goal("g", "Goal", tick)
	g["deleted_at"] = iso(tick) // soft-deleted parents still count, as in Postgres
	mustUpsert(t, s, "goals", g)
	mustUpsert(t, s, "items", child)
}

// Mirrors the composite (id, user_id) FKs of migration 0013: a link must
// stay within one owner.
func TestForeignKeysStayWithinOneOwner(t *testing.T) {
	s := openTemp(t)
	theirs := goal("g", "Theirs", tick)
	theirs["user_id"] = "them"
	mustUpsert(t, s, "goals", theirs)
	child := item("i", "mine", tick)
	child["user_id"] = "me"
	child["goal_id"] = "g"
	if rerr, _ := s.Upsert("items", []Row{child}); rerr == nil || rerr.Code != "23503" {
		t.Fatalf("link to another owner's goal: want 23503, got %v", rerr)
	}
	mine := goal("g2", "Mine", tick)
	mine["user_id"] = "me"
	mustUpsert(t, s, "goals", mine)
	child["goal_id"] = "g2"
	mustUpsert(t, s, "items", child)
}

func TestFillsDefaultsLikePostgres(t *testing.T) {
	s := openTemp(t)
	mustUpsert(t, s, "items", item("a", "A", tick))
	r := get(t, s, "items", "a")
	if r["status"] != "todo" || r["notes"] != "" || r["priority"] != float64(0) || r["deleted_at"] != nil {
		t.Fatalf("defaults: %v", r)
	}
}

func TestPullSinceComparesInstantsNotText(t *testing.T) {
	s := openTemp(t)
	base := time.Date(2026, 11, 15, 10, 0, 0, 123_000_000, time.UTC)
	s.now = func() time.Time { return base.Add(456 * time.Microsecond) } // same ms, later µs
	mustUpsert(t, s, "items", item("a", "A", tick))
	rows, err := s.Pull("items", &base, nil, 500) // the engine sends ms "…00.123Z"
	if err != nil || len(rows) != 1 {
		t.Fatalf("row stamped later in the same ms must be pulled: %v %v", rows, err)
	}
}

func TestKeysetPagingThroughABurst(t *testing.T) {
	s := openTemp(t)
	var rows []Row
	for _, id := range []string{"a", "b", "c", "d", "e"} {
		rows = append(rows, item(id, id, tick))
	}
	mustUpsert(t, s, "items", rows...) // one stamp for all five
	seen := map[string]int{}
	var after *Keyset
	epoch := time.Unix(0, 0)
	for {
		var page []Row
		var err error
		if after == nil {
			page, err = s.Pull("items", &epoch, nil, 2)
		} else {
			page, err = s.Pull("items", nil, after, 2)
		}
		if err != nil {
			t.Fatal(err)
		}
		for _, r := range page {
			seen[r["id"].(string)]++
		}
		if len(page) < 2 {
			break
		}
		last := page[len(page)-1]
		st, _ := time.Parse(time.RFC3339Nano, last["synced_at"].(string))
		after = &Keyset{SyncedAt: st, ID: last["id"].(string)}
	}
	if len(seen) != 5 {
		t.Fatalf("want 5 rows once each, got %v", seen)
	}
	for id, n := range seen {
		if n != 1 {
			t.Fatalf("%s seen %d times", id, n)
		}
	}
}

func TestSchemaIsVersioned(t *testing.T) {
	s := openTemp(t)
	var v int
	if err := s.db.QueryRow("PRAGMA user_version").Scan(&v); err != nil || v != 1 {
		t.Fatalf("user_version = %d (%v), want 1", v, err)
	}
}

func TestPrefsLastWriteWins(t *testing.T) {
	s := openTemp(t)
	if err := s.PutPrefs(Row{"week_start": float64(0), "updated_at": iso(tick)}); err != nil {
		t.Fatal(err)
	}
	_ = s.PutPrefs(Row{"week_start": float64(1), "updated_at": iso(tick.Add(-time.Second))})
	p, _ := s.Prefs()
	if p["week_start"] != float64(0) {
		t.Fatalf("older prefs write must lose: %v", p)
	}
}
