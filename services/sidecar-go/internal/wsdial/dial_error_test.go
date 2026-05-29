package wsdial

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestDescribeDialFailureIncludesStatusAndBody(t *testing.T) {
	resp := &http.Response{
		Status:     "401 Unauthorized",
		StatusCode: http.StatusUnauthorized,
		Body:       io.NopCloser(strings.NewReader(`{"error":"invalid signaling token"}`)),
	}

	got := DescribeDialFailure(io.EOF, resp)
	if got == nil {
		t.Fatal("expected error detail")
	}

	msg := got.Error()
	if !strings.Contains(msg, "EOF") {
		t.Fatalf("expected original error in message, got %q", msg)
	}
	if !strings.Contains(msg, "status=401 Unauthorized") {
		t.Fatalf("expected status in message, got %q", msg)
	}
	if !strings.Contains(msg, `body={"error":"invalid signaling token"}`) {
		t.Fatalf("expected body in message, got %q", msg)
	}
}

func TestDescribeDialFailureTruncatesLongBody(t *testing.T) {
	resp := &http.Response{
		Status:     "403 Forbidden",
		StatusCode: http.StatusForbidden,
		Body:       io.NopCloser(strings.NewReader(strings.Repeat("a", 600))),
	}

	got := DescribeDialFailure(io.EOF, resp)
	if got == nil {
		t.Fatal("expected error detail")
	}

	msg := got.Error()
	if !strings.Contains(msg, "status=403 Forbidden") {
		t.Fatalf("expected status in message, got %q", msg)
	}
	if !strings.Contains(msg, "body=") || !strings.Contains(msg, "...") {
		t.Fatalf("expected truncated body in message, got %q", msg)
	}
}
