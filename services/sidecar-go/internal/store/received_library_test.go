package store

import (
	"os"
	"path/filepath"
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

func TestReceivedLibraryForClientFiltersCompletedUploads(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Format(time.RFC3339)

	aliceUpload := sampleUpload("alice-file", "alice-phone")
	aliceUpload.OriginalFilename = "Alice.jpg"
	aliceUpload.Status = "completed"
	aliceUpload.CompletedAt = &now
	aliceUpload.UpdatedAt = now
	if err := s.UpsertUpload(aliceUpload); err != nil {
		t.Fatalf("UpsertUpload alice: %v", err)
	}

	bobUpload := sampleUpload("bob-file", "bob-phone")
	bobUpload.OriginalFilename = "Bob.jpg"
	bobUpload.Status = "completed"
	bobUpload.CompletedAt = &now
	bobUpload.UpdatedAt = now
	if err := s.UpsertUpload(bobUpload); err != nil {
		t.Fatalf("UpsertUpload bob: %v", err)
	}

	failedUpload := sampleUpload("alice-failed", "alice-phone")
	failedUpload.OriginalFilename = "AliceFailed.jpg"
	failedUpload.Status = "failed"
	failedUpload.CompletedAt = nil
	failedUpload.UpdatedAt = now
	if err := s.UpsertUpload(failedUpload); err != nil {
		t.Fatalf("UpsertUpload failed: %v", err)
	}

	allItems, err := s.ListReceivedLibrary("desktop-1")
	if err != nil {
		t.Fatalf("ListReceivedLibrary: %v", err)
	}
	if len(allItems) != 2 {
		t.Fatalf("desktop received library should include both completed uploads, got %d", len(allItems))
	}

	aliceItems, err := s.ListReceivedLibraryForClient("desktop-1", "alice-phone")
	if err != nil {
		t.Fatalf("ListReceivedLibraryForClient: %v", err)
	}
	if len(aliceItems) != 1 {
		t.Fatalf("mobile received library should include only alice completed uploads, got %d", len(aliceItems))
	}
	if aliceItems[0].ClientID != "alice-phone" || aliceItems[0].Filename != "Alice.jpg" {
		t.Fatalf("unexpected alice mobile received item: %+v", aliceItems[0])
	}
}

func TestReceivedLibraryMarksDeletedFiles(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Format(time.RFC3339)
	receiveDir := t.TempDir()
	availableRelPath := filepath.Join("client-1", "2026-06-22", "available.jpg")
	availableAbsPath := filepath.Join(receiveDir, availableRelPath)
	if err := os.MkdirAll(filepath.Dir(availableAbsPath), 0o755); err != nil {
		t.Fatalf("MkdirAll available file dir: %v", err)
	}
	if err := os.WriteFile(availableAbsPath, []byte("image"), 0o644); err != nil {
		t.Fatalf("WriteFile available file: %v", err)
	}

	availableUpload := sampleUpload("available-file", "client-1")
	availableUpload.OriginalFilename = "available.jpg"
	availableUpload.Status = "completed"
	availableUpload.CompletedAt = &now
	availableUpload.UpdatedAt = now
	availableUpload.FinalPath = &availableRelPath
	if err := s.UpsertUpload(availableUpload); err != nil {
		t.Fatalf("UpsertUpload available: %v", err)
	}

	deletedRelPath := filepath.Join("client-1", "2026-06-22", "deleted.jpg")
	deletedUpload := sampleUpload("deleted-file", "client-1")
	deletedUpload.OriginalFilename = "deleted.jpg"
	deletedUpload.Status = "completed"
	deletedUpload.CompletedAt = &now
	deletedUpload.UpdatedAt = now
	deletedUpload.FinalPath = &deletedRelPath
	if err := s.UpsertUpload(deletedUpload); err != nil {
		t.Fatalf("UpsertUpload deleted: %v", err)
	}

	legacyUpload := sampleUpload("legacy-file", "client-1")
	legacyUpload.OriginalFilename = "legacy.jpg"
	legacyUpload.Status = "completed"
	legacyUpload.CompletedAt = &now
	legacyUpload.UpdatedAt = now
	legacyUpload.FinalPath = nil
	if err := s.UpsertUpload(legacyUpload); err != nil {
		t.Fatalf("UpsertUpload legacy: %v", err)
	}

	items, err := s.ListReceivedLibraryWithReceiveDir("desktop-1", receiveDir)
	if err != nil {
		t.Fatalf("ListReceivedLibraryWithReceiveDir: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 received items, got %d", len(items))
	}
	byKey := map[string]ReceivedLibraryItem{}
	for _, item := range items {
		byKey[item.FileKey] = item
	}
	if byKey["available-file"].FileStatus != "available" {
		t.Fatalf("expected available fileStatus, got %+v", byKey["available-file"])
	}
	if byKey["deleted-file"].FileStatus != "deleted" {
		t.Fatalf("expected deleted fileStatus, got %+v", byKey["deleted-file"])
	}
	if byKey["legacy-file"].FileStatus != "available" {
		t.Fatalf("expected legacy fileStatus to stay available, got %+v", byKey["legacy-file"])
	}
}

func TestReceivedLibraryUsesFinalPathBasenameForDisplayFilename(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Format(time.RFC3339)
	receiveDir := t.TempDir()

	uploads := []struct {
		fileKey   string
		finalPath string
	}{
		{fileKey: "file-1", finalPath: filepath.Join("client-1", "2026-06-22", "part1.mp4")},
		{fileKey: "file-2", finalPath: filepath.Join("client-1", "2026-06-22", "part1_file-2.mp4")},
	}
	for _, fixture := range uploads {
		absPath := filepath.Join(receiveDir, fixture.finalPath)
		if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
			t.Fatalf("MkdirAll %s: %v", fixture.fileKey, err)
		}
		if err := os.WriteFile(absPath, []byte("video"), 0o644); err != nil {
			t.Fatalf("WriteFile %s: %v", fixture.fileKey, err)
		}

		upload := sampleUpload(fixture.fileKey, "client-1")
		upload.OriginalFilename = "part1.mp4"
		upload.MediaType = "video/mp4"
		upload.Status = "completed"
		upload.CompletedAt = &now
		upload.UpdatedAt = now
		upload.FinalPath = &fixture.finalPath
		if err := s.UpsertUpload(upload); err != nil {
			t.Fatalf("UpsertUpload %s: %v", fixture.fileKey, err)
		}
	}

	items, err := s.ListReceivedLibraryWithReceiveDir("desktop-1", receiveDir)
	if err != nil {
		t.Fatalf("ListReceivedLibraryWithReceiveDir: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 received items, got %d", len(items))
	}
	byKey := map[string]ReceivedLibraryItem{}
	for _, item := range items {
		byKey[item.FileKey] = item
	}
	if byKey["file-1"].Filename != "part1.mp4" {
		t.Fatalf("expected file-1 display filename part1.mp4, got %+v", byKey["file-1"])
	}
	if byKey["file-2"].Filename != "part1_file-2.mp4" {
		t.Fatalf("expected file-2 display filename part1_file-2.mp4, got %+v", byKey["file-2"])
	}
}

