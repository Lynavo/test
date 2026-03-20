package api

import (
	"encoding/json"
	"net/http"
)

type Router struct{}

func NewRouter() http.Handler {
	r := &Router{}
	mux := http.NewServeMux()

	mux.HandleFunc("/health", r.handleHealth)
	mux.HandleFunc("/dashboard/summary", r.handleDashboardSummary)
	mux.HandleFunc("/settings/share", r.handleShareStatus)
	mux.HandleFunc("/events/stream", r.handleEventStream)

	return mux
}

func (r *Router) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"service": "syncflow-sidecar",
	})
}

func (r *Router) handleDashboardSummary(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"todayUploadCount":   0,
		"todayOccupiedBytes": 0,
		"remainingBytes":     0,
		"isDiskLow":          false,
	})
}

func (r *Router) handleShareStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled": false,
		"smbUrl":  nil,
	})
}

func (r *Router) handleEventStream(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusNotImplemented)
	_, _ = w.Write([]byte("TODO: implement SSE or WebSocket stream"))
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
