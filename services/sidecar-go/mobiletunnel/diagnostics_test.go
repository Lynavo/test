package mobiletunnel

import (
	"strings"
	"testing"
)

func TestTakeDiagnosticsLogReturnsAndClearsBufferedLines(t *testing.T) {
	_ = TakeDiagnosticsLog()

	recordDiagnosticsLog("INFO", "mobile tunnel test event", "targetClientId", "desktop-1", "state", "connected")

	first := TakeDiagnosticsLog()
	if !strings.Contains(first, "level=INFO msg=\"mobile tunnel test event\"") {
		t.Fatalf("expected diagnostic event in first snapshot, got %q", first)
	}
	if !strings.Contains(first, "targetClientId=\"desktop-1\"") {
		t.Fatalf("expected structured field in first snapshot, got %q", first)
	}

	if second := TakeDiagnosticsLog(); second != "" {
		t.Fatalf("expected diagnostics buffer to be cleared, got %q", second)
	}
}
