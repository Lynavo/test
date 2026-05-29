package mobiletunnel

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hashicorp/yamux"
	"github.com/nicksyncflow/sidecar/internal/protocol"
	"github.com/pion/webrtc/v4"
)

type Tunnel struct {
	cancel     context.CancelFunc
	ctx        context.Context
	iceServers []webrtc.ICEServer
	listener   net.Listener
	pc         *webrtc.PeerConnection
	yamuxSess  *yamux.Session
	localPort  int
	readyChan  chan int
	mu         sync.Mutex
	isClosed   bool
	readyOnce  sync.Once
}

var (
	activeTunnel *Tunnel
	activeMu     sync.Mutex
)

const defaultSTUNServer = "stun:stun.cloudflare.com:3478"
const tunnelStartupTimeout = 20 * time.Second

type iceServerPayload struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username"`
	Credential string   `json:"credential"`
}

func parseICEServersJSON(raw string) []webrtc.ICEServer {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return defaultICEServers()
	}

	var payloads []iceServerPayload
	if err := json.Unmarshal([]byte(trimmed), &payloads); err != nil {
		slog.Warn("failed to parse ICE servers JSON, using default STUN", "err", err)
		return defaultICEServers()
	}

	servers := make([]webrtc.ICEServer, 0, len(payloads))
	for _, payload := range payloads {
		urls := make([]string, 0, len(payload.URLs))
		for _, rawURL := range payload.URLs {
			if url := strings.TrimSpace(rawURL); url != "" {
				urls = append(urls, url)
			}
		}
		if len(urls) == 0 {
			continue
		}
		servers = append(servers, webrtc.ICEServer{
			URLs:       urls,
			Username:   payload.Username,
			Credential: payload.Credential,
		})
	}

	if len(servers) == 0 {
		return defaultICEServers()
	}
	return servers
}

func defaultICEServers() []webrtc.ICEServer {
	return []webrtc.ICEServer{{URLs: []string{defaultSTUNServer}}}
}

// StartTunnel runs the WebRTC + Yamux tunnel and returns the local TCP port it listens on.
// If it fails, it returns -1.
func StartTunnel(signalingURL, clientID, targetClientID, token, pairingToken, iceServersJSON string) int {
	activeMu.Lock()
	defer activeMu.Unlock()

	if activeTunnel != nil {
		activeTunnel.Stop()
	}

	ctx, cancel := context.WithCancel(context.Background())
	t := &Tunnel{
		ctx:        ctx,
		cancel:     cancel,
		iceServers: parseICEServersJSON(iceServersJSON),
		readyChan:  make(chan int, 1),
	}
	activeTunnel = t

	port, err := t.start(signalingURL, clientID, targetClientID, token, pairingToken)
	if err != nil {
		slog.Error("failed to start mobile tunnel", "err", err)
		t.Stop()
		return -1
	}

	return port
}

// StopTunnel stops the currently running P2P tunnel.
func StopTunnel() {
	activeMu.Lock()
	defer activeMu.Unlock()

	if activeTunnel != nil {
		activeTunnel.Stop()
		activeTunnel = nil
	}
}

func (t *Tunnel) Stop() {
	t.mu.Lock()
	if t.isClosed {
		t.mu.Unlock()
		return
	}
	t.isClosed = true
	t.mu.Unlock()

	t.cancel()

	if t.listener != nil {
		t.listener.Close()
	}
	if t.yamuxSess != nil {
		t.yamuxSess.Close()
	}
	if t.pc != nil {
		t.pc.Close()
	}
}

func (t *Tunnel) start(signalingURL, clientID, targetClientID, token, pairingToken string) (int, error) {
	// 1. Start local TCP loopback listener
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return -1, err
	}
	t.listener = listener
	t.localPort = listener.Addr().(*net.TCPAddr).Port

	// 2. Start background thread to handle signaling and connection
	go t.runSignalingAndBridge(signalingURL, clientID, targetClientID, token, pairingToken)

	select {
	case port := <-t.readyChan:
		return port, nil
	case <-time.After(tunnelStartupTimeout):
		return -1, fmt.Errorf("tunnel startup timed out after %s", tunnelStartupTimeout)
	case <-t.ctx.Done():
		return -1, context.Canceled
	}
}

