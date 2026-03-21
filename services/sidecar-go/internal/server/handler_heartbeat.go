package server

import "github.com/nicksyncflow/sidecar/internal/protocol"

// handlePing responds to a PING frame with a PONG frame.
func (c *connection) handlePing() error {
	return protocol.WriteFrame(c.conn, protocol.TypePong, nil)
}
