package syncsvc

import (
	"fmt"
	"math"
	"strings"
	"time"
	"unicode/utf8"
)

// The desktop service's copy of the Postgres CHECK constraints, NOT NULLs
// and defaults (src/db/schema/*.ts). Keep in step with them: the shared
// refusal fixture in src/lib/sync/transport.contract.ts runs against both
// servers and fails when they drift. Codes are the Postgres ones the engine
// already understands: 23502 not null, 23514 check, 22P02 bad value,
// 23503 foreign key (checked in store.go, scoped to the row's user_id like
// the composite (id, user_id) FKs in Postgres).

// Row is a synced row as JSON: snake_case keys, ISO timestamps.
type Row = map[string]any

// RowError is a refusal of the row itself; retrying can't help.
type RowError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *RowError) Error() string { return e.Code + " " + e.Message }

func refuse(code, format string, args ...any) *RowError {
	return &RowError{Code: code, Message: fmt.Sprintf(format, args...)}
}

// tables lists the synced tables in FK order with their parent references.
var tables = map[string][]fk{
	"goals":        nil,
	"routines":     {{"goal_id", "goals", false}},
	"items":        {{"goal_id", "goals", false}, {"routine_id", "routines", false}},
	"time_entries": {{"item_id", "items", true}},
}

type fk struct {
	column, parent string
	required       bool
}

// Postgres column defaults, applied to keys the client left out.
func withDefaults(table string, r Row) Row {
	out := Row{"deleted_at": nil}
	switch table {
	case "goals":
		out["notes"], out["icon"], out["weekly_target"], out["layout"] = "", nil, float64(5), "list"
	case "routines":
		out["priority"], out["goal_id"], out["days"] = float64(0), nil, float64(127)
	case "items":
		out["notes"], out["status"], out["priority"] = "", "todo", float64(0)
		out["plan_scope"], out["plan_date"], out["goal_id"], out["routine_id"], out["done_at"] = nil, nil, nil, nil, nil
	case "time_entries":
		out["ended_at"], out["planned_seconds"] = nil, nil
	}
	for k, v := range r {
		out[k] = v
	}
	return out
}

func validate(table string, r Row) *RowError {
	var required []string
	switch table {
	case "goals":
		required = []string{"id", "updated_at", "name", "sort_key"}
	case "routines":
		required = []string{"id", "updated_at", "title"}
	case "items":
		required = []string{"id", "updated_at", "title", "sort_key"}
	case "time_entries":
		required = []string{"id", "updated_at", "item_id", "started_at"}
	}
	for _, k := range required {
		if r[k] == nil {
			return refuse("23502", "%s.%s is required", table, k)
		}
	}
	if _, err := instant(r["updated_at"]); err != nil {
		return refuse("22P02", "%s.updated_at: %v", table, err)
	}
	c := checker{table: table, row: r}
	switch table {
	case "goals":
		c.length("name", 1, 120)
		c.length("notes", 0, 20000)
		c.intRange("weekly_target", 1, 7)
		c.oneOf("layout", "list", "board")
	case "routines":
		c.length("title", 1, 500)
		c.intRange("priority", 0, 4)
		c.intRange("days", 1, 127)
	case "items":
		c.length("title", 1, 500)
		c.length("notes", 0, 20000)
		c.oneOf("status", "todo", "doing", "done", "dropped")
		c.intRange("priority", 0, 4)
		if r["plan_scope"] != nil {
			c.oneOf("plan_scope", "day", "week", "month")
		}
		if (r["plan_scope"] == nil) != (r["plan_date"] == nil) {
			c.fail("23514", "items_plan_pair")
		}
		if d, ok := r["plan_date"].(string); ok && r["plan_scope"] == "month" && !strings.HasSuffix(d, "-01") {
			c.fail("23514", "items_plan_month_aligned")
		}
	case "time_entries":
		if r["ended_at"] != nil {
			start, err1 := instant(r["started_at"])
			end, err2 := instant(r["ended_at"])
			if err1 != nil || err2 != nil {
				c.fail("22P02", "time_entries: bad timestamp")
			} else if end.Before(start) {
				c.fail("23514", "time_entries_order")
			}
		}
		if r["planned_seconds"] != nil {
			c.intRange("planned_seconds", 60, 14400)
		}
	}
	return c.err
}

type checker struct {
	table string
	row   Row
	err   *RowError
}

func (c *checker) fail(code, format string, args ...any) {
	if c.err == nil {
		c.err = refuse(code, format, args...)
	}
}

// length counts characters, like Postgres char_length.
func (c *checker) length(k string, min, max int) {
	v, ok := c.row[k].(string)
	if !ok {
		if c.row[k] != nil {
			c.fail("22P02", "%s.%s must be text", c.table, k)
		}
		return
	}
	if n := utf8.RuneCountInString(v); n < min || n > max {
		c.fail("23514", "%s_%s_len", c.table, k)
	}
}

func (c *checker) intRange(k string, min, max int) {
	f, ok := c.row[k].(float64)
	if !ok || f != math.Trunc(f) {
		c.fail("22P02", "%s.%s must be an integer", c.table, k)
		return
	}
	if int(f) < min || int(f) > max {
		c.fail("23514", "%s_%s_range", c.table, k)
	}
}

func (c *checker) oneOf(k string, allowed ...string) {
	v, _ := c.row[k].(string)
	for _, a := range allowed {
		if v == a {
			return
		}
	}
	c.fail("23514", "%s_%s_valid", c.table, k)
}

// instant parses a JSON timestamp (any RFC 3339 form) to a time.
func instant(v any) (time.Time, error) {
	s, ok := v.(string)
	if !ok {
		return time.Time{}, fmt.Errorf("not a timestamp: %v", v)
	}
	return time.Parse(time.RFC3339Nano, s)
}