func TestListSyncRecordsIncludesCompletedAndFailedUploads(t *testing.T) {
	s := newTestStore(t)
	completedAt := "2026-06-15T10:00:00Z"
	failedAt := "2026-06-15T11:00:00Z"

	completed := sampleUpload("file-completed", "client-1")
	completed.OriginalFilename = "Completed.jpg"
	completed.Status = "completed"
	completed.CompletedAt = &completedAt
	completed.UpdatedAt = completedAt
	if err := s.UpsertUpload(completed); err != nil {
		t.Fatalf("UpsertUpload completed: %v", err)
	}

	failed := sampleUpload("file-failed", "client-1")
	failed.OriginalFilename = "Failed.jpg"
	failed.Status = "failed"
	failed.CompletedAt = nil
	failed.UpdatedAt = failedAt
	if err := s.UpsertUpload(failed); err != nil {
		t.Fatalf("UpsertUpload failed: %v", err)
	}

	records, err := s.ListSyncRecords("desktop-1", nil)
	if err != nil {
		t.Fatalf("ListSyncRecords: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("expected completed and failed records, got %d", len(records))
	}
	byKey := map[string]DesktopSyncRecord{}
	for _, record := range records {
		byKey[record.FileKey] = record
	}
	completedRecord := byKey["file-completed"]
	if completedRecord.Status != "completed" {
		t.Fatalf("expected completed status, got %q", completedRecord.Status)
	}
	if completedRecord.CompletedAt == nil || *completedRecord.CompletedAt != completedAt {
		t.Fatalf("expected completed_at %q, got %#v", completedAt, completedRecord.CompletedAt)
	}
	if completedRecord.FailedAt != nil {
		t.Fatalf("expected completed record failed_at nil, got %q", *completedRecord.FailedAt)
	}

	failedRecord := byKey["file-failed"]
	if failedRecord.Status != "failed" {
		t.Fatalf("expected failed status, got %q", failedRecord.Status)
	}
	if failedRecord.CompletedAt != nil {
		t.Fatalf("expected failed record completed_at nil, got %q", *failedRecord.CompletedAt)
	}
	if failedRecord.FailedAt == nil || *failedRecord.FailedAt != failedAt {
		t.Fatalf("expected failed_at %q, got %#v", failedAt, failedRecord.FailedAt)
	}
	if failedRecord.ErrorSummary != nil {
		t.Fatalf("expected failed record error summary nil, got %q", *failedRecord.ErrorSummary)
	}
}
