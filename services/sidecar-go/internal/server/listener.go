package server

import (
	"log/slog"
	"net"

	"github.com/nicksyncflow/sidecar/internal/config"
	"github.com/nicksyncflow/sidecar/internal/events"
	"github.com/nicksyncflow/sidecar/internal/store"
)

// TCPServer listens for incoming LMUP/2 connections from mobile clients.
type TCPServer struct {
	listener net.Listener
	store    *store.Store
	config   *config.Config
	hub      *events.Hub
}

// NewTCPServer creates a new TCPServer backed by the given store, config, and event hub.
func NewTCPServer(s *store.Store, cfg *config.Config, hub *events.Hub) *TCPServer {
	return &TCPServer{store: s, config: cfg, hub: hub}
}

// Start begins listening on addr and accepting connections in a background goroutine.
func (s *TCPServer) Start(addr string) error {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	s.listener = ln
	slog.Info("tcp server listening", "addr", addr)
	go s.acceptLoop()
	return nil
}

// Stop closes the listener, causing the accept loop to exit.
func (s *TCPServer) Stop() {
	if s.listener != nil {
		s.listener.Close()
	}
}

func (s *TCPServer) acceptLoop() {
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			slog.Debug("tcp accept stopped", "err", err)
			return
		}
		slog.Info("tcp client connected", "remote", conn.RemoteAddr())
		go newConnection(conn, s.store, s.config, s.hub).handle()
	}
}
