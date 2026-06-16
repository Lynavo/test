package api

import (
	"fmt"
	"log/slog"
	"math/rand/v2"
	"net/http"
)

type setConnectionCodeRequest struct {
	Code string `json:"code"`
}

func isValidConnectionCode(code string) bool {
	if len(code) != 6 {
		return false
	}
	for _, ch := range code {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

func (s *Server) handleSetConnectionCode(w http.ResponseWriter, r *http.Request) {
	var req setConnectionCodeRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !isValidConnectionCode(req.Code) {
		writeError(w, http.StatusBadRequest, "connection code must be 6 digits")
		return
	}

	if err := s.store.SetConnectionCode(req.Code); err != nil {
		slog.Error("set connection code", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to set connection code")
		return
	}
	slog.Info("connection code set")

	writeJSON(w, http.StatusOK, map[string]string{
		"code": req.Code,
	})
}

func (s *Server) handleRegenerateCode(w http.ResponseWriter, _ *http.Request) {
	code := fmt.Sprintf("%06d", 100000+rand.IntN(900000))

	if err := s.store.SetConnectionCode(code); err != nil {
		slog.Error("rotate connection code", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to regenerate code")
		return
	}
	slog.Info("connection code regenerated")

	writeJSON(w, http.StatusOK, map[string]string{
		"code": code,
	})
}
