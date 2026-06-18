package mobiletunnel

import (
	"testing"
	"time"

	"github.com/pion/webrtc/v4"
)

func TestCurrentSelectedICERouteTracksAndResetsRoute(t *testing.T) {
	resetCurrentSelectedICERoute()
	if got := CurrentSelectedICERoute(); got != "" {
		t.Fatalf("expected empty route before selection, got %q", got)
	}

	setCurrentSelectedICERoute("turn_relay")
	if got := CurrentSelectedICERoute(); got != "turn_relay" {
		t.Fatalf("expected turn_relay route, got %q", got)
	}

	resetCurrentSelectedICERoute()
	if got := CurrentSelectedICERoute(); got != "" {
		t.Fatalf("expected empty route after reset, got %q", got)
	}
}

func TestSelectedICERouteClassifiesIPv6AndLinkLocalHostPairs(t *testing.T) {
	tests := []struct {
		name   string
		local  string
		remote string
		want   string
	}{
		{
			name:   "lan ipv4 direct",
			local:  "172.16.20.108",
			remote: "172.16.20.97",
			want:   "lan_direct",
		},
		{
			name:   "global ipv6 direct",
			local:  "240e:476:bccc:3ddc:1cd1:4e38:76bd:745c",
			remote: "240e:476:bccc:3ddc:2c50:6952:3c19:13d1",
			want:   "ipv6_direct",
		},
		{
			name:   "link local direct",
			local:  "169.254.75.127",
			remote: "169.254.188.171",
			want:   "link_local_direct",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pair := &webrtc.ICECandidatePair{
				Local: &webrtc.ICECandidate{
					Typ:      webrtc.ICECandidateTypeHost,
					Protocol: webrtc.ICEProtocolUDP,
					Address:  tt.local,
					Port:     50123,
				},
				Remote: &webrtc.ICECandidate{
					Typ:      webrtc.ICECandidateTypeHost,
					Protocol: webrtc.ICEProtocolUDP,
					Address:  tt.remote,
					Port:     49876,
				},
			}

			if got := selectedICERoute(pair); got != tt.want {
				t.Fatalf("expected %s route, got %q", tt.want, got)
			}
		})
	}
}

func TestAppendConnectionStateDiagnosticArgsIncludesSelectedPairSnapshot(t *testing.T) {
	selectedAt := time.Date(2026, 6, 5, 16, 50, 58, 0, time.UTC)
	now := selectedAt.Add(8*time.Second + 250*time.Millisecond)
	connectedAt := selectedAt.Add(-2 * time.Second)
	pair := &webrtc.ICECandidatePair{
		Local: &webrtc.ICECandidate{
			Typ:      webrtc.ICECandidateTypeHost,
			Protocol: webrtc.ICEProtocolUDP,
			Address:  "fe80::1",
			Port:     50123,
		},
		Remote: &webrtc.ICECandidate{
			Typ:      webrtc.ICECandidateTypeSrflx,
			Protocol: webrtc.ICEProtocolUDP,
			Address:  "fe80::2",
			Port:     49876,
		},
	}

	args := appendConnectionStateDiagnosticArgs(
		nil,
		"connected",
		connectedAt,
		selectedPairSnapshot(pair, selectedAt),
		now,
	)
	values := argsToMap(args)

	if values["previousState"] != "connected" {
		t.Fatalf("expected previousState connected, got %#v", values["previousState"])
	}
	if values["connectedForMs"] != int64(10250) {
		t.Fatalf("expected connectedForMs 10250, got %#v", values["connectedForMs"])
	}
	if values["lastSelectedRoute"] != "direct_reflexive" {
		t.Fatalf("expected direct_reflexive route, got %#v", values["lastSelectedRoute"])
	}
	if values["lastSelectedLocalType"] != "host" || values["lastSelectedRemoteType"] != "srflx" {
		t.Fatalf("unexpected candidate types: %#v", values)
	}
	if values["lastSelectedLocalAddress"] != "fe80::1" || values["lastSelectedRemoteAddress"] != "fe80::2" {
		t.Fatalf("unexpected candidate addresses: %#v", values)
	}
	if values["selectedPairAgeMs"] != int64(8250) {
		t.Fatalf("expected selectedPairAgeMs 8250, got %#v", values["selectedPairAgeMs"])
	}
}

func argsToMap(args []any) map[string]any {
	values := make(map[string]any, len(args)/2)
	for i := 0; i+1 < len(args); i += 2 {
		key, ok := args[i].(string)
		if !ok {
			continue
		}
		values[key] = args[i+1]
	}
	return values
}
