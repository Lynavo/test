package mdns

import (
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/grandcat/zeroconf"
)

const (
	serviceType     = "_syncflow._tcp"
	serviceDomain   = "local."
	backendDNSSD    = "dns-sd"
	backendZeroconf = "zeroconf"
	dnsSDPathEnv    = "SYNCFLOW_DNSSD_PATH"
)

var (
	lookPath               = exec.LookPath
	executablePath         = os.Executable
	bonjourServiceAvailable = defaultBonjourServiceAvailable
)

// BroadcastConfig holds the parameters for Bonjour/mDNS service registration.
type BroadcastConfig struct {
	DeviceID     string
	DeviceName   string
	DeviceType   string // "mac" | "win"
	DeviceIP     string
	TCPPort      int // 39393
	Proto        int // 2
	ShareEnabled bool
	ShareName    string
}

// Broadcaster wraps the active Bonjour publisher for the current platform.
type Broadcaster struct {
	cmd         *exec.Cmd
	server      *zeroconf.Server
	dnssdExited chan struct{} // closed when dns-sd process exits; nil for zeroconf
}

// BuildTXTRecords constructs the TXT record key-value pairs from config.
func BuildTXTRecords(cfg BroadcastConfig) []string {
	txt := []string{
		fmt.Sprintf("id=%s", cfg.DeviceID),
		fmt.Sprintf("name=%s", cfg.DeviceName),
		fmt.Sprintf("type=%s", cfg.DeviceType),
		fmt.Sprintf("proto=%d", cfg.Proto),
		"auth=code",
		fmt.Sprintf("share=%d", boolToInt(cfg.ShareEnabled)),
		fmt.Sprintf("shareName=%s", cfg.ShareName),
	}
	if cfg.DeviceIP != "" {
		txt = append(txt, fmt.Sprintf("ip=%s", cfg.DeviceIP))
	}
	return txt
}

// DeviceTypeForGOOS maps the current runtime to the discovery type consumed by
// the mobile device list.
func DeviceTypeForGOOS(goos string) string {
	if goos == "windows" {
		return "win"
	}
	return "mac"
}

// NewBroadcaster registers a _syncflow._tcp Bonjour service.
// macOS and Windows prefer dns-sd when available for parity with the Apple
// Bonjour stack used by iOS. Platforms without dns-sd fall back to zeroconf.
func NewBroadcaster(cfg BroadcastConfig) (*Broadcaster, error) {
	if cfg.DeviceIP == "" {
		cfg.DeviceIP = getLocalIPv4()
	}
	slog.Info("bonjour broadcaster ip selected", "ip", cfg.DeviceIP, "platform", runtime.GOOS)
	bonjourServiceOK := bonjourServiceAvailable()
	txt := BuildTXTRecords(cfg)

	backend, dnsSDPath := selectBroadcasterBackend(runtime.GOOS)
	if backend == backendDNSSD {
		if bonjourServiceOK {
			return newDNSSDBroadcaster(cfg, txt, dnsSDPath)
		}
		slog.Warn(
			"dns-sd binary found but Bonjour Service is not running; falling back to zeroconf",
			"path", dnsSDPath,
			"fix", "start Bonjour Service or reinstall Bonjour for Windows",
		)
	} else if supportsNativeDNSSD(runtime.GOOS) {
		slog.Warn(
			"dns-sd unavailable, falling back to zeroconf",
			"platform", runtime.GOOS,
			"hint", "install Bonjour for Windows or provide SYNCFLOW_DNSSD_PATH for best iOS discovery compatibility",
		)
	}
	return newCrossPlatformBroadcaster(cfg, txt)
}

func newDNSSDBroadcaster(cfg BroadcastConfig, txt []string, dnsSDPath string) (*Broadcaster, error) {
	if err := cleanupStaleBroadcastProcesses(); err != nil {
		slog.Warn("failed to clean stale bonjour broadcasts", "err", err)
	}

	args := []string{"-R", cfg.DeviceName, serviceType, serviceDomain, fmt.Sprintf("%d", cfg.TCPPort)}
	args = append(args, txt...)

	cmd := exec.Command(dnsSDPath, args...)
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("dns-sd start: %w", err)
	}

	// dns-sd -R is a long-lived process.  An exit within the grace period
	// means the Bonjour Service is unavailable — fall back to zeroconf.
	exited := make(chan struct{})
	var exitErr error
	go func() {
		exitErr = cmd.Wait()
		close(exited)
	}()

	select {
	case <-exited:
		slog.Warn("dns-sd exited immediately, falling back to zeroconf",
			"err", exitErr,
			"path", dnsSDPath,
			"hint", "ensure Bonjour Service is running",
		)
		return newCrossPlatformBroadcaster(cfg, txt)
	case <-time.After(1 * time.Second):
		// Still running — registration is active
	}

	slog.Info("bonjour broadcasting (dns-sd)",
		"service", serviceType,
		"port", cfg.TCPPort,
		"name", cfg.DeviceName,
		"path", dnsSDPath,
		"txt", strings.Join(txt, ", "),
		"pid", cmd.Process.Pid,
	)

	b := &Broadcaster{cmd: cmd, dnssdExited: exited}
	go func() {
		<-exited
		if exitErr != nil {
			slog.Warn("dns-sd process exited unexpectedly", "err", exitErr, "pid", cmd.Process.Pid)
		}
	}()
	return b, nil
}

