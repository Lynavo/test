package store_test

import (
	"path/filepath"
	"testing"

	"github.com/nicksyncflow/sidecar/internal/store"
)

func newPairingSecurityStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.New(filepath.Join(t.TempDir(), "sidecar.db"))
	if err != nil {
		t.Fatalf("store.New: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}

func TestPairingSecurityMigrationCreatesTablesAndIndexes(t *testing.T) {
	st := newPairingSecurityStore(t)

	for _, tableName := range []string{"pairing_attempts", "pairing_rate_limits", "blocked_pairing_clients"} {
		var count int
		if err := st.DB().QueryRow(
			"SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
			tableName,
		).Scan(&count); err != nil {
			t.Fatalf("query table %s: %v", tableName, err)
		}
		if count != 1 {
			t.Fatalf("expected table %s to exist", tableName)
		}
	}

	for _, indexName := range []string{
		"blocked_pairing_clients_active_unique",
		"pairing_attempts_recent_idx",
		"pairing_attempts_client_desktop_idx",
	} {
		var count int
		if err := st.DB().QueryRow(
			"SELECT count(*) FROM sqlite_master WHERE type = 'index' AND name = ?",
			indexName,
		).Scan(&count); err != nil {
			t.Fatalf("query index %s: %v", indexName, err)
		}
		if count != 1 {
			t.Fatalf("expected index %s to exist", indexName)
		}
	}
}

func TestBlockedPairingClientsActiveUniqueAllowsHistoricalClearedRows(t *testing.T) {
	st := newPairingSecurityStore(t)

	insertBlockedClient := func(blockedAt string, clearedAt *string) error {
		t.Helper()
		_, err := st.DB().Exec(
			`INSERT INTO blocked_pairing_clients (
				client_id,
				desktop_device_id,
				client_name,
				device_alias,
				platform,
				stable_device_id,
				last_ip,
				failed_attempts,
				blocked_at,
				last_attempt_at,
				reason,
				cleared_at,
				cleared_by
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			"client-a",
			"desktop-a",
			"iPhone",
			"Daily Phone",
			"ios",
			"stable-device-a",
			"192.168.1.20",
			5,
			blockedAt,
			blockedAt,
			"wrong_code_limit",
			clearedAt,
			nil,
		)
		return err
	}

	if err := insertBlockedClient("2026-06-10T09:00:00Z", nil); err != nil {
		t.Fatalf("insert active block: %v", err)
	}

	if err := insertBlockedClient("2026-06-10T09:01:00Z", nil); err == nil {
		t.Fatalf("expected duplicate active block to fail")
	}

	clearedAt := "2026-06-10T09:02:00Z"
	if err := insertBlockedClient("2026-06-10T08:00:00Z", &clearedAt); err != nil {
		t.Fatalf("insert historical cleared block: %v", err)
	}
}

func TestRecordPairingFailureBlocksOnFifthWrongCode(t *testing.T) {
	st := newPairingSecurityStore(t)
	meta := store.PairingClientMetadata{
		ClientID:        "phone-a",
		DesktopDeviceID: "desktop-1",
		ClientName:      "Nick iPhone",
		Platform:        "ios",
		IP:              "192.168.1.20",
	}

	for attempt := 1; attempt <= 4; attempt++ {
		result, err := st.RecordPairingFailure(meta, 5)
		if err != nil {
			t.Fatalf("RecordPairingFailure attempt %d: %v", attempt, err)
		}
		if result.Blocked {
			t.Fatalf("attempt %d should not block", attempt)
		}
		if result.FailedAttempts != attempt {
			t.Fatalf("attempt %d failed count = %d", attempt, result.FailedAttempts)
		}
		if result.RemainingAttempts != 5-attempt {
			t.Fatalf("attempt %d remaining = %d", attempt, result.RemainingAttempts)
		}
	}

	result, err := st.RecordPairingFailure(meta, 5)
	if err != nil {
		t.Fatalf("RecordPairingFailure fifth: %v", err)
	}
	if !result.Blocked || result.FailedAttempts != 5 || result.RemainingAttempts != 0 {
		t.Fatalf("unexpected fifth result: %+v", result)
	}

	block, err := st.GetActivePairingBlock("phone-a", "desktop-1")
	if err != nil {
		t.Fatalf("GetActivePairingBlock: %v", err)
	}
	if block == nil || block.FailedAttempts != 5 || block.Reason != "wrong_connection_code_limit" {
		t.Fatalf("unexpected block: %+v", block)
	}
}

func TestPairingBlockScopeIsClientAndDesktop(t *testing.T) {
	st := newPairingSecurityStore(t)
	for i := 0; i < 5; i++ {
		_, err := st.RecordPairingFailure(store.PairingClientMetadata{
			ClientID:        "phone-a",
			DesktopDeviceID: "desktop-1",
			ClientName:      "Nick iPhone",
			Platform:        "ios",
		}, 5)
		if err != nil {
			t.Fatalf("RecordPairingFailure: %v", err)
		}
	}

	if block, _ := st.GetActivePairingBlock("phone-a", "desktop-1"); block == nil {
		t.Fatal("expected phone-a to be blocked on desktop-1")
	}
	if block, _ := st.GetActivePairingBlock("phone-a", "desktop-2"); block != nil {
		t.Fatal("did not expect phone-a to be blocked on desktop-2")
	}
	if block, _ := st.GetActivePairingBlock("phone-b", "desktop-1"); block != nil {
		t.Fatal("did not expect phone-b to be blocked on desktop-1")
	}
}

func TestClearPairingBlockClearsRateLimitButDoesNotAuthorize(t *testing.T) {
	st := newPairingSecurityStore(t)
	meta := store.PairingClientMetadata{ClientID: "phone-a", DesktopDeviceID: "desktop-1", ClientName: "Nick iPhone"}
	for i := 0; i < 5; i++ {
		if _, err := st.RecordPairingFailure(meta, 5); err != nil {
			t.Fatalf("RecordPairingFailure: %v", err)
		}
	}

	if err := st.ClearPairingBlock("phone-a", "desktop-1"); err != nil {
		t.Fatalf("ClearPairingBlock: %v", err)
	}
	if block, _ := st.GetActivePairingBlock("phone-a", "desktop-1"); block != nil {
		t.Fatal("expected active block to be cleared")
	}

	result, err := st.RecordPairingFailure(meta, 5)
	if err != nil {
		t.Fatalf("RecordPairingFailure after clear: %v", err)
	}
	if result.FailedAttempts != 1 || result.Blocked {
		t.Fatalf("expected rate limit to restart after clear, got %+v", result)
	}

	if _, err := st.GetPairedDevice("phone-a"); err == nil {
		t.Fatal("clearing a block must not authorize a device")
	}
}

func TestPairingManagementListsActiveRowsAndRecentAttempts(t *testing.T) {
	st := newPairingSecurityStore(t)
	now := "2026-06-10T01:00:00Z"
	if err := st.UpsertPairedDevice(store.PairedDevice{
		ClientID:         "phone-a",
		ClientName:       "Nick iPhone",
		Platform:         "ios",
		PairingID:        "pairing-a",
		PairingTokenHash: "hash-a",
		CreatedAt:        now,
		LastSeenAt:       now,
	}); err != nil {
		t.Fatalf("UpsertPairedDevice: %v", err)
	}
	if err := st.RecordPairingAttempt(store.PairingClientMetadata{
		ClientID:        "phone-b",
		DesktopDeviceID: "desktop-1",
		ClientName:      "Blocked Phone",
		Platform:        "android",
		IP:              "192.168.1.30",
	}, store.PairingAttemptBlocked, "PAIRING_CLIENT_BLOCKED"); err != nil {
		t.Fatalf("RecordPairingAttempt: %v", err)
	}
	for i := 0; i < 5; i++ {
		if _, err := st.RecordPairingFailure(store.PairingClientMetadata{
			ClientID:        "phone-b",
			DesktopDeviceID: "desktop-1",
			ClientName:      "Blocked Phone",
			Platform:        "android",
			IP:              "192.168.1.30",
		}, 5); err != nil {
			t.Fatalf("RecordPairingFailure: %v", err)
		}
	}

	authorized, err := st.ListAuthorizedDevices()
	if err != nil {
		t.Fatalf("ListAuthorizedDevices: %v", err)
	}
	if len(authorized) != 1 || authorized[0].ClientID != "phone-a" {
		t.Fatalf("unexpected authorized list: %+v", authorized)
	}

	blocked, err := st.ListBlockedPairingClients()
	if err != nil {
		t.Fatalf("ListBlockedPairingClients: %v", err)
	}
	if len(blocked) != 1 || blocked[0].ClientID != "phone-b" {
		t.Fatalf("unexpected blocked list: %+v", blocked)
	}

	attempts, err := st.ListRecentPairingAttempts(50)
	if err != nil {
		t.Fatalf("ListRecentPairingAttempts: %v", err)
	}
	if len(attempts) == 0 || attempts[0].ClientID == "" {
		t.Fatalf("expected recent attempts, got %+v", attempts)
	}
}
