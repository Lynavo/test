package mdns

import (
	"fmt"
	"log/slog"

	"github.com/grandcat/zeroconf"
)

// BroadcastConfig holds the parameters for Bonjour/mDNS service registration.
type BroadcastConfig struct {
	DeviceID     string // e.g. "mac-7fae12c9"
	DeviceName   string // display name, used as mDNS instance name
	DeviceType   string // "mac"
	TCPPort      int    // 39393 — the LMUP TCP port, NOT the HTTP port
	Proto        int    // 2
	ShareEnabled bool
	ShareName    string // SMB share name, e.g. "SyncFlow"
}

// Broadcaster wraps a zeroconf server that advertises _syncflow._tcp on the LAN.
type Broadcaster struct {
	server *zeroconf.Server
}

// BuildTXTRecords constructs the TXT record key-value pairs from config.
// Exported so tests can verify the output without starting a real mDNS server.
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

// NewBroadcaster registers a _syncflow._tcp Bonjour service on the local network.
func NewBroadcaster(cfg BroadcastConfig) (*Broadcaster, error) {
	txt := BuildTXTRecords(cfg)

	server, err := zeroconf.Register(
		cfg.DeviceName,   // instance name
		"_syncflow._tcp", // service type
		"local.",         // domain
		cfg.TCPPort,      // port
		txt,              // TXT records
		nil,              // interfaces (nil = all)
	)
	if err != nil {
		return nil, fmt.Errorf("mdns register: %w", err)
	}

	slog.Info("bonjour broadcasting",
		"service", "_syncflow._tcp",
		"port", cfg.TCPPort,
		"name", cfg.DeviceName,
	)
	return &Broadcaster{server: server}, nil
}

// Shutdown stops the mDNS broadcast. Safe to call on a nil server.
func (b *Broadcaster) Shutdown() {
	if b.server != nil {
		b.server.Shutdown()
	}
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
