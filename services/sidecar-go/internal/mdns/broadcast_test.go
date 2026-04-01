package mdns

import (
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func testConfig() BroadcastConfig {
	return BroadcastConfig{
		DeviceID:     "mac-7fae12c9",
		DeviceName:   "WorkStation-A",
		DeviceType:   "mac",
		DeviceIP:     "192.168.1.10",
		TCPPort:      39393,
		Proto:        2,
		ShareEnabled: true,
		ShareName:    "SyncFlow",
	}
}

func TestBoolToInt(t *testing.T) {
	if got := boolToInt(true); got != 1 {
		t.Errorf("boolToInt(true) = %d, want 1", got)
	}
	if got := boolToInt(false); got != 0 {
		t.Errorf("boolToInt(false) = %d, want 0", got)
	}
}

func TestBuildTXTRecords(t *testing.T) {
	cfg := testConfig()
	txt := BuildTXTRecords(cfg)

	expected := []string{
		"id=mac-7fae12c9",
		"name=WorkStation-A",
		"type=mac",
		"proto=2",
		"auth=code",
		"share=1",
		"shareName=SyncFlow",
		"ip=192.168.1.10",
	}

	if len(txt) != len(expected) {
		t.Fatalf("TXT record count = %d, want %d", len(txt), len(expected))
	}
	for i, want := range expected {
		if txt[i] != want {
			t.Errorf("TXT[%d] = %q, want %q", i, txt[i], want)
		}
	}
}

func TestBuildTXTRecords_ShareDisabled(t *testing.T) {
	cfg := testConfig()
	cfg.ShareEnabled = false

	txt := BuildTXTRecords(cfg)

	// Find the share entry and verify it is "0".
	found := false
	for _, entry := range txt {
		if entry == "share=0" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected share=0 in TXT records when ShareEnabled is false")
	}
}

func TestDeviceTypeForGOOS(t *testing.T) {
	if got := DeviceTypeForGOOS("windows"); got != "win" {
		t.Fatalf("DeviceTypeForGOOS(windows) = %q, want win", got)
	}
	if got := DeviceTypeForGOOS("darwin"); got != "mac" {
		t.Fatalf("DeviceTypeForGOOS(darwin) = %q, want mac", got)
	}
	if got := DeviceTypeForGOOS("linux"); got != "mac" {
		t.Fatalf("DeviceTypeForGOOS(linux) = %q, want mac fallback", got)
	}
}

func TestNewBroadcaster_ValidConfig(t *testing.T) {
	cfg := testConfig()

	// In CI / test environments the broadcast may fail due to network
	// restrictions, so we only verify it does not panic.  If it succeeds we
	// also exercise Shutdown.
	b, err := NewBroadcaster(cfg)
	if err != nil {
		t.Skipf("mDNS registration unavailable in this environment: %v", err)
	}
	defer b.Shutdown()
}

func TestShutdown_NilCmd(t *testing.T) {
	b := &Broadcaster{cmd: nil, server: nil}
	// Must not panic.
	b.Shutdown()
}

func TestSelectBroadcasterBackend(t *testing.T) {
	originalLookPath := lookPath
	defer func() { lookPath = originalLookPath }()

	lookPath = func(file string) (string, error) {
		if file != "dns-sd" {
			t.Fatalf("unexpected lookup target %q", file)
		}
		return `C:\Program Files\Bonjour\dns-sd.exe`, nil
	}

	backend, path := selectBroadcasterBackend("windows")
	if backend != backendDNSSD {
		t.Fatalf("backend = %q, want %q", backend, backendDNSSD)
	}
	if path != `C:\Program Files\Bonjour\dns-sd.exe` {
		t.Fatalf("path = %q, want Bonjour dns-sd.exe", path)
	}
}

func TestSelectBroadcasterBackendFallsBackWhenDNSSDUnavailable(t *testing.T) {
	originalLookPath := lookPath
	defer func() { lookPath = originalLookPath }()

	lookPath = func(string) (string, error) {
		return "", os.ErrNotExist
	}

	backend, path := selectBroadcasterBackend("linux")
	if backend != backendZeroconf {
		t.Fatalf("backend = %q, want %q", backend, backendZeroconf)
	}
	if path != "" {
		t.Fatalf("path = %q, want empty", path)
	}
}

func TestResolveDNSSDPathUsesEnvOverride(t *testing.T) {
	originalLookPath := lookPath
	originalExecutablePath := executablePath
	originalEnv := os.Getenv(dnsSDPathEnv)
	defer func() {
		lookPath = originalLookPath
		executablePath = originalExecutablePath
		_ = os.Setenv(dnsSDPathEnv, originalEnv)
	}()

	tempDir := t.TempDir()
	overridePath := tempDir + `\dns-sd.exe`
	if err := os.WriteFile(overridePath, []byte("test"), 0o644); err != nil {
		t.Fatalf("WriteFile() failed: %v", err)
	}

	lookPath = func(string) (string, error) {
		return "", os.ErrNotExist
	}
	executablePath = func() (string, error) {
		return "", os.ErrNotExist
	}
	if err := os.Setenv(dnsSDPathEnv, overridePath); err != nil {
		t.Fatalf("Setenv() failed: %v", err)
	}

	path, ok := resolveDNSSDPath("windows")
	if !ok {
		t.Fatal("expected env override to resolve dns-sd path")
	}
	if path != overridePath {
		t.Fatalf("path = %q, want %q", path, overridePath)
	}
}

func TestResolveDNSSDPathUsesAdjacentExecutable(t *testing.T) {
	originalLookPath := lookPath
	originalExecutablePath := executablePath
	originalEnv := os.Getenv(dnsSDPathEnv)
	defer func() {
		lookPath = originalLookPath
		executablePath = originalExecutablePath
		_ = os.Setenv(dnsSDPathEnv, originalEnv)
	}()

	tempDir := t.TempDir()
	adjacentPath := filepath.Join(tempDir, "dns-sd.exe")
	if err := os.WriteFile(adjacentPath, []byte("test"), 0o644); err != nil {
		t.Fatalf("WriteFile() failed: %v", err)
	}

	lookPath = func(string) (string, error) {
		return "", os.ErrNotExist
	}
	executablePath = func() (string, error) {
		return filepath.Join(tempDir, "syncflow-sidecar.exe"), nil
	}
	if err := os.Unsetenv(dnsSDPathEnv); err != nil {
		t.Fatalf("Unsetenv() failed: %v", err)
	}

	path, ok := resolveDNSSDPath("windows")
	if !ok {
		t.Fatal("expected adjacent executable directory to resolve dns-sd path")
	}
	if path != adjacentPath {
		t.Fatalf("path = %q, want %q", path, adjacentPath)
	}
}

func TestSupportsNativeDNSSD(t *testing.T) {
	if !supportsNativeDNSSD("darwin") {
		t.Fatal("expected darwin to support dns-sd")
	}
	if !supportsNativeDNSSD("windows") {
		t.Fatal("expected windows to support dns-sd")
	}
	if supportsNativeDNSSD("linux") {
		t.Fatal("expected linux to fall back to zeroconf")
	}
}

func TestServiceHostName(t *testing.T) {
	want := sanitizeHostName(mustHostname(t))
	if got := serviceHostName(BroadcastConfig{
		DeviceID:   "Windows Dev-01",
		DeviceName: "Ignored Name",
	}); got != want {
		t.Fatalf("serviceHostName() = %q, want %q", got, want)
	}
}

func mustHostname(t *testing.T) string {
	t.Helper()
	host, err := os.Hostname()
	if err != nil {
		t.Fatalf("os.Hostname() failed: %v", err)
	}
	return host
}

func sanitizeHostName(base string) string {
	var builder strings.Builder
	lastWasHyphen := false
	for _, r := range strings.ToLower(strings.TrimSpace(base)) {
		isAlphaNum := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if isAlphaNum {
			builder.WriteRune(r)
			lastWasHyphen = false
			continue
		}
		if !lastWasHyphen {
			builder.WriteByte('-')
			lastWasHyphen = true
		}
	}

	host := strings.Trim(builder.String(), "-")
	if host == "" {
		host = "syncflow-sidecar"
	}
	return host
}

func TestServiceIPs(t *testing.T) {
	if got := serviceIPs(BroadcastConfig{}); got != nil {
		t.Fatalf("serviceIPs() = %#v, want nil", got)
	}

	got := serviceIPs(BroadcastConfig{DeviceIP: "192.168.1.10"})
	if len(got) != 1 || got[0] != "192.168.1.10" {
		t.Fatalf("serviceIPs() = %#v, want [192.168.1.10]", got)
	}
}

func TestParseSyncFlowBroadcastPID(t *testing.T) {
	pid, ok := parseSyncFlowBroadcastPID("29320 dns-sd -R bloomingdeMacBook-Pro-Online _syncflow._tcp local. 39393 id=abc")
	if !ok {
		t.Fatal("expected syncflow dns-sd process to match")
	}
	if pid != 29320 {
		t.Fatalf("pid = %d, want 29320", pid)
	}
}

func TestParseSyncFlowBroadcastPID_WindowsCommandLine(t *testing.T) {
	line := `6576 C:\dev\SyncFlow\apps\desktop\resources\dns-sd.exe -R PS2021DFYQCEAF _syncflow._tcp local. 39393 id=c16752f3-c01d name=PS2021DFYQCEAF type=win proto=2 auth=code share=0 shareName=SyncFlow ip=192.168.0.1`
	pid, ok := parseSyncFlowBroadcastPID(line)
	if !ok {
		t.Fatal("expected Windows syncflow dns-sd process to match")
	}
	if pid != 6576 {
		t.Fatalf("pid = %d, want 6576", pid)
	}
}

func TestIsRFC1918(t *testing.T) {
	cases := []struct {
		ip   string
		want bool
	}{
		{"10.0.0.1", true},
		{"10.255.255.255", true},
		{"172.16.0.1", true},
		{"172.31.255.255", true},
		{"172.32.0.1", false},
		{"192.168.1.100", true},
		{"192.168.255.255", true},
		{"8.8.8.8", false},
		{"169.254.1.1", false},
	}
	for _, tc := range cases {
		ip := net.ParseIP(tc.ip).To4()
		if ip == nil {
			t.Fatalf("invalid IP in test: %s", tc.ip)
		}
		if got := isRFC1918(ip); got != tc.want {
			t.Errorf("isRFC1918(%s) = %v, want %v", tc.ip, got, tc.want)
		}
	}
}

func TestIPAddrScore(t *testing.T) {
	cases := []struct {
		ip        string
		wantAbove int // score must be > wantAbove
	}{
		{"192.168.1.1", 0},  // RFC1918 → positive score
		{"10.0.0.1", 0},     // RFC1918 → positive score
		{"8.8.8.8", 0},      // public but not APIPA → positive score
		{"169.254.1.1", -6}, // APIPA → negative score
	}
	for _, tc := range cases {
		ip := net.ParseIP(tc.ip).To4()
		if ip == nil {
			t.Fatalf("invalid IP: %s", tc.ip)
		}
		score := ipAddrScore(ip)
		if score <= tc.wantAbove {
			t.Errorf("ipAddrScore(%s) = %d, want > %d", tc.ip, score, tc.wantAbove)
		}
	}
	// APIPA must score strictly below any RFC1918 address
	apipa := net.ParseIP("169.254.1.1").To4()
	rfc := net.ParseIP("192.168.1.1").To4()
	if ipAddrScore(apipa) >= ipAddrScore(rfc) {
		t.Error("APIPA score must be lower than RFC1918 score")
	}
}

func TestIfaceScore_VirtualPenalised(t *testing.T) {
	virtualNames := []string{
		"vEthernet (Default Switch)", // Hyper-V
		"VMware Network Adapter VMnet1",
		"docker0",
		"VirtualBox Host-Only Network",
		"utun0",
		"awdl0",
	}
	for _, name := range virtualNames {
		iface := net.Interface{
			Name:  name,
			Flags: net.FlagUp | net.FlagMulticast,
		}
		if score := ifaceScore(iface); score >= 10 {
			t.Errorf("ifaceScore(%q) = %d, expected < 10 (penalised as virtual)", name, score)
		}
	}
}

func TestIfaceScore_PhysicalFavoured(t *testing.T) {
	physical := net.Interface{
		Name:  "Ethernet",
		Flags: net.FlagUp | net.FlagMulticast,
	}
	if score := ifaceScore(physical); score < 10 {
		t.Errorf("ifaceScore(Ethernet) = %d, expected >= 10", score)
	}
}

func TestGetLocalIPv4_ReturnsNonEmpty(t *testing.T) {
	ip := getLocalIPv4()
	if ip == "" {
		t.Skip("no suitable IPv4 address found in test environment")
	}
	if net.ParseIP(ip) == nil {
		t.Errorf("getLocalIPv4() = %q is not a valid IP", ip)
	}
	if net.ParseIP(ip).IsLoopback() {
		t.Errorf("getLocalIPv4() = %q must not be loopback", ip)
	}
}

// TestRoutedLocalIPv4 verifies that routedLocalIPv4 returns a non-loopback
// IPv4 address.  It is skipped in environments without a default route
// (e.g. some CI containers).
func TestRoutedLocalIPv4(t *testing.T) {
	ip, ok := routedLocalIPv4()
	if !ok {
		t.Skip("no default route available in this environment")
	}
	parsed := net.ParseIP(ip)
	if parsed == nil {
		t.Fatalf("routedLocalIPv4() = %q is not a valid IP", ip)
	}
	if parsed.IsLoopback() {
		t.Errorf("routedLocalIPv4() = %q must not be loopback", ip)
	}
	if parsed.IsUnspecified() {
		t.Errorf("routedLocalIPv4() = %q must not be unspecified", ip)
	}
}

func TestParseSyncFlowBroadcastPID_IgnoresOtherProcesses(t *testing.T) {
	cases := []string{
		"",
		"29320 /Applications/Other.app/Contents/MacOS/Other",
		"29320 dns-sd -R some-service _other._tcp local. 12345",
		"not-a-pid dns-sd -R bloom _syncflow._tcp local. 39393",
	}

	for _, input := range cases {
		if _, ok := parseSyncFlowBroadcastPID(input); ok {
			t.Fatalf("expected %q to be ignored", input)
		}
	}
}
