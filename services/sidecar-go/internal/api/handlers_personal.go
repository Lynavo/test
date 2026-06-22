package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/nicksyncflow/sidecar/internal/events"
	"github.com/nicksyncflow/sidecar/internal/runtimefs"
)

const devSandboxAuthBaseURL = "dev-sandbox://auth"
const devSandboxAccessTokenPrefix = "mock-sandbox-access-token:"
const devSandboxAccountID = "99999"

func (s *Server) setDesktopAuthContext(accountID string, authBaseURL string) {
	s.accountMu.Lock()
	defer s.accountMu.Unlock()
	s.desktopAccountID = strings.TrimSpace(accountID)
	s.authBaseURL = strings.TrimRight(strings.TrimSpace(authBaseURL), "/")
}

func (s *Server) getDesktopAuthContext() (string, string) {
	s.accountMu.RLock()
	defer s.accountMu.RUnlock()
	return s.desktopAccountID, s.authBaseURL
}

func (s *Server) authorizePersonalRequest(w http.ResponseWriter, r *http.Request) bool {
	_, ok := s.authorizePersonalRequestAccountID(w, r)
	return ok
}

func (s *Server) authorizePersonalRequestAccountID(w http.ResponseWriter, r *http.Request) (string, bool) {
	remoteAccessEnabled := true
	if val, err := s.store.GetSetting("remote_access_enabled"); err == nil {
		remoteAccessEnabled = (val == "true")
	}
	if !remoteAccessEnabled {
		writeError(w, http.StatusForbidden, "remote access is disabled")
		return "", false
	}

	desktopAccountID, authBaseURL := s.getDesktopAuthContext()
	if desktopAccountID == "" || authBaseURL == "" {
		writeError(w, http.StatusUnauthorized, "desktop account identity is unavailable")
		return "", false
	}

	accessToken, err := requestAccessToken(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "account bearer token is required")
		return "", false
	}

	mobileAccountID, err := s.verifyAccessTokenAccountID(r.Context(), authBaseURL, accessToken)
	if err != nil || mobileAccountID == "" {
		writeError(w, http.StatusUnauthorized, "account bearer token is invalid")
		return "", false
	}
	if mobileAccountID != desktopAccountID {
		writeError(w, http.StatusForbidden, "account mismatch")
		return "", false
	}

	return desktopAccountID, true
}

func requestAccessToken(r *http.Request) (string, error) {
	if token, err := bearerAccessToken(r.Header.Get("Authorization")); err == nil && token != "" {
		return token, nil
	}
	token := strings.TrimSpace(r.URL.Query().Get("access_token"))
	if token == "" {
		return "", fmt.Errorf("missing bearer token")
	}
	return token, nil
}

func bearerAccessToken(authorization string) (string, error) {
	const prefix = "Bearer "
	if !strings.HasPrefix(authorization, prefix) {
		return "", fmt.Errorf("missing bearer token")
	}
	token := strings.TrimSpace(strings.TrimPrefix(authorization, prefix))
	if token == "" {
		return "", fmt.Errorf("missing bearer token")
	}
	return token, nil
}

