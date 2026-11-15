package syncsvc

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

// stampLayout is how synced_at is stored and returned: fixed-width UTC with
// microseconds, so text order is time order inside SQLite. Inputs (cursors)
// are always parsed to an instant first and re-formatted with it.
const stampLayout = "2006-01-02T15:04:05.000000Z"

func stamp(t time.Time) string { return t.UTC().Format(stampLayout) }

// Keyset is the last row of a pull page: (synced_at, id).
type Keyset struct {
	SyncedAt time.Time
	ID       string
}

// Store is the desktop's server-side copy of the data: one SQLite file,
// one table per synced table (id, updated_at, synced_at + the row as JSON).
// It does what the hosted sync_stamp trigger does: stamps synced_at at
// commit from a clock that never goes back, and drops older writes.
type Store struct {
	db       *sql.DB
	mu       sync.Mutex // one writer; batches share one stamp
	last     time.Time
	now      func() time.Time
	onChange func()
}

// migrations run in order; PRAGMA user_version records how many ran.
// Append only — never edit a shipped one.
var migrations = []string{
	`CREATE TABLE goals (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, synced_at TEXT NOT NULL, row TEXT NOT NULL);
	 CREATE TABLE routines (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, synced_at TEXT NOT NULL, row TEXT NOT NULL);
	 CREATE TABLE items (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, synced_at TEXT NOT NULL, row TEXT NOT NULL);
	 CREATE TABLE time_entries (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, synced_at TEXT NOT NULL, row TEXT NOT NULL);
	 CREATE INDEX goals_pull ON goals (synced_at, id);
	 CREATE INDEX routines_pull ON routines (synced_at, id);
	 CREATE INDEX items_pull ON items (synced_at, id);
	 CREATE INDEX time_entries_pull ON time_entries (synced_at, id);
	 CREATE TABLE prefs (id INTEGER PRIMARY KEY CHECK (id = 1), updated_at TEXT NOT NULL, row TEXT NOT NULL);`,
}

// Open opens (creating if needed) and migrates the database at path.
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(off)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // SQLite: one connection keeps transactions simple
	s := &Store{db: db, now: time.Now, onChange: func() {}}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	// Seed the clock from the newest stamp so it stays monotonic even if
	// the system clock is now behind it.
	for t := range tables {
		var max sql.NullString
		if err := db.QueryRow(`SELECT max(synced_at) FROM ` + t).Scan(&max); err != nil {
			db.Close()
			return nil, err
		}
		if max.Valid {
			if ts, err := time.Parse(stampLayout, max.String); err == nil && ts.After(s.last) {
				s.last = ts
			}
		}
	}
	return s, nil
}