func selectBroadcasterBackend(goos string) (backend string, dnsSDPath string) {
	if !supportsNativeDNSSD(goos) {
		return backendZeroconf, ""
	}

	if path, ok := resolveDNSSDPath(goos); ok {
		return backendDNSSD, path
	}

	return backendZeroconf, ""
}

func supportsNativeDNSSD(goos string) bool {
	return goos == "darwin" || goos == "windows"
}

func resolveDNSSDPath(goos string) (string, bool) {
	if !supportsNativeDNSSD(goos) {
		return "", false
	}

	for _, candidate := range runtimeDNSSDCandidates(goos) {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, true
		}
	}

	if path, err := lookPath("dns-sd"); err == nil {
		return path, true
	}

	for _, candidate := range dnsSDCandidates(goos) {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, true
		}
	}

	return "", false
}

func runtimeDNSSDCandidates(goos string) []string {
	if !supportsNativeDNSSD(goos) {
		return nil
	}

	var candidates []string
	if configuredPath := strings.TrimSpace(os.Getenv(dnsSDPathEnv)); configuredPath != "" {
		candidates = append(candidates, configuredPath)
	}

	if exePath, err := executablePath(); err == nil && strings.TrimSpace(exePath) != "" {
		candidates = append(candidates, filepath.Join(filepath.Dir(exePath), dnsSDExecutableName(goos)))
	}

	return candidates
}

func dnsSDExecutableName(goos string) string {
	if goos == "windows" {
		return "dns-sd.exe"
	}
	return "dns-sd"
}

func dnsSDCandidates(goos string) []string {
	if goos != "windows" {
		return nil
	}

	var candidates []string
	programRoots := []string{
		os.Getenv("ProgramFiles"),
		os.Getenv("ProgramFiles(x86)"),
	}
	for _, root := range programRoots {
		if strings.TrimSpace(root) == "" {
			continue
		}
		candidates = append(candidates,
			filepath.Join(root, "Bonjour", "dns-sd.exe"),
			filepath.Join(root, "Bonjour Print Services", "dns-sd.exe"),
		)
	}
	return candidates
}

func newCrossPlatformBroadcaster(cfg BroadcastConfig, txt []string) (*Broadcaster, error) {
	server, err := registerZeroconfService(cfg, txt)
	if err != nil {
		return nil, fmt.Errorf("zeroconf register: %w", err)
	}

	slog.Info("bonjour broadcasting (zeroconf)",
		"service", serviceType,
		"port", cfg.TCPPort,
		"name", cfg.DeviceName,
		"backend", backendZeroconf,
		"ip", cfg.DeviceIP,
		"host", serviceHostName(cfg),
		"txt", strings.Join(txt, ", "),
	)
	return &Broadcaster{server: server}, nil
}

func registerZeroconfService(cfg BroadcastConfig, txt []string) (*zeroconf.Server, error) {
	return zeroconf.RegisterProxy(
		cfg.DeviceName,
		serviceType,
		serviceDomain,
		cfg.TCPPort,
		serviceHostName(cfg),
		serviceIPs(cfg),
		txt,
		nil,
	)
}

