package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nicksyncflow/sidecar/internal/config"
	"github.com/nicksyncflow/sidecar/internal/events"
	"github.com/nicksyncflow/sidecar/internal/store"
)

func TestWindowsPersonalVirtualRootListsDrives(t *testing.T) {
	cRoot := t.TempDir()
	dRoot := t.TempDir()
	srv := newWindowsPersonalTestServer(t, []personalDriveRoot{
		{ID: "C", Name: "C Drive", Path: cRoot},
		{ID: "D", Name: "D Drive", Path: dRoot},
	}, "")
	defer srv.Close()

	resp := getPersonal(t, srv.URL+"/personal/list")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d body=%s", resp.StatusCode, string(body))
	}

	var body directoryListingDTO
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Scope != "personal" {
		t.Fatalf("scope=%q, want personal", body.Scope)
	}
	if body.Path != "" {
		t.Fatalf("path=%q, want empty root", body.Path)
	}

	entries := map[string]directoryFileDTO{}
	for _, file := range body.Files {
		entries[file.Path] = file
	}
	for _, want := range []string{"C", "D"} {
		file, ok := entries[want]
		if !ok {
			t.Fatalf("missing drive entry %q in %+v", want, body.Files)
		}
		if file.Name != want+" Drive" || !file.IsDirectory || file.Type != "other" {
			t.Fatalf("drive entry %q = %+v", want, file)
		}
	}
}

func TestWindowsPersonalVirtualDriveListsNestedContent(t *testing.T) {
	cRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(cRoot, "notes.txt"), []byte("personal"), 0o644); err != nil {
		t.Fatalf("write c notes: %v", err)
	}
	srv := newWindowsPersonalTestServer(t, []personalDriveRoot{
		{ID: "C", Name: "C Drive", Path: cRoot},
	}, "")
	defer srv.Close()

	resp := getPersonal(t, srv.URL+"/personal/list/C")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d body=%s", resp.StatusCode, string(body))
	}

	var body directoryListingDTO
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Path != "C" {
		t.Fatalf("path=%q, want C", body.Path)
	}
	if len(body.Files) != 1 {
		t.Fatalf("expected one file, got %+v", body.Files)
	}
	if body.Files[0].Name != "notes.txt" || body.Files[0].Path != "C/notes.txt" {
		t.Fatalf("unexpected nested file: %+v", body.Files[0])
	}
}

func TestWindowsPersonalVirtualDriveDownloadsNestedFile(t *testing.T) {
	dRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(dRoot, "export.txt"), []byte("from d"), 0o644); err != nil {
		t.Fatalf("write d export: %v", err)
	}
	srv := newWindowsPersonalTestServer(t, []personalDriveRoot{
		{ID: "D", Name: "D Drive", Path: dRoot},
	}, "")
	defer srv.Close()

	resp := getPersonal(t, srv.URL+"/personal/download/D/export.txt")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d body=%s", resp.StatusCode, string(body))
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if string(body) != "from d" {
		t.Fatalf("download body=%q, want from d", string(body))
	}
}

func TestWindowsPersonalVirtualDriveRejectsEscapes(t *testing.T) {
	cRoot := t.TempDir()
	srv := newWindowsPersonalTestServer(t, []personalDriveRoot{
		{ID: "C", Name: "C Drive", Path: cRoot},
	}, "")
	defer srv.Close()

	tests := []string{
		"/personal/list/Z",
		"/personal/list/C:%5CWindows",
		"/personal/list/C/..%5CWindows",
	}
	for _, path := range tests {
		resp := getPersonal(t, srv.URL+path)
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("GET %s status = %d, want 400", path, resp.StatusCode)
		}
	}
}

