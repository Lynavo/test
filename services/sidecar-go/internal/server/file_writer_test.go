package server

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewFileWriterSeeksToResumeOffset(t *testing.T) {
	stagingDir := t.TempDir()
	clientID := "test-client"
	fileKey := "resume-file"

	partDir := filepath.Join(stagingDir, clientID)
	if err := os.MkdirAll(partDir, 0o755); err != nil {
		t.Fatalf("mkdir part dir: %v", err)
	}

	partPath := filepath.Join(partDir, fileKey+".part")
	firstHalf := []byte("hello-")
	if err := os.WriteFile(partPath, firstHalf, 0o644); err != nil {
		t.Fatalf("write part file: %v", err)
	}

	fw, err := NewFileWriter(stagingDir, clientID, fileKey, int64(len(firstHalf)+5))
	if err != nil {
		t.Fatalf("NewFileWriter: %v", err)
	}
	defer fw.Close()

	if fw.CommittedOffset() != int64(len(firstHalf)) {
		t.Fatalf("CommittedOffset() = %d, want %d", fw.CommittedOffset(), len(firstHalf))
	}

	if _, err := fw.WriteAt([]byte("world"), fw.CommittedOffset()); err != nil {
		t.Fatalf("WriteAt: %v", err)
	}

	if err := fw.ForceSync(); err != nil {
		t.Fatalf("ForceSync: %v", err)
	}
	if err := fw.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	content, err := os.ReadFile(partPath)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if got, want := string(content), "hello-world"; got != want {
		t.Fatalf("part content = %q, want %q", got, want)
	}
}
