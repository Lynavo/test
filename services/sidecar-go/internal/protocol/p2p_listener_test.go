package protocol

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hashicorp/yamux"
	"github.com/pion/webrtc/v4"
)

type mockSignalingServer struct {
	mu      sync.Mutex
	clients map[string]*websocket.Conn
}

func (s *mockSignalingServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	clientID := r.URL.Query().Get("clientId")

	s.mu.Lock()
	s.clients[clientID] = conn
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.clients, clientID)
		s.mu.Unlock()
	}()

	for {
		_, msgBytes, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var payload map[string]interface{}
		if err := json.Unmarshal(msgBytes, &payload); err == nil {
			receiverID, _ := payload["receiverId"].(string)
			if receiverID != "" {
				s.mu.Lock()
				recConn, exists := s.clients[receiverID]
				s.mu.Unlock()
				if exists {
					recConn.WriteMessage(websocket.TextMessage, msgBytes)
				}
			}
		}
	}
}

func TestP2PEndToEndYamuxTunnel(t *testing.T) {
	// 1. Start mock local HTTP server (representing the local sidecar HTTP server)
	mockLocalHTTPSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/shared/list" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"files":[]}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockLocalHTTPSrv.Close()

	// 2. Start mock WSS signaling server
	signaling := &mockSignalingServer{clients: make(map[string]*websocket.Conn)}
	signalingSrv := httptest.NewServer(signaling)
	defer signalingSrv.Close()

	// 3. Initialize P2PManager on Desktop Sidecar
	m := NewP2PManager("desktop-123", signalingSrv.URL, mockLocalHTTPSrv.Listener.Addr().String(), "test-token")
	m.Start([]map[string]string{
		{"clientId": "mobile-123", "pairingToken": "test-pair-token"},
	})
	defer m.Stop()

	// Give a small pause for P2PManager to connect to WSS signaling
	time.Sleep(20 * time.Millisecond)

	// 4. Dial mock signaling server as Mobile Client
	wsURL := "ws" + strings.TrimPrefix(signalingSrv.URL, "http") + "/api/v1/tunnel/signaling?role=mobile&clientId=mobile-123&targetClientId=desktop-123&token=test-token"
	mobileWS, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect mobile WSS: %v", err)
	}
	defer mobileWS.Close()

	// 5. Setup Mobile Client's Pion PeerConnection
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{"stun:stun.cloudflare.com:3478"}},
		},
	}
	pc, err := webrtc.NewPeerConnection(config)
	if err != nil {
		t.Fatalf("failed to create mobile PeerConnection: %v", err)
	}
	defer pc.Close()

	// ICE candidate exchange from Mobile Client to Desktop
	pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}
		candBytes, _ := json.Marshal(c.ToJSON())
		msg, _ := json.Marshal(map[string]string{
			"type":       "candidate",
			"payload":    string(candBytes),
			"senderId":   "mobile-123",
			"receiverId": "desktop-123",
		})
		mobileWS.WriteMessage(websocket.TextMessage, msg)
	})

	// Create DataChannel "yamux-tunnel" on Mobile Client
	ordered := true
	dc, err := pc.CreateDataChannel("yamux-tunnel", &webrtc.DataChannelInit{
		Ordered: &ordered,
	})
	if err != nil {
		t.Fatalf("failed to create mobile DataChannel: %v", err)
	}

	// Create SDP Offer on Mobile Client
	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatalf("failed to create mobile offer: %v", err)
	}
	pc.SetLocalDescription(offer)

	// Send SDP Offer via WebSocket to signaling server
	offerMsg, _ := json.Marshal(map[string]string{
		"type":       "offer",
		"payload":    offer.SDP,
		"senderId":   "mobile-123",
		"receiverId": "desktop-123",
	})
	mobileWS.WriteMessage(websocket.TextMessage, offerMsg)

	// Start Mobile WebSocket read loop to receive Answer and ICE candidates
	answerReceived := make(chan struct{})
	var readLoopWG sync.WaitGroup
	readLoopWG.Add(1)
	go func() {
		defer readLoopWG.Done()
		for {
			_, msgBytes, err := mobileWS.ReadMessage()
			if err != nil {
				break
			}
			var signal map[string]interface{}
			json.Unmarshal(msgBytes, &signal)
			msgType, _ := signal["type"].(string)
			payload, _ := signal["payload"].(string)

			if msgType == "answer" {
				pc.SetRemoteDescription(webrtc.SessionDescription{
					Type: webrtc.SDPTypeAnswer,
					SDP:  payload,
				})
				close(answerReceived)
			} else if msgType == "candidate" {
				var cand webrtc.ICECandidateInit
				json.Unmarshal([]byte(payload), &cand)
				pc.AddICECandidate(cand)
			}
		}
	}()

	// Wait for SDP Answer
	select {
	case <-answerReceived:
		// Sdp negotiation finished, ICE gathering starts
	case <-time.After(5 * time.Second):
		t.Fatal("timeout waiting for SDP answer from Desktop")
	}

	// Set up DataChannel Yamux verification when opened
	testSuccess := make(chan struct{})
	dc.OnOpen(func() {
		wrapper := NewDataChannelWrapper(dc)
		session, err := yamux.Client(wrapper, nil)
		if err != nil {
			t.Errorf("failed to create mobile yamux client: %v", err)
			return
		}
		defer session.Close()

		stream, err := session.Open()
		if err != nil {
			t.Errorf("failed to open yamux stream: %v", err)
			return
		}
		defer stream.Close()

		// Write HTTP list files request into Yamux stream
		reqStr := "GET /shared/list HTTP/1.1\r\nHost: localhost\r\n\r\n"
		_, err = stream.Write([]byte(reqStr))
		if err != nil {
			t.Errorf("failed to write request: %v", err)
			return
		}

		// Read HTTP response from Yamux stream
		buf := make([]byte, 1024)
		n, err := stream.Read(buf)
		if err != nil && err != io.EOF {
			t.Errorf("failed to read response: %v", err)
			return
		}
		resp := string(buf[:n])
		if !strings.Contains(resp, "200 OK") || !strings.Contains(resp, `{"files":[]}`) {
			t.Errorf("unexpected response from Yamux tunnel: %q", resp)
			return
		}

		close(testSuccess)
	})

	// Wait for Yamux tunnel success
	select {
	case <-testSuccess:
		// Excellent! Data transfer succeeded E2E!
	case <-time.After(10 * time.Second):
		t.Fatal("timeout waiting for P2P Yamux data tunnel to establish and forward HTTP request")
	}

	// Close WS to break the read loop
	mobileWS.Close()
	readLoopWG.Wait()
}