func TestWindowsPersonalVirtualDrivesActivateForPersistedDriveRoot(t *testing.T) {
	cRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(cRoot, "drive.txt"), []byte("drive"), 0o644); err != nil {
		t.Fatalf("write drive file: %v", err)
	}
	dRoot := t.TempDir()
	srv := newWindowsPersonalTestServer(t, []personalDriveRoot{
		{ID: "C", Name: "C Drive", Path: cRoot},
		{ID: "D", Name: "D Drive", Path: dRoot},
	}, `C:\`)
	defer srv.Close()

	resp := getPersonal(t, srv.URL+"/personal/list")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d body=%s", resp.StatusCode, string(body))
	}

	var body directoryListingDTO
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}

	paths := map[string]bool{}
	for _, file := range body.Files {
		paths[file.Path] = true
	}
	if !paths["C"] || !paths["D"] {
		t.Fatalf("expected virtual drive entries for persisted drive root, got %+v", body.Files)
	}
	if paths["drive.txt"] {
		t.Fatalf("persisted drive root should expose virtual root before drive contents: %+v", body.Files)
	}
}

func TestWindowsPersonalVirtualDrivesSettingsExposeModeForDriveRoot(t *testing.T) {
	srv := newWindowsPersonalTestServer(t, []personalDriveRoot{
		{ID: "C", Name: "C Drive", Path: t.TempDir()},
	}, `C:\`)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/settings")
	if err != nil {
		t.Fatalf("GET /settings: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d body=%s", resp.StatusCode, string(body))
	}

	var body struct {
		PersonalPath     string `json:"personalPath"`
		PersonalPathMode string `json:"personalPathMode"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.PersonalPath != `C:\` {
		t.Fatalf("personalPath=%q, want C:\\", body.PersonalPath)
	}
	if body.PersonalPathMode != personalPathModeWindowsDrives {
		t.Fatalf("personalPathMode=%q, want %q", body.PersonalPathMode, personalPathModeWindowsDrives)
	}
}

func TestWindowsPersonalVirtualDrivesUpdateSettingsAcceptsDriveRoot(t *testing.T) {
	cRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(cRoot, "drive.txt"), []byte("drive"), 0o644); err != nil {
		t.Fatalf("write drive file: %v", err)
	}
	dRoot := t.TempDir()
	srv := newWindowsPersonalTestServer(t, []personalDriveRoot{
		{ID: "C", Name: "C Drive", Path: cRoot},
		{ID: "D", Name: "D Drive", Path: dRoot},
	}, filepath.Join(t.TempDir(), "Custom Personal"))
	defer srv.Close()

	reqBody, err := json.Marshal(map[string]string{"personalPath": `C:\`})
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	req, err := http.NewRequest(http.MethodPut, srv.URL+"/settings", bytes.NewReader(reqBody))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PUT /settings: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d body=%s", resp.StatusCode, string(body))
	}

	var settingsBody struct {
		PersonalPath     string `json:"personalPath"`
		PersonalPathMode string `json:"personalPathMode"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&settingsBody); err != nil {
		t.Fatalf("decode settings: %v", err)
	}
	if settingsBody.PersonalPath != `C:\` {
		t.Fatalf("personalPath=%q, want C:\\", settingsBody.PersonalPath)
	}
	if settingsBody.PersonalPathMode != personalPathModeWindowsDrives {
		t.Fatalf("personalPathMode=%q, want %q", settingsBody.PersonalPathMode, personalPathModeWindowsDrives)
	}

	listResp := getPersonal(t, srv.URL+"/personal/list")
	defer listResp.Body.Close()

	if listResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(listResp.Body)
		t.Fatalf("expected 200, got %d body=%s", listResp.StatusCode, string(body))
	}

	var listBody directoryListingDTO
	if err := json.NewDecoder(listResp.Body).Decode(&listBody); err != nil {
		t.Fatalf("decode listing: %v", err)
	}

	paths := map[string]bool{}
	for _, file := range listBody.Files {
		paths[file.Path] = true
	}
	if !paths["C"] || !paths["D"] {
		t.Fatalf("expected virtual drive entries after update, got %+v", listBody.Files)
	}
	if paths["drive.txt"] {
		t.Fatalf("updated drive root should expose virtual root before drive contents: %+v", listBody.Files)
	}
}

func TestWindowsPersonalVirtualDrivesSkipExplicitCustomPersonalPath(t *testing.T) {
	personalRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(personalRoot, "personal.txt"), []byte("custom"), 0o644); err != nil {
		t.Fatalf("write personal file: %v", err)
	}
	cRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(cRoot, "drive.txt"), []byte("drive"), 0o644); err != nil {
		t.Fatalf("write drive file: %v", err)
	}
	srv := newWindowsPersonalTestServer(t, []personalDriveRoot{
		{ID: "C", Name: "C Drive", Path: cRoot},
	}, personalRoot)
	defer srv.Close()

	resp := getPersonal(t, srv.URL+"/personal/list")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d body=%s", resp.StatusCode, string(body))
	}

	var body directoryListingDTO
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}

	paths := map[string]bool{}
	for _, file := range body.Files {
		paths[file.Path] = true
	}
	if !paths["personal.txt"] {
		t.Fatalf("expected custom personal file, got %+v", body.Files)
	}
	if paths["C"] || paths["drive.txt"] {
		t.Fatalf("custom personal path should not expose virtual drive root: %+v", body.Files)
	}
}

func newWindowsPersonalTestServer(t *testing.T, roots []personalDriveRoot, personalShareDir string) *httptest.Server {
	t.Helper()

	oldGOOS := personalShareGOOS
	oldRoots := windowsPersonalDriveRoots
	oldDefault := windowsDefaultPersonalShareDir
	defaultPersonal := filepath.Join(t.TempDir(), "Users", "Alice")
	if err := os.MkdirAll(defaultPersonal, 0o755); err != nil {
		t.Fatalf("mkdir default personal: %v", err)
	}
	personalShareGOOS = "windows"
	windowsPersonalDriveRoots = func() []personalDriveRoot {
		return append([]personalDriveRoot(nil), roots...)
	}
	windowsDefaultPersonalShareDir = func() string {
		return defaultPersonal
	}
	t.Cleanup(func() {
		personalShareGOOS = oldGOOS
		windowsPersonalDriveRoots = oldRoots
		windowsDefaultPersonalShareDir = oldDefault
	})

	dataDir := t.TempDir()
	st, err := store.New(filepath.Join(dataDir, "sidecar.db"))
	if err != nil {
		t.Fatalf("store.New: %v", err)
	}
	t.Cleanup(func() { st.Close() })

	if personalShareDir == "" {
		personalShareDir = defaultPersonal
	}
	cfg := &config.Config{
		HTTPPort:              39394,
		TCPPort:               39393,
		DataDir:               dataDir,
		ReceiveDir:            filepath.Join(dataDir, "received"),
		PersonalShareDir:      personalShareDir,
		LogLevel:              "debug",
		DeviceName:            "test-windows",
		LowDiskThresholdBytes: 500 * 1024 * 1024,
	}
	if err := os.MkdirAll(cfg.ReceiveDir, 0o755); err != nil {
		t.Fatalf("mkdir receive: %v", err)
	}

	authSrv := profileAuthServerForPersonalWindows(t, "account-1")
	t.Cleanup(authSrv.Close)
	apiServer, handler := NewServer(st, cfg, events.NewHub(), nil)
	apiServer.setDesktopAuthContext("account-1", authSrv.URL)
	return httptest.NewServer(handler)
}

func getPersonal(t *testing.T, url string) *http.Response {
	t.Helper()

	req, err := http.NewRequest(http.MethodGet, withPersonalWindowsClientQuery(url), nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+fakeAccountJWTForPersonalWindows("account-1"))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	return resp
}

func withPersonalWindowsClientQuery(rawURL string) string {
	if strings.Contains(rawURL, "clientId=") {
		return rawURL
	}
	separator := "?"
	if strings.Contains(rawURL, "?") {
		separator = "&"
	}
	return rawURL + separator + "clientId=test-client&clientName=Test%20Phone"
}

func profileAuthServerForPersonalWindows(t *testing.T, accountID string) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/user/profile" {
			http.NotFound(w, r)
			return
		}
		if strings.TrimSpace(r.Header.Get("Authorization")) == "" {
			http.Error(w, "missing authorization", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]any{
			"code": 0,
			"data": map[string]any{
				"id": accountID,
			},
		}); err != nil {
			t.Fatalf("encode profile: %v", err)
		}
	}))
}

func fakeAccountJWTForPersonalWindows(accountID string) string {
	encode := base64.RawURLEncoding.EncodeToString
	header := encode([]byte(`{"alg":"none","typ":"JWT"}`))
	payload := encode([]byte(`{"user_id":"` + accountID + `"}`))
	return header + "." + payload + ".signature"
}