// getLocalIPv4 returns the best-candidate IPv4 address for mDNS advertisement.
//
// Strategy (in order):
//  1. UDP dial trick — ask the OS routing table which source IP it would use
//     to reach an external address.  No packet is actually sent; this reliably
//     returns the IP of the default-route interface (the real LAN adapter)
//     even on machines with many virtual adapters (WSL, Docker, VPN, VMware).
//  2. Scored interface walk — prefer RFC-1918 addresses on physical, multicast-
//     capable interfaces and penalise known virtual adapters.
//  3. Legacy flat scan — simple fallback when net.Interfaces() is unavailable.
func getLocalIPv4() string {
	if ip, ok := routedLocalIPv4(); ok {
		return ip
	}

	ifaces, err := net.Interfaces()
	if err != nil {
		return legacyGetLocalIPv4()
	}

	bestIP := ""
	bestScore := -1000

	for _, iface := range ifaces {
		if !isUsableInterface(iface) {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		ifScore := ifaceScore(iface)
		for _, addr := range addrs {
			ip, ok := addrToIPv4(addr)
			if !ok {
				continue
			}
			score := ifScore + ipAddrScore(ip)
			if score > bestScore {
				bestScore = score
				bestIP = ip.String()
			}
		}
	}

	return bestIP
}

// routedLocalIPv4 asks the OS routing table for the preferred outbound source
// address by performing a UDP "connect" to a well-known external IP.  No
// packet is actually transmitted — the kernel merely selects the source
// interface.  This correctly ignores virtual adapters (WSL, Docker, VMware,
// VPN tunnels) because those are not on the default route.
//
// Results in the following special-use ranges are rejected and cause a
// fallback to the scored interface walk:
//   - 198.18.0.0/15: Apple iCloud Private Relay virtual interface (macOS)
//   - 100.64.0.0/10: CGNAT shared space used by Tailscale, carrier NAT, etc.
func routedLocalIPv4() (string, bool) {
	conn, err := net.Dial("udp4", "8.8.8.8:80")
	if err != nil {
		return "", false
	}
	defer conn.Close()
	addr, ok := conn.LocalAddr().(*net.UDPAddr)
	if !ok {
		return "", false
	}
	ip4 := addr.IP.To4()
	if ip4 == nil || ip4.IsLoopback() || ip4.IsUnspecified() || ip4.IsLinkLocalUnicast() {
		return "", false
	}
	if isSpecialUseIP(ip4) {
		slog.Debug("routedLocalIPv4: rejected special-use address, falling back to interface walk", "ip", ip4.String())
		return "", false
	}
	return ip4.String(), true
}

// isSpecialUseIP reports whether ip is in a range that should never be
// advertised as the LAN address for mDNS, even though it may be routable.
//
//	198.18.0.0/15 — RFC 2544 benchmarking; used by Apple iCloud Private Relay
//	100.64.0.0/10 — RFC 6598 shared address space (CGNAT, Tailscale, etc.)
func isSpecialUseIP(ip net.IP) bool {
	for _, block := range []struct {
		network net.IP
		mask    net.IPMask
	}{
		{net.IP{198, 18, 0, 0}, net.IPMask{255, 254, 0, 0}}, // 198.18.0.0/15
		{net.IP{100, 64, 0, 0}, net.IPMask{255, 192, 0, 0}}, // 100.64.0.0/10
	} {
		if ip.Mask(block.mask).Equal(block.network) {
			return true
		}
	}
	return false
}

func isUsableInterface(iface net.Interface) bool {
	return iface.Flags&net.FlagUp != 0 &&
		iface.Flags&net.FlagLoopback == 0 &&
		iface.Flags&net.FlagPointToPoint == 0
}

// ifaceScore returns a score for how suitable an interface is for LAN mDNS.
// Multicast-capable interfaces score higher; known virtual adapters score lower.
func ifaceScore(iface net.Interface) int {
	score := 0
	if iface.Flags&net.FlagMulticast != 0 {
		score += 10
	}
	name := strings.ToLower(iface.Name)
	for _, keyword := range []string{
		"vmware", "virtualbox", "vbox", "docker",
		"vethernet", "hyper-v",
		"utun", "tap", "awdl", "llw",
		"bridge", "pseudo",
	} {
		if strings.Contains(name, keyword) {
			score -= 20
			break
		}
	}
	return score
}

// ipAddrScore prefers RFC-1918 addresses over special-use and APIPA ranges.
func ipAddrScore(ip net.IP) int {
	if ip.IsLinkLocalUnicast() {
		// 169.254.x.x — APIPA: adapter has no DHCP lease, unreliable for LAN
		return -5
	}
	if isSpecialUseIP(ip) {
		// 198.18/15 (iCloud Private Relay) or 100.64/10 (CGNAT/Tailscale)
		return -10
	}
	if isRFC1918(ip) {
		return 5
	}
	return 1
}

func addrToIPv4(addr net.Addr) (net.IP, bool) {
	ipnet, ok := addr.(*net.IPNet)
	if !ok {
		return nil, false
	}
	ip4 := ipnet.IP.To4()
	if ip4 == nil || ip4.IsLoopback() {
		return nil, false
	}
	return ip4, true
}

func isRFC1918(ip net.IP) bool {
	for _, block := range []struct {
		network net.IP
		mask    net.IPMask
	}{
		{net.IP{10, 0, 0, 0}, net.IPMask{255, 0, 0, 0}},
		{net.IP{172, 16, 0, 0}, net.IPMask{255, 240, 0, 0}},
		{net.IP{192, 168, 0, 0}, net.IPMask{255, 255, 0, 0}},
	} {
		if ip.Mask(block.mask).Equal(block.network) {
			return true
		}
	}
	return false
}

// legacyGetLocalIPv4 is a simple fallback used when net.Interfaces() fails.
func legacyGetLocalIPv4() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	for _, addr := range addrs {
		ipnet, ok := addr.(*net.IPNet)
		if !ok || ipnet.IP.IsLoopback() {
			continue
		}
		if ip4 := ipnet.IP.To4(); ip4 != nil {
			return ip4.String()
		}
	}
	return ""
}

