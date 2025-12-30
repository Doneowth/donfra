package study

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// Date is a custom type that handles date-only values (YYYY-MM-DD format).
// It unmarshals from JSON strings like "2025-04-13" and stores as time.Time in the database.
type Date struct {
	time.Time
}

const dateLayout = "2006-01-02"

// UnmarshalJSON handles both date-only strings ("2025-04-13") and RFC3339 timestamps.
func (d *Date) UnmarshalJSON(data []byte) error {
	// Remove quotes from JSON string
	str := string(data)
	if len(str) < 2 || str[0] != '"' || str[len(str)-1] != '"' {
		return fmt.Errorf("invalid date format: %s", str)
	}
	str = str[1 : len(str)-1]

	if str == "" {
		return nil
	}

	// Try parsing as date-only format first (YYYY-MM-DD)
	t, err := time.Parse(dateLayout, str)
	if err == nil {
		d.Time = t
		return nil
	}

	// Fallback to RFC3339 for backwards compatibility
	t, err = time.Parse(time.RFC3339, str)
	if err == nil {
		d.Time = t
		return nil
	}

	return fmt.Errorf("invalid date format: expected YYYY-MM-DD or RFC3339, got %s", str)
}

// MarshalJSON returns the date in YYYY-MM-DD format.
func (d Date) MarshalJSON() ([]byte, error) {
	if d.Time.IsZero() {
		return []byte("null"), nil
	}
	return []byte(fmt.Sprintf(`"%s"`, d.Time.Format(dateLayout))), nil
}

// Scan implements sql.Scanner interface for reading from database.
func (d *Date) Scan(value interface{}) error {
	if value == nil {
		d.Time = time.Time{}
		return nil
	}

	switch v := value.(type) {
	case time.Time:
		d.Time = v
		return nil
	case []byte:
		t, err := time.Parse(dateLayout, string(v))
		if err != nil {
			return err
		}
		d.Time = t
		return nil
	case string:
		t, err := time.Parse(dateLayout, v)
		if err != nil {
			return err
		}
		d.Time = t
		return nil
	default:
		return fmt.Errorf("cannot scan %T into Date", value)
	}
}

// Value implements driver.Valuer interface for writing to database.
func (d Date) Value() (driver.Value, error) {
	if d.Time.IsZero() {
		return nil, nil
	}
	return d.Time, nil
}