func (s *Server) verifyAccessTokenAccountID(ctx context.Context, authBaseURL string, accessToken string) (string, error) {
	if isDevSandboxAuthBaseURL(authBaseURL) {
		return devSandboxAccessTokenAccountID(accessToken)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, authBaseURL+"/api/v1/user/profile", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		io.Copy(io.Discard, resp.Body)
		return "", fmt.Errorf("profile validation failed: status %d", resp.StatusCode)
	}

	var body struct {
		Code int            `json:"code"`
		Data map[string]any `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}
	if body.Code != 0 {
		return "", fmt.Errorf("profile validation failed: code %d", body.Code)
	}
	return accountIDValue(body.Data["id"])
}

func isDevSandboxAuthBaseURL(authBaseURL string) bool {
	return strings.TrimRight(strings.TrimSpace(authBaseURL), "/") == devSandboxAuthBaseURL
}

func devSandboxAccessTokenAccountID(accessToken string) (string, error) {
	if strings.HasPrefix(strings.TrimSpace(accessToken), devSandboxAccessTokenPrefix) {
		return devSandboxAccountID, nil
	}
	return "", fmt.Errorf("invalid dev sandbox token")
}

func accountIDValue(value any) (string, error) {
	switch typed := value.(type) {
	case string:
		accountID := strings.TrimSpace(typed)
		if accountID == "" {
			return "", fmt.Errorf("empty account id")
		}
		return accountID, nil
	case float64:
		return fmt.Sprintf("%.0f", typed), nil
	default:
		return "", fmt.Errorf("account id not found")
	}
}

func accountIDFromJWT(token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) < 2 || strings.TrimSpace(parts[1]) == "" {
		return "", fmt.Errorf("invalid token")
	}

	payload, err := decodeBase64URL(parts[1])
	if err != nil {
		return "", err
	}

	var claims map[string]any
	if err := json.Unmarshal(payload, &claims); err != nil {
		return "", err
	}

	for _, key := range []string{"uid", "user_id", "account_id", "sub"} {
		if value, ok := claims[key]; ok {
			if accountID, err := accountIDValue(value); err == nil {
				return accountID, nil
			}
		}
	}

	return "", fmt.Errorf("account claim not found")
}

func decodeBase64URL(input string) ([]byte, error) {
	if payload, err := base64.RawURLEncoding.DecodeString(input); err == nil {
		return payload, nil
	}
	return base64.URLEncoding.DecodeString(input)
}

func (s *Server) handlePersonalList(w http.ResponseWriter, r *http.Request) {
	if !s.authorizePersonalRequest(w, r) {
		return
	}
	client, ok := mobileAccessClientFromQuery(w, r)
	if !ok {
		return
	}
	if s.listPersonalDir(w, "") {
		s.recordPersonalAccess(client, "", "list", "shared_folder")
	}
}

func (s *Server) handlePersonalListPath(w http.ResponseWriter, r *http.Request) {
	if !s.authorizePersonalRequest(w, r) {
		return
	}
	client, ok := mobileAccessClientFromQuery(w, r)
	if !ok {
		return
	}
	relPath := r.PathValue("path")
	if s.listPersonalDir(w, relPath) {
		s.recordPersonalAccess(client, relPath, "list", "shared_folder")
	}
}

func (s *Server) listPersonalDir(w http.ResponseWriter, relPath string) bool {
	if !s.ensurePersonalDirForRequest(w, "personal.list") {
		return false
	}

	if s.usesWindowsPersonalVirtualDrives() && relPath == "" {
		return s.listWindowsPersonalDriveRoot(w)
	}

	return s.listDirectoryWithStreams(w, relPath, s.resolvePersonalPath, "personal", "/personal/thumbnail/", "/personal/stream/", true)
}

func (s *Server) handlePersonalThumbnail(w http.ResponseWriter, r *http.Request) {
	if !s.authorizePersonalRequest(w, r) {
		return
	}
	if !s.ensurePersonalDirForRequest(w, "personal.thumbnail") {
		return
	}

	s.serveCachedDirectoryThumbnail(w, r, r.PathValue("path"), s.resolvePersonalPath)
}

func (s *Server) handlePersonalDownload(w http.ResponseWriter, r *http.Request) {
	if !s.authorizePersonalRequest(w, r) {
		return
	}
	if !s.ensurePersonalDirForRequest(w, "personal.download") {
		return
	}
	client, ok := mobileAccessClientFromQuery(w, r)
	if !ok {
		return
	}

	relPath := r.PathValue("path")
	if s.serveDirectoryDownload(w, r, relPath, s.resolvePersonalPath) {
		s.recordPersonalAccess(client, relPath, "download", "shared_file")
	}
}

func (s *Server) handlePersonalStream(w http.ResponseWriter, r *http.Request) {
	if !s.authorizePersonalRequest(w, r) {
		return
	}
	if !s.ensurePersonalDirForRequest(w, "personal.stream") {
		return
	}
	client, ok := mobileAccessClientFromQuery(w, r)
	if !ok {
		return
	}

	relPath := r.PathValue("path")
	if s.serveDirectoryStream(w, r, relPath, s.resolvePersonalPath, "personal") {
		s.recordPersonalAccess(client, relPath, "view", "shared_file")
	}
}

func (s *Server) recordPersonalAccess(client mobileAccessClient, relPath string, action string, resourceKind string) {
	desktopDeviceID, err := s.store.GetDeviceID()
	if err != nil {
		slog.Warn("record personal access: load desktop id failed", "err", err)
		return
	}
	resourceID := "personal"
	normalizedPath := strings.Trim(strings.TrimSpace(relPath), "/")
	if normalizedPath != "" {
		resourceID = "personal:" + normalizedPath
	}
	resourceName := personalAccessResourceName(normalizedPath)
	if _, err := s.recordResourceAccess(desktopDeviceID, client, resourceID, resourceKind, resourceName, action, "ok"); err != nil {
		slog.Warn("record personal access failed", "resourceID", resourceID, "action", action, "err", err)
	}
}

func personalAccessResourceName(relPath string) string {
	trimmed := strings.Trim(strings.TrimSpace(relPath), "/")
	if trimmed == "" {
		return "个人空间"
	}
	name := strings.TrimSpace(path.Base(trimmed))
	if name == "." || name == "/" || name == "" {
		return trimmed
	}
	return name
}

func (s *Server) ensurePersonalDirForRequest(w http.ResponseWriter, operation string) bool {
	if s.usesWindowsPersonalVirtualDrives() {
		return true
	}

	result, err := runtimefs.EnsurePersonalDir(s.config)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "personal path unavailable")
		return false
	}
	if len(result.Recreated) > 0 {
		s.hub.Broadcast(events.Event{Type: "dashboard.updated", Payload: nil})
	}
	return true
}
