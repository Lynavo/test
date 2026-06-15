package store

import (
	"testing"
	"time"
)

func TestReceivedLibraryUsesCompletedUploadsAndShareState(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Format(time.RFC3339)

	upload := sampleUpload("file-1", "client-1")
	upload.OriginalFilename = "IMG_9001.jpg"
	upload.MediaType = "image/jpeg"
	upload.FileSize = 4096
	upload.Status = "completed"
	upload.CompletedAt = &now
	upload.UpdatedAt = now
	if err := s.UpsertUpload(upload); err != nil {
		t.Fatalf("UpsertUpload: %v", err)
	}

	items, err := s.ListReceivedLibrary("desktop-1")
	if err != nil {
		t.Fatalf("ListReceivedLibrary not shared: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 received item, got %d", len(items))
	}
	if items[0].ShareStatus != "not_shared" {
		t.Fatalf("expected not_shared, got %q", items[0].ShareStatus)
	}
	if items[0].ResourceID != "" {
		t.Fatalf("expected no resource id for not_shared item, got %q", items[0].ResourceID)
	}

	shared, err := s.AddSharedResource(SharedResourceInput{
		DesktopDeviceID: "desktop-1",
		Kind:            "received_file",
		DisplayName:     "IMG_9001.jpg",
		ReceivedFileKey: stringPtr("file-1"),
		FileSize:        int64Ptr(4096),
		MediaType:       stringPtr("image/jpeg"),
		Status:          "available",
	})
	if err != nil {
		t.Fatalf("AddSharedResource received_file: %v", err)
	}

	items, err = s.ListReceivedLibrary("desktop-1")
	if err != nil {
		t.Fatalf("ListReceivedLibrary shared: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 received item after share, got %d", len(items))
	}
	if items[0].ShareStatus != "shared" {
		t.Fatalf("expected shared, got %q", items[0].ShareStatus)
	}
	if items[0].ResourceID != shared.ResourceID {
		t.Fatalf("expected shared resource id %q, got %q", shared.ResourceID, items[0].ResourceID)
	}
}
