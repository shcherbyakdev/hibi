package syncsvc

import "testing"

func TestRules(t *testing.T) {
	long := func(n int) string { b := make([]rune, n); for i := range b { b[i] = 'й' }; return string(b) } // multibyte: counts characters
	cases := []struct {
		name  string
		table string
		patch Row
		code  string
	}{
		{"valid goal", "goals", Row{}, ""},
		{"goal name empty", "goals", Row{"name": ""}, "23514"},
		{"goal name 120 chars ok", "goals", Row{"name": long(120)}, ""},
		{"goal name 121 chars", "goals", Row{"name": long(121)}, "23514"},
		{"goal notes too long", "goals", Row{"notes": long(20001)}, "23514"},
		{"goal weekly target 0", "goals", Row{"weekly_target": float64(0)}, "23514"},
		{"goal weekly target 8", "goals", Row{"weekly_target": float64(8)}, "23514"},
		{"goal layout kanban", "goals", Row{"layout": "kanban"}, "23514"},
		{"goal name missing", "goals", Row{"name": nil}, "23502"},
		{"valid routine", "routines", Row{}, ""},
		{"routine days 0", "routines", Row{"days": float64(0)}, "23514"},
		{"routine days 128", "routines", Row{"days": float64(128)}, "23514"},
		{"routine priority 5", "routines", Row{"priority": float64(5)}, "23514"},
		{"valid item", "items", Row{}, ""},
		{"item status maybe", "items", Row{"status": "maybe"}, "23514"},
		{"item priority 2.5", "items", Row{"priority": 2.5}, "22P02"},
		{"item priority text", "items", Row{"priority": "high"}, "22P02"},
		{"item scope without date", "items", Row{"plan_scope": "day"}, "23514"},
		{"item date without scope", "items", Row{"plan_date": "2026-11-15"}, "23514"},
		{"item scope bogus", "items", Row{"plan_scope": "year", "plan_date": "2026-11-15"}, "23514"},
		{"item month not on the 1st", "items", Row{"plan_scope": "month", "plan_date": "2026-11-15"}, "23514"},
		{"item month on the 1st", "items", Row{"plan_scope": "month", "plan_date": "2026-11-01"}, ""},
		{"item week any day", "items", Row{"plan_scope": "week", "plan_date": "2026-11-12"}, ""},
		{"valid time entry", "time_entries", Row{}, ""},
		{"entry ends before start", "time_entries", Row{"ended_at": "2026-11-15T09:00:00Z"}, "23514"},
		{"entry planned 10s", "time_entries", Row{"planned_seconds": float64(10)}, "23514"},
		{"entry planned 25m", "time_entries", Row{"planned_seconds": float64(1500)}, ""},
		{"entry without item", "time_entries", Row{"item_id": nil}, "23502"},
	}
	base := map[string]Row{
		"goals":        {"id": "g", "name": "Goal", "sort_key": "a0", "updated_at": "2026-11-15T10:00:00Z"},
		"routines":     {"id": "r", "title": "Stretch", "updated_at": "2026-11-15T10:00:00Z"},
		"items":        {"id": "i", "title": "Task", "sort_key": "a0", "updated_at": "2026-11-15T10:00:00Z"},
		"time_entries": {"id": "t", "item_id": "i", "started_at": "2026-11-15T10:00:00Z", "updated_at": "2026-11-15T10:00:00Z"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			row := Row{}
			for k, v := range base[c.table] {
				row[k] = v
			}
			for k, v := range c.patch {
				if v == nil {
					delete(row, k)
				} else {
					row[k] = v
				}
			}
			err := validate(c.table, withDefaults(c.table, row))
			got := ""
			if err != nil {
				got = err.Code
			}
			if got != c.code {
				t.Fatalf("want %q, got %q (%v)", c.code, got, err)
			}
		})
	}
}