func (t *Tunnel) runSignalingAndBridge(signalingURL, clientID, targetClientID, token, pairingToken string) {
	wsURL := signalingURL
	if strings.HasPrefix(wsURL, "https://") {
		wsURL = "wss://" + strings.TrimPrefix(wsURL, "https://")
	} else if strings.HasPrefix(wsURL, "http://") {
		wsURL = "ws://" + strings.TrimPrefix(wsURL, "http://")
	}

	url := wsURL + "/api/v1/tunnel/signaling?role=mobile&clientId=" + clientID + "&targetClientId=" + targetClientID + "&pairingToken=" + pairingToken + "&token=" + token

	dialer := websocket.Dialer{HandshakeTimeout: 10 * time.Second}

	for {
		select {
		case <-t.ctx.Done():
			return
		default:
		}

		conn, _, err := dialer.Dial(url, nil)
		if err != nil {
			slog.Warn("mobile signaling dial failed, retrying in 5s", "err", err)
			select {
			case <-time.After(5 * time.Second):
				continue
			case <-t.ctx.Done():
				return
			}
		}

		t.mu.Lock()
		if t.isClosed {
			conn.Close()
			t.mu.Unlock()
			return
		}
		t.mu.Unlock()

		err = t.establishWebRTCTunnel(conn, clientID, targetClientID)
		conn.Close()

		if err != nil {
			slog.Error("WebRTC tunnel disconnected with error, reconnecting in 5s", "err", err)
			select {
			case <-time.After(5 * time.Second):
				continue
			case <-t.ctx.Done():
				return
			}
		}
	}
}

func (t *Tunnel) establishWebRTCTunnel(wsConn *websocket.Conn, clientID, targetClientID string) error {
	config := webrtc.Configuration{
		ICEServers: t.iceServers,
	}

	pc, err := webrtc.NewPeerConnection(config)
	if err != nil {
		return err
	}
	t.pc = pc
	defer pc.Close()

	// Handle ICE candidates from desktop
	pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}
		candBytes, err := json.Marshal(c.ToJSON())
		if err != nil {
			return
		}
		msg, _ := json.Marshal(map[string]string{
			"type":       "candidate",
			"payload":    string(candBytes),
			"senderId":   clientID,
			"receiverId": targetClientID,
		})
		wsConn.WriteMessage(websocket.TextMessage, msg)
	})

	ordered := true
	dc, err := pc.CreateDataChannel("yamux-tunnel", &webrtc.DataChannelInit{
		Ordered: &ordered,
	})
	if err != nil {
		return err
	}

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		return err
	}

	err = pc.SetLocalDescription(offer)
	if err != nil {
		return err
	}

	offerMsg, _ := json.Marshal(map[string]string{
		"type":       "offer",
		"payload":    offer.SDP,
		"senderId":   clientID,
		"receiverId": targetClientID,
	})
	err = wsConn.WriteMessage(websocket.TextMessage, offerMsg)
	if err != nil {
		return err
	}

	// Channel to signal tunnel completion or failure
	tunnelErrChan := make(chan error, 1)

	dc.OnOpen(func() {
		wrapper := protocol.NewDataChannelWrapper(dc)
		session, err := yamux.Client(wrapper, nil)
		if err != nil {
			tunnelErrChan <- err
			return
		}
		t.mu.Lock()
		t.yamuxSess = session
		t.mu.Unlock()
		t.signalReady()

		go func() {
			err := t.bridgeTCPToYamux(session)
			tunnelErrChan <- err
		}()
	})

	// Read loop for signaling messages (Answer & candidates)
	go func() {
		for {
			_, msgBytes, err := wsConn.ReadMessage()
			if err != nil {
				tunnelErrChan <- err
				return
			}
			var signal map[string]interface{}
			if err := json.Unmarshal(msgBytes, &signal); err != nil {
				continue
			}
			msgType, _ := signal["type"].(string)
			payload, _ := signal["payload"].(string)

			if msgType == "answer" {
				err = pc.SetRemoteDescription(webrtc.SessionDescription{
					Type: webrtc.SDPTypeAnswer,
					SDP:  payload,
				})
				if err != nil {
					tunnelErrChan <- err
					return
				}
			} else if msgType == "candidate" {
				var cand webrtc.ICECandidateInit
				if err := json.Unmarshal([]byte(payload), &cand); err == nil {
					pc.AddICECandidate(cand)
				}
			}
		}
	}()

	select {
	case <-t.ctx.Done():
		return nil
	case err := <-tunnelErrChan:
		return err
	}
}

func (t *Tunnel) signalReady() {
	t.readyOnce.Do(func() {
		select {
		case t.readyChan <- t.localPort:
		default:
		}
	})
}

func (t *Tunnel) bridgeTCPToYamux(session *yamux.Session) error {
	defer session.Close()

	for {
		localConn, err := t.listener.Accept()
		if err != nil {
			return err
		}

		select {
		case <-t.ctx.Done():
			localConn.Close()
			return nil
		default:
		}

		go func(tcpConn net.Conn) {
			defer tcpConn.Close()

			stream, err := session.Open()
			if err != nil {
				slog.Error("failed to open Yamux stream", "err", err)
				return
			}
			defer stream.Close()

			var wg sync.WaitGroup
			wg.Add(2)

			go func() {
				defer wg.Done()
				io.Copy(stream, tcpConn)
				stream.Close()
				tcpConn.Close()
			}()

			go func() {
				defer wg.Done()
				io.Copy(tcpConn, stream)
				stream.Close()
				tcpConn.Close()
			}()

			wg.Wait()
		}(localConn)
	}
}
