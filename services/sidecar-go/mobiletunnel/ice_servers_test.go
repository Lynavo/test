package mobiletunnel

import "testing"

func TestParseICEServersJSONUsesProvidedTurnServers(t *testing.T) {
	servers := parseICEServersJSON(`[{"urls":["turn:review-api.vividrop.cn:3478?transport=udp"],"username":"u","credential":"p"}]`)

	if len(servers) != 1 {
		t.Fatalf("expected 1 ICE server, got %d", len(servers))
	}
	if got := servers[0].URLs[0]; got != "turn:review-api.vividrop.cn:3478?transport=udp" {
		t.Fatalf("unexpected ICE URL: %s", got)
	}
	if servers[0].Username != "u" || servers[0].Credential != "p" {
		t.Fatalf("unexpected TURN credentials: %#v", servers[0])
	}
}

func TestParseICEServersJSONFallsBackToDefaultStun(t *testing.T) {
	servers := parseICEServersJSON("")

	if len(servers) != 1 {
		t.Fatalf("expected default ICE server, got %d", len(servers))
	}
	if got := servers[0].URLs[0]; got != defaultSTUNServer {
		t.Fatalf("unexpected default ICE URL: %s", got)
	}
}
