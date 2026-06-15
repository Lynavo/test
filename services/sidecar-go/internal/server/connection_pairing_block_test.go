package server

import (
	"testing"

	"github.com/nicksyncflow/sidecar/internal/protocol"
)

func TestPairingWrongCodeBlocksAfterFiveAttemptsAndUnblockAllowsPairing(t *testing.T) {
	client, st, cfg, cleanup := setupTestConnection(t)
	defer cleanup()

	clientID := "blocked-client-001"
	clientName := "Blocked iPhone"

	for attempt := 1; attempt <= 5; attempt++ {
		if attempt > 1 {
			var cleanupConn func()
			client, cleanupConn = setupTestConnectionWithStore(t, st, cfg)
			defer cleanupConn()
		}

		sendJSON(t, client, protocol.TypeHelloReq, protocol.HelloReq{
			ClientID:                clientID,
			ClientName:              clientName,
			ClientPlatform:          "ios",
			AppVersion:              "1.0.0",
			AppCompatibilityVersion: protocol.AppCompatibilityVersion,
			AppState:                "active",
		})

		var helloRes protocol.HelloRes
		recvJSON(t, client, protocol.TypeHelloRes, &helloRes)
		if !helloRes.AuthRequired {
			t.Fatal("expected authRequired=true for unpaired device")
		}

		sendJSON(t, client, protocol.TypePairReq, protocol.PairReq{
			ClientID:       clientID,
			ClientName:     clientName,
			ConnectionCode: "000000",
		})

		var pairRes protocol.PairRes
		recvJSON(t, client, protocol.TypePairRes, &pairRes)
		if pairRes.OK {
			t.Fatal("expected PairRes.OK=false for wrong code")
		}
		if attempt < 5 {
			if pairRes.ErrorCode != "wrong_code" {
				t.Fatalf("attempt %d ErrorCode=%q, want wrong_code", attempt, pairRes.ErrorCode)
			}
			wantRemaining := 5 - attempt
			if pairRes.RemainingAttempts != wantRemaining {
				t.Fatalf("attempt %d RemainingAttempts=%d, want %d", attempt, pairRes.RemainingAttempts, wantRemaining)
			}
			if pairRes.Blocked {
				t.Fatalf("attempt %d Blocked=true, want false", attempt)
			}
			continue
		}

		if pairRes.ErrorCode != "blocked" {
			t.Fatalf("attempt %d ErrorCode=%q, want blocked", attempt, pairRes.ErrorCode)
		}
		if pairRes.RemainingAttempts != 0 {
			t.Fatalf("attempt %d RemainingAttempts=%d, want 0", attempt, pairRes.RemainingAttempts)
		}
		if !pairRes.Blocked {
			t.Fatal("expected blocked failure after fifth wrong code")
		}
	}

	desktopDeviceID, err := st.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID: %v", err)
	}

	blockedClient, cleanupBlocked := setupTestConnectionWithStore(t, st, cfg)
	defer cleanupBlocked()
	sendJSON(t, blockedClient, protocol.TypeHelloReq, protocol.HelloReq{
		ClientID:                clientID,
		ClientName:              clientName,
		ClientPlatform:          "ios",
		AppVersion:              "1.0.0",
		AppCompatibilityVersion: protocol.AppCompatibilityVersion,
		AppState:                "active",
	})

	var blockedErr protocol.ErrorMsg
	recvJSON(t, blockedClient, protocol.TypeError, &blockedErr)
	if blockedErr.Code != "DEVICE_BLOCKED" {
		t.Fatalf("blocked HELLO error code=%q, want DEVICE_BLOCKED", blockedErr.Code)
	}

	if err := st.UnblockDevice(desktopDeviceID, clientID); err != nil {
		t.Fatalf("UnblockDevice: %v", err)
	}

	unblockedClient, cleanupUnblocked := setupTestConnectionWithStore(t, st, cfg)
	defer cleanupUnblocked()
	sendJSON(t, unblockedClient, protocol.TypeHelloReq, protocol.HelloReq{
		ClientID:                clientID,
		ClientName:              clientName,
		ClientPlatform:          "ios",
		AppVersion:              "1.0.0",
		AppCompatibilityVersion: protocol.AppCompatibilityVersion,
		AppState:                "active",
	})

	var helloRes protocol.HelloRes
	recvJSON(t, unblockedClient, protocol.TypeHelloRes, &helloRes)
	if !helloRes.AuthRequired {
		t.Fatal("expected authRequired=true after unblock")
	}

	sendJSON(t, unblockedClient, protocol.TypePairReq, protocol.PairReq{
		ClientID:       clientID,
		ClientName:     clientName,
		ConnectionCode: testConnCode,
	})

	var pairRes protocol.PairRes
	recvJSON(t, unblockedClient, protocol.TypePairRes, &pairRes)
	if !pairRes.OK {
		t.Fatalf("expected pairing to succeed after unblock, error=%q code=%q", pairRes.Error, pairRes.ErrorCode)
	}
}
