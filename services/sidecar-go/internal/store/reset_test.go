package store

import (
	"testing"
	"time"
)

func TestResetStateClearsRuntimeDataButPreservesConfig(t *testing.T) {
	s := newTestStore(t)

	if err := s.SetDeviceName("Desk Lab"); err != nil {
		t.Fatalf("SetDeviceName: %v", err)
	}
	if err := s.SetConnectionCode("482917"); err != nil {
		t.Fatalf("SetConnectionCode: %v", err)
	}

	validatedAt := "2026-03-31T10:00:00Z"
	shareErr := "share unavailable"
	if err := s.UpdateShareConfig(ShareConfig{
		ReceiveRoot:     "/tmp/LynavoDrive",
		ShareName:       "DeskShare",
		ShareURL:        "smb://desk/DeskShare",
		ShareStatus:     "error",
		LastValidatedAt: &validatedAt,
		LastError:       &shareErr,
	}); err != nil {
		t.Fatalf("UpdateShareConfig: %v", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.UpsertPairedDevice(PairedDevice{
		ClientID:         "client-1",
		ClientName:       "Phone",
		Platform:         "ios",
		PairingID:        "pair-1",
		PairingTokenHash: "hash-1",
		CreatedAt:        now,
		LastSeenAt:       now,
	}); err != nil {
		t.Fatalf("UpsertPairedDevice: %v", err)
	}
	if err := s.UpsertSession(Session{
		SessionID:  "session-1",
		ClientID:   "client-1",
		ClientName: "Phone",
		State:      "completed",
		StartedAt:  now,
		UpdatedAt:  now,
	}); err != nil {
		t.Fatalf("UpsertSession: %v", err)
	}
	if err := s.UpsertUpload(Upload{
		FileKey:          "file-1",
		ClientID:         "client-1",
		OriginalFilename: "IMG_0001.JPG",
		MediaType:        "image",
		FileSize:         123,
		Status:           "completed",
		CommittedBytes:   123,
		UpdatedAt:        now,
	}); err != nil {
		t.Fatalf("UpsertUpload: %v", err)
	}
	if err := s.UpsertDailyStats(DailyStats{
		StatDate:             "2026-03-31",
		ClientID:             "client-1",
		ClientNameSnapshot:   "Phone",
		FileCount:            1,
		TotalBytes:           123,
		ActiveTransmissionMs: 50,
		UpdatedAt:            now,
	}); err != nil {
		t.Fatalf("UpsertDailyStats: %v", err)
	}

	if err := s.ResetState(); err != nil {
		t.Fatalf("ResetState: %v", err)
	}

	for _, tc := range []struct {
		name  string
		query string
	}{
		{name: "paired_devices", query: "SELECT COUNT(*) FROM paired_devices"},
		{name: "sessions", query: "SELECT COUNT(*) FROM sessions"},
		{name: "uploads", query: "SELECT COUNT(*) FROM uploads"},
		{name: "device_daily_stats", query: "SELECT COUNT(*) FROM device_daily_stats"},
	} {
		var count int
		if err := s.DB().QueryRow(tc.query).Scan(&count); err != nil {
			t.Fatalf("count %s: %v", tc.name, err)
		}
		if count != 0 {
			t.Fatalf("expected %s to be empty, got %d rows", tc.name, count)
		}
	}

	deviceName, err := s.GetDeviceName()
	if err != nil {
		t.Fatalf("GetDeviceName: %v", err)
	}
	if deviceName != "Desk Lab" {
		t.Fatalf("expected device name to be preserved, got %q", deviceName)
	}

	connectionCode, err := s.GetConnectionCode()
	if err != nil {
		t.Fatalf("GetConnectionCode: %v", err)
	}
	if connectionCode != "482917" {
		t.Fatalf("expected connection code to be preserved, got %q", connectionCode)
	}

	shareConfig, err := s.GetShareConfig()
	if err != nil {
		t.Fatalf("GetShareConfig: %v", err)
	}
	if shareConfig.ReceiveRoot != "/tmp/LynavoDrive" {
		t.Fatalf("expected receive root to be preserved, got %q", shareConfig.ReceiveRoot)
	}
	if shareConfig.ShareName != "DeskShare" {
		t.Fatalf("expected share name to be preserved, got %q", shareConfig.ShareName)
	}
	if shareConfig.ShareURL != "smb://desk/DeskShare" {
		t.Fatalf("expected share url to be preserved, got %q", shareConfig.ShareURL)
	}
	if shareConfig.ShareStatus != "error" {
		t.Fatalf("expected share status to be preserved, got %q", shareConfig.ShareStatus)
	}
	if shareConfig.LastValidatedAt == nil || *shareConfig.LastValidatedAt != validatedAt {
		t.Fatalf("expected last validated time to be preserved, got %v", shareConfig.LastValidatedAt)
	}
	if shareConfig.LastError == nil || *shareConfig.LastError != shareErr {
		t.Fatalf("expected share error to be preserved, got %v", shareConfig.LastError)
	}
}
