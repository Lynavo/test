package mobiletunnel

import (
	"net"
	"testing"
)

func TestNAT64PrefixFromIPv4OnlyArpa(t *testing.T) {
	prefix := nat64PrefixFromIPv4OnlyArpa([]net.IPAddr{
		{IP: net.ParseIP("64:ff9b::c000:aa")},
	})

	if prefix == nil {
		t.Fatal("expected NAT64 prefix")
	}
	if got := prefix.IP.String(); got != "64:ff9b::" {
		t.Fatalf("prefix = %s, want 64:ff9b::", got)
	}
	if prefix.Length != 96 {
		t.Fatalf("prefix length = %d, want 96", prefix.Length)
	}
}

func TestNAT64PrefixFromIPv4OnlyArpa64BitPrefix(t *testing.T) {
	prefix := nat64PrefixFromIPv4OnlyArpa([]net.IPAddr{
		{IP: net.ParseIP("2001:db8:64:64:c0:0:aa00:0")},
	})

	if prefix == nil {
		t.Fatal("expected NAT64 prefix")
	}
	if got := prefix.IP.String(); got != "2001:db8:64:64::" {
		t.Fatalf("prefix = %s, want 2001:db8:64:64::", got)
	}
	if prefix.Length != 64 {
		t.Fatalf("prefix length = %d, want 64", prefix.Length)
	}
}

func TestSynthesizeNAT64Address(t *testing.T) {
	prefix := &nat64Prefix{IP: net.ParseIP("64:ff9b::").To16(), Length: 96}
	ipv4 := net.ParseIP("43.129.81.231").To4()

	synthesized := synthesizeNAT64Address(prefix, ipv4)

	if synthesized == nil {
		t.Fatal("expected synthesized IPv6")
	}
	if got := synthesized.String(); got != "64:ff9b::2b81:51e7" {
		t.Fatalf("synthesized = %s, want 64:ff9b::2b81:51e7", got)
	}
}

func TestSynthesizeNAT64Address64BitPrefix(t *testing.T) {
	prefix := &nat64Prefix{IP: net.ParseIP("2001:db8:64:64::").To16(), Length: 64}
	ipv4 := net.ParseIP("43.129.81.231").To4()

	synthesized := synthesizeNAT64Address(prefix, ipv4)

	if synthesized == nil {
		t.Fatal("expected synthesized IPv6")
	}
	if got := synthesized.String(); got != "2001:db8:64:64:2b:8151:e700:0" {
		t.Fatalf("synthesized = %s, want 2001:db8:64:64:2b:8151:e700:0", got)
	}
}

func TestNAT64PrefixRejectsNonIPv4OnlyArpaResult(t *testing.T) {
	prefix := nat64PrefixFromIPv4OnlyArpa([]net.IPAddr{
		{IP: net.ParseIP("2001:db8::1")},
	})

	if prefix != nil {
		t.Fatalf("prefix = %+v, want nil", prefix)
	}
}
