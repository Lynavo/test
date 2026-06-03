package mobiletunnel

import "testing"

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
