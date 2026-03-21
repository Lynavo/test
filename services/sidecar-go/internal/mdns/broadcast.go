package mdns

import (
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
)

// BroadcastConfig holds the parameters for Bonjour/mDNS service registration.
type BroadcastConfig struct {
	DeviceID     string
	DeviceName   string
	DeviceType   string // "mac"
	TCPPort      int    // 39393
	Proto        int    // 2
	ShareEnabled bool
	ShareName    string
}

// Broadcaster wraps a dns-sd process that advertises _syncflow._tcp via macOS native Bonjour.
type Broadcaster struct {
	cmd *exec.Cmd
}

// BuildTXTRecords constructs the TXT record key-value pairs from config.
func BuildTXTRecords(cfg BroadcastConfig) []string {
	return []string{
		fmt.Sprintf("id=%s", cfg.DeviceID),
		fmt.Sprintf("name=%s", cfg.DeviceName),
		fmt.Sprintf("type=%s", cfg.DeviceType),
		fmt.Sprintf("proto=%d", cfg.Proto),
		"auth=code",
		fmt.Sprintf("share=%d", boolToInt(cfg.ShareEnabled)),
		fmt.Sprintf("shareName=%s", cfg.ShareName),
	}
}

// NewBroadcaster registers a _syncflow._tcp Bonjour service using macOS native dns-sd command.
// This is guaranteed compatible with Apple's NWBrowser on iOS.
func NewBroadcaster(cfg BroadcastConfig) (*Broadcaster, error) {
	txt := BuildTXTRecords(cfg)

	// Build dns-sd command: dns-sd -R <name> <type> <domain> <port> [TXT key=value ...]
	args := []string{"-R", cfg.DeviceName, "_syncflow._tcp", "local.", fmt.Sprintf("%d", cfg.TCPPort)}
	args = append(args, txt...)

	cmd := exec.Command("dns-sd", args...)
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("dns-sd start: %w", err)
	}

	slog.Info("bonjour broadcasting (dns-sd)",
		"service", "_syncflow._tcp",
		"port", cfg.TCPPort,
		"name", cfg.DeviceName,
		"txt", strings.Join(txt, ", "),
		"pid", cmd.Process.Pid,
	)
	return &Broadcaster{cmd: cmd}, nil
}

// Shutdown stops the dns-sd process.
func (b *Broadcaster) Shutdown() {
	if b != nil && b.cmd != nil && b.cmd.Process != nil {
		b.cmd.Process.Kill()
		b.cmd.Wait()
	}
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
