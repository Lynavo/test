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

func TestDetectFromSharePoints_Ready_WhenNameAndPathMatch(t *testing.T) {
	result := detectFromSharePoints(
		"/Volumes/workspace/temp/syncFolwData",
		"SyncFlow",
		[]sharePoint{
			{Name: "SyncFlow", Path: "/Volumes/workspace/temp/syncFolwData", SMBShared: true},
		},
		"192.168.1.10",
	)

	if result.Status != StatusReady {
		t.Fatalf("expected ready, got %s", result.Status)
	}
	if !result.Enabled {
		t.Fatal("expected enabled=true")
	}
	if result.SmbURL == nil || *result.SmbURL != "smb://192.168.1.10/SyncFlow" {
		t.Fatalf("unexpected smb url: %v", result.SmbURL)
	}
}

func TestDetectFromSharePoints_Ready_WhenPathMatchesButNameDiffers(t *testing.T) {
	result := detectFromSharePoints(
		"/Volumes/workspace/temp/syncFolwData",
		"SyncFlow",
		[]sharePoint{
			{Name: "syncFolwData", Path: "/Volumes/workspace/temp/syncFolwData", SMBShared: true},
		},
		"192.168.1.10",
	)

	if result.Status != StatusReady {
		t.Fatalf("expected ready, got %s", result.Status)
	}
	if !result.Enabled {
		t.Fatal("expected enabled=true")
	}
	if result.SmbURL == nil || *result.SmbURL != "smb://192.168.1.10/syncFolwData" {
		t.Fatalf("unexpected smb url: %v", result.SmbURL)
	}
	if result.ShareName == nil || *result.ShareName != "syncFolwData" {
		t.Fatalf("unexpected share name: %v", result.ShareName)
	}
}

func TestDetectFromSharePoints_ShareRegistered_WhenOtherShareExistsButPathMismatch(t *testing.T) {
	result := detectFromSharePoints(
		"/Volumes/workspace/temp/syncFolwData",
		"SyncFlow",
		[]sharePoint{
			{Name: "OtherShare", Path: "/Users/example/Public", SMBShared: true},
		},
		"192.168.1.10",
	)

	if result.Status != StatusShareRegistered {
		t.Fatalf("expected share_registered, got %s", result.Status)
	}
	if !result.Enabled {
		t.Fatal("expected enabled=true")
	}
	if result.ShareName == nil || *result.ShareName != "OtherShare" {
		t.Fatalf("unexpected share name: %v", result.ShareName)
	}
}

func TestDetectFromSharePoints_NeedsManualEnable_WhenNoSMBShares(t *testing.T) {
	result := detectFromSharePoints(
		"/tmp/syncflow",
		"SyncFlow",
		[]sharePoint{
			{Name: "Public", Path: "/Users/example/Public", SMBShared: false},
		},
		"192.168.1.10",
	)

	if result.Status != StatusNeedsManualEnable {
		t.Fatalf("expected needs_manual_enable, got %s", result.Status)
	}
	if result.Enabled {
		t.Fatal("expected enabled=false")
	}
}

func TestParseSharePoints(t *testing.T) {
	output := `
			List of Share Points
name:		“blooming”的公共文件夹
path:		/Users/blooming/Public
	smb:	{
    		name:		“blooming”的公共文件夹
    		shared:	1
	}

name:		syncFolwData
path:		/Volumes/workspace/temp/syncFolwData
	smb:	{
    		name:		syncFolwData
    		shared:	1
	}
`
	shares := parseSharePoints(output)
	if len(shares) != 2 {
		t.Fatalf("expected 2 shares, got %d", len(shares))
	}
	if shares[1].Name != "syncFolwData" {
		t.Fatalf("unexpected share name: %q", shares[1].Name)
	}
	if shares[1].Path != "/Volumes/workspace/temp/syncFolwData" {
		t.Fatalf("unexpected share path: %q", shares[1].Path)
	}
	if !shares[1].SMBShared {
		t.Fatal("expected share to be smb-enabled")
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