// defaultBonjourServiceAvailable checks whether the Bonjour mDNS responder
// is available on the current platform.  On non-Windows it always returns
// true because macOS ships with mDNSResponder as a system daemon.
// The function is assigned to the bonjourServiceAvailable variable so tests
// can inject a deterministic answer.
func defaultBonjourServiceAvailable() bool {
	if runtime.GOOS != "windows" {
		return true
	}
	out, err := exec.Command("sc", "query", "Bonjour Service").Output()
	if err != nil {
		slog.Debug("windows bonjour service query failed", "err", err)
		return false
	}
	running := strings.Contains(string(out), "RUNNING")
	if !running {
		slog.Warn(
			"Bonjour Service is not running on Windows",
			"fix", "open Services.msc, start 'Bonjour Service', or reinstall Bonjour for Windows",
		)
	}
	return running
}

func serviceHostName(cfg BroadcastConfig) string {
	base, err := os.Hostname()
	if err != nil || strings.TrimSpace(base) == "" {
		base = cfg.DeviceName
	}
	if strings.TrimSpace(base) == "" {
		base = "syncflow-sidecar"
	}

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

func serviceIPs(cfg BroadcastConfig) []string {
	if strings.TrimSpace(cfg.DeviceIP) == "" {
		return nil
	}
	return []string{cfg.DeviceIP}
}

// Shutdown stops the active Bonjour publisher.
func (b *Broadcaster) Shutdown() {
	if b == nil {
		return
	}
	if b.server != nil {
		b.server.Shutdown()
	}
	if b.cmd != nil && b.cmd.Process != nil {
		b.cmd.Process.Kill()
		if b.dnssdExited != nil {
			<-b.dnssdExited // wait for the monitor goroutine to finish cmd.Wait()
		}
	}
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func cleanupStaleBroadcastProcesses() error {
	if runtime.GOOS != "darwin" && runtime.GOOS != "windows" {
		return nil
	}

	out, err := listBroadcastProcesses()
	if err != nil {
		return fmt.Errorf("list processes: %w", err)
	}

	for _, line := range strings.Split(string(out), "\n") {
		pid, ok := parseSyncFlowBroadcastPID(line)
		if !ok {
			continue
		}
		if killErr := terminateBroadcastProcess(pid); killErr != nil {
			slog.Warn("failed to terminate stale dns-sd broadcast", "pid", pid, "err", killErr)
			continue
		}
		slog.Info("terminated stale dns-sd broadcast", "pid", pid)
	}

	return nil
}

func parseSyncFlowBroadcastPID(line string) (int, bool) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return 0, false
	}

	fields := strings.Fields(trimmed)
	if len(fields) < 2 {
		return 0, false
	}

	command := strings.Join(fields[1:], " ")
	if !(strings.Contains(command, "dns-sd -R") || strings.Contains(command, "dns-sd.exe -R")) ||
		!strings.Contains(command, "_syncflow._tcp") ||
		!strings.Contains(command, "local.") {
		return 0, false
	}

	pid, err := strconv.Atoi(fields[0])
	if err != nil {
		return 0, false
	}
	return pid, true
}

func listBroadcastProcesses() ([]byte, error) {
	if runtime.GOOS == "windows" {
		script := `$processes = Get-CimInstance Win32_Process -Filter "Name='dns-sd.exe'" -ErrorAction SilentlyContinue; foreach ($process in $processes) { "$($process.ProcessId) $($process.CommandLine)" }`
		return exec.Command("powershell.exe", "-NoProfile", "-Command", script).Output()
	}

	return exec.Command("ps", "-axo", "pid=,command=").Output()
}

func terminateBroadcastProcess(pid int) error {
	if runtime.GOOS == "windows" {
		return exec.Command("taskkill", "/PID", strconv.Itoa(pid), "/T", "/F").Run()
	}

	return exec.Command("kill", strconv.Itoa(pid)).Run()
}