func (s *Store) migrate() error {
	var v int
	if err := s.db.QueryRow(`PRAGMA user_version`).Scan(&v); err != nil {
		return err
	}
	for ; v < len(migrations); v++ {
		tx, err := s.db.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(migrations[v]); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %d: %w", v+1, err)
		}
		if _, err := tx.Exec(fmt.Sprintf(`PRAGMA user_version = %d`, v+1)); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

// Close closes the database.
func (s *Store) Close() error { return s.db.Close() }

// OnChange registers the hint callback, called after every committed write.
func (s *Store) OnChange(f func()) { s.onChange = f }

// ErrUnknownTable is returned for a table that isn't synced.
var ErrUnknownTable = errors.New("unknown table")

// next returns the next stamp: max(now, last + 1µs).
func (s *Store) next() time.Time {
	t := s.now().UTC().Truncate(time.Microsecond)
	if !t.After(s.last) {
		t = s.last.Add(time.Microsecond)
	}
	s.last = t
	return t
}

// Upsert applies a batch all-or-nothing: a RowError refuses the whole
// batch (nothing written); error is anything else (the caller retries).
func (s *Store) Upsert(table string, rows []Row) (*RowError, error) {
	fks, ok := tables[table]
	if !ok {
		return nil, ErrUnknownTable
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	at := stamp(s.next())
	for _, in := range rows {
		r := withDefaults(table, in)
		if rerr := validate(table, r); rerr != nil {
			return rerr, nil
		}
		id, ok := r["id"].(string)
		if !ok || id == "" {
			return refuse("22P02", "%s.id must be text", table), nil
		}
		for _, f := range fks {
			ref, _ := r[f.column].(string)
			if ref == "" {
				continue
			}
			var one int
			err := tx.QueryRow(`SELECT 1 FROM `+f.parent+` WHERE id = ?`, ref).Scan(&one)
			if errors.Is(err, sql.ErrNoRows) {
				return refuse("23503", "%s.%s: no %s row %s", table, f.column, f.parent, ref), nil
			} else if err != nil {
				return nil, err
			}
		}
		updated, _ := instant(r["updated_at"])
		var stored sql.NullString
		if err := tx.QueryRow(`SELECT updated_at FROM `+table+` WHERE id = ?`, id).Scan(&stored); err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		if stored.Valid {
			if old, err := time.Parse(time.RFC3339Nano, stored.String); err == nil && updated.Before(old) {
				continue // last write wins: an older write is dropped, like sync_stamp
			}
		}
		r["synced_at"] = at
		body, err := json.Marshal(r)
		if err != nil {
			return refuse("22P02", "%s: %v", table, err), nil
		}
		if _, err := tx.Exec(`INSERT INTO `+table+` (id, updated_at, synced_at, row) VALUES (?, ?, ?, ?)
			ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at, synced_at = excluded.synced_at, row = excluded.row`,
			id, updated.UTC().Format(time.RFC3339Nano), at, string(body)); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	s.onChange()
	return nil, nil
}

// Get returns one row, or ok=false if there is none.
func (s *Store) Get(table, id string) (Row, bool, error) {
	if _, ok := tables[table]; !ok {
		return nil, false, ErrUnknownTable
	}
	var body string
	err := s.db.QueryRow(`SELECT row FROM `+table+` WHERE id = ?`, id).Scan(&body)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	var r Row
	return r, true, json.Unmarshal([]byte(body), &r)
}

// Pull returns rows with synced_at > since, or after the keyset, in
// (synced_at, id) order, at most limit.
func (s *Store) Pull(table string, since *time.Time, after *Keyset, limit int) ([]Row, error) {
	if _, ok := tables[table]; !ok {
		return nil, ErrUnknownTable
	}
	var rows *sql.Rows
	var err error
	if after != nil {
		at := stamp(after.SyncedAt)
		rows, err = s.db.Query(`SELECT row FROM `+table+` WHERE synced_at > ? OR (synced_at = ? AND id > ?) ORDER BY synced_at, id LIMIT ?`, at, at, after.ID, limit)
	} else {
		from := time.Unix(0, 0)
		if since != nil {
			from = *since
		}
		rows, err = s.db.Query(`SELECT row FROM `+table+` WHERE synced_at > ? ORDER BY synced_at, id LIMIT ?`, stamp(from), limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Row{}
	for rows.Next() {
		var body string
		if err := rows.Scan(&body); err != nil {
			return nil, err
		}
		var r Row
		if err := json.Unmarshal([]byte(body), &r); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// Prefs returns the stored preferences ({} when none).
func (s *Store) Prefs() (Row, error) {
	var body string
	err := s.db.QueryRow(`SELECT row FROM prefs WHERE id = 1`).Scan(&body)
	if errors.Is(err, sql.ErrNoRows) {
		return Row{}, nil
	}
	if err != nil {
		return nil, err
	}
	var r Row
	return r, json.Unmarshal([]byte(body), &r)
}

// PutPrefs stores preferences, last write wins by updated_at.
func (s *Store) PutPrefs(p Row) error {
	updated, err := instant(p["updated_at"])
	if err != nil {
		return refuse("22P02", "prefs.updated_at: %v", err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	var stored sql.NullString
	if err := s.db.QueryRow(`SELECT updated_at FROM prefs WHERE id = 1`).Scan(&stored); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if stored.Valid {
		if old, err := time.Parse(time.RFC3339Nano, stored.String); err == nil && updated.Before(old) {
			return nil
		}
	}
	body, _ := json.Marshal(p)
	if _, err := s.db.Exec(`INSERT INTO prefs (id, updated_at, row) VALUES (1, ?, ?)
		ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at, row = excluded.row`,
		updated.UTC().Format(time.RFC3339Nano), string(body)); err != nil {
		return err
	}
	s.onChange()
	return nil
}
