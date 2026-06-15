package store

import (
	"testing"
	"time"
)

func TestAccessRecordsScopedByDesktopAndClient(t *testing.T) {
	s := newTestStore(t)

	records := []AccessRecord{
		{
			DesktopDeviceID: "desktop-1",
			ClientID:        "client-1",
			ClientName:      stringPtr("Alice iPhone"),
			ResourceID:      "resource-1",
			ResourceKind:    "shared_file",
			ResourceName:    "Clip.mov",
			Action:          "list",
			Result:          "ok",
			AccessedAt:      time.Now().UTC().Format(time.RFC3339),
		},
		{
			DesktopDeviceID: "desktop-1",
			ClientID:        "client-1",
			ResourceID:      "resource-1",
			ResourceKind:    "shared_file",
			ResourceName:    "Clip.mov",
			Action:          "view",
			Result:          "ok",
			AccessedAt:      time.Now().UTC().Format(time.RFC3339),
		},
		{
			DesktopDeviceID: "desktop-1",
			ClientID:        "client-2",
			ResourceID:      "resource-1",
			ResourceKind:    "shared_file",
			ResourceName:    "Clip.mov",
			Action:          "download",
			Result:          "ok",
			AccessedAt:      time.Now().UTC().Format(time.RFC3339),
		},
		{
			DesktopDeviceID: "desktop-2",
			ClientID:        "client-1",
			ResourceID:      "resource-1",
			ResourceKind:    "shared_file",
			ResourceName:    "Clip.mov",
			Action:          "download",
			Result:          "ok",
			AccessedAt:      time.Now().UTC().Format(time.RFC3339),
		},
	}

	for i, record := range records {
		got, err := s.RecordAccess(record)
		if err != nil {
			t.Fatalf("RecordAccess #%d: %v", i+1, err)
		}
		if got.RecordID == "" {
			t.Fatalf("expected generated record id for record #%d", i+1)
		}
	}

	desktopRecords, err := s.ListAccessRecords("desktop-1", nil)
	if err != nil {
		t.Fatalf("ListAccessRecords desktop scope: %v", err)
	}
	if len(desktopRecords) != 3 {
		t.Fatalf("expected 3 desktop-1 records, got %d", len(desktopRecords))
	}

	clientID := "client-1"
	clientRecords, err := s.ListAccessRecords("desktop-1", &clientID)
	if err != nil {
		t.Fatalf("ListAccessRecords client scope: %v", err)
	}
	if len(clientRecords) != 2 {
		t.Fatalf("expected 2 desktop-1/client-1 records, got %d", len(clientRecords))
	}
	for _, record := range clientRecords {
		if record.DesktopDeviceID != "desktop-1" || record.ClientID != "client-1" {
			t.Fatalf("unexpected scoped record: %#v", record)
		}
	}
}
