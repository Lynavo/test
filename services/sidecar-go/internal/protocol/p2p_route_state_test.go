package protocol

import (
	"testing"

	"github.com/pion/webrtc/v4"
)

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
		{
			name:   "scoped ipv6 link local direct",
			local:  "fe80::1%utun3",
			remote: "fe80::2%utun4",
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

func TestSelectedICERouteClassifiesScopedIPv6LinkLocalReflexivePairs(t *testing.T) {
	pair := &webrtc.ICECandidatePair{
		Local: &webrtc.ICECandidate{
			Typ:      webrtc.ICECandidateTypeHost,
			Protocol: webrtc.ICEProtocolUDP,
			Address:  "fe80::1%utun3",
			Port:     50123,
		},
		Remote: &webrtc.ICECandidate{
			Typ:      webrtc.ICECandidateTypePrflx,
			Protocol: webrtc.ICEProtocolUDP,
			Address:  "fe80::2%utun4",
			Port:     49876,
		},
	}

	if got := selectedICERoute(pair); got != "link_local_reflexive" {
		t.Fatalf("expected link_local_reflexive route, got %q", got)
	}
}
