package share

import "testing"

func TestGetLocalIP_NonEmpty(t *testing.T) {
	ip := GetLocalIP()
	if ip == "" {
		t.Fatal("expected non-empty IP on macOS host")
	}
	t.Logf("local IP: %s", ip)
}

func TestDetect_ReturnsValidResult(t *testing.T) {
	result := Detect("/tmp/syncflow", "SyncFlow")

	// In a CI/test environment smbd is likely not running, so we expect
	// needs_manual_enable. On a dev Mac with File Sharing enabled, we
	// might get share_registered or ready. All are acceptable.
	validStatuses := map[Status]bool{
		StatusUnknown:           true,
		StatusNeedsManualEnable: true,
		StatusShareRegistered:   true,
		StatusReady:             true,
		StatusError:             true,
	}
	if !validStatuses[result.Status] {
		t.Errorf("unexpected status: %q", result.Status)
	}
	t.Logf("detect result: status=%s enabled=%v", result.Status, result.Enabled)
}

func TestDetect_NeedsManualEnable_WhenSmbdNotRunning(t *testing.T) {
	// On most test/CI environments smbd is not running, so this should return
	// needs_manual_enable. If SMB happens to be on, skip instead of failing.
	result := Detect("/tmp/syncflow", "SyncFlow")
	if result.Status != StatusNeedsManualEnable {
		t.Skipf("smbd appears to be running (status=%s); skipping", result.Status)
	}
	if result.Enabled {
		t.Error("expected enabled=false when smbd is not running")
	}
	if result.SmbURL != nil {
		t.Error("expected nil smbUrl when smbd is not running")
	}
}

func TestStatusConstants(t *testing.T) {
	// Verify the string values match spec definitions.
	tests := []struct {
		status Status
		want   string
	}{
		{StatusUnknown, "unknown"},
		{StatusNeedsManualEnable, "needs_manual_enable"},
		{StatusShareRegistered, "share_registered"},
		{StatusReady, "ready"},
		{StatusError, "error"},
	}
	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("Status %v: got %q, want %q", tc.status, string(tc.status), tc.want)
		}
	}
}
