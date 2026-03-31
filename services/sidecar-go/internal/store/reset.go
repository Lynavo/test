package store

import "fmt"

// ResetState clears runtime-generated sync state while preserving settings and share configuration.
func (s *Store) ResetState() error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin reset state tx: %w", err)
	}

	tables := []string{
		"device_daily_stats",
		"uploads",
		"sessions",
		"paired_devices",
	}

	for _, table := range tables {
		if _, err := tx.Exec("DELETE FROM " + table); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("reset state table %s: %w", table, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit reset state tx: %w", err)
	}
	return nil
}