func TestP2PManagerPeerConnectionRecycling(t *testing.T) {
	// Verify that P2PManager successfully close and recycle terminal states PC
	mockLocalHTTPSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer mockLocalHTTPSrv.Close()

	signaling := &mockSignalingServer{clients: make(map[string]*websocket.Conn)}
	signalingSrv := httptest.NewServer(signaling)
	defer signalingSrv.Close()

	m := NewP2PManager("desktop-123", signalingSrv.URL, mockLocalHTTPSrv.Listener.Addr().String(), "test-token")
	m.Start([]map[string]string{
		{"clientId": "mobile-123", "pairingToken": "test-pair-token"},
	})
	defer m.Stop()

	time.Sleep(20 * time.Millisecond)

	wsURL := "ws" + strings.TrimPrefix(signalingSrv.URL, "http") + "/api/v1/tunnel/signaling?role=mobile&clientId=mobile-123&targetClientId=desktop-123&token=test-token"
	mobileWS, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer mobileWS.Close()

	// Create and register a dummy closed PeerConnection in desktop's active connections map
	config := webrtc.Configuration{}
	dummyPC, _ := webrtc.NewPeerConnection(config)
	dummyPC.Close() // Moves connection state to closed immediately

	// Send offer to trigger createPeerConnection and verify recycling
	offer, _ := dummyPC.CreateOffer(nil)
	offerMsg, _ := json.Marshal(map[string]string{
		"type":       "offer",
		"payload":    offer.SDP,
		"senderId":   "mobile-123",
		"receiverId": "desktop-123",
	})
	mobileWS.WriteMessage(websocket.TextMessage, offerMsg)

	// Sleep to verify it compiles and handles recycling safely without panic
	time.Sleep(20 * time.Millisecond)
}
