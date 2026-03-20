# Phase 2: Go Sidecar Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Go sidecar that provides the full HTTP/WebSocket API, SQLite persistence, Bonjour broadcast, connection code management, disk monitoring, and share status detection — ready to be consumed by the Electron desktop in Phase 3.

**Architecture:** Single Go binary under `services/sidecar-go/`. Uses `net/http` stdlib for HTTP API, `gorilla/websocket` for WebSocket event stream, `mattn/go-sqlite3` for SQLite, and `hashicorp/mdns` (or `grandcat/zeroconf`) for Bonjour/mDNS. Configuration via YAML file + env vars. Graceful shutdown via signal handling.

**Tech Stack:** Go 1.26, SQLite 3.40+, gorilla/websocket, mattn/go-sqlite3 (CGO), zeroconf (mDNS)

**Spec:** `docs/superpowers/specs/2026-03-21-syncflow-v2-spec.md` — Sections 6 (Sidecar), 3 (Contracts)

**Can run in parallel with Phase 1** — both only depend on Phase 0 (contracts package).

---

## Team Execution Strategy

```
T2.0 🔁 Go module + project skeleton
  ├── T2.1 🔀 SQLite schema + store layer
  ├── T2.2 🔀 Config + disk monitor
  ├── T2.3 🔀 Bonjour broadcast
  └── T2.4 🔀 WebSocket event hub
T2.5 🔁 HTTP API (depends on T2.1 + T2.2 + T2.4)
T2.6 🔁 Connection code auto-regeneration (depends on T2.5)
T2.7 🔁 Share status detection (depends on T2.5)
T2.8 🔁 Integration verify + review
```

After T2.8: dispatch `code-reviewer` agent.

---

## File Structure

```
services/sidecar-go/
  go.mod                              NEW
  go.sum                              NEW (generated)
  cmd/
    syncflow-sidecar/
      main.go                         NEW
  internal/
    config/
      config.go                       NEW — YAML config loading + defaults
      config_test.go                  NEW
    store/
      db.go                           NEW — SQLite init, migrations, connection pool
      db_test.go                      NEW
      settings.go                     NEW — settings CRUD
      settings_test.go                NEW
      devices.go                      NEW — paired_devices CRUD
      devices_test.go                 NEW
      sessions.go                     NEW — sessions CRUD
      uploads.go                      NEW — uploads CRUD + daily stats aggregation
      uploads_test.go                 NEW
      sessions_test.go                NEW
      share.go                        NEW — share_config CRUD
      share_test.go                   NEW
      migrations/
        001_initial.sql               NEW — all 6 tables (embedded via go:embed)
      models.go                       NEW — shared struct definitions
    api/
      router.go                       REWRITE (currently stub)
      handlers_health.go              NEW
      handlers_dashboard.go           NEW
      handlers_devices.go             NEW
      handlers_settings.go            NEW
      handlers_share.go               NEW
      handlers_code.go                NEW
      middleware.go                    NEW — logging, JSON content-type
      router_test.go                  NEW
    events/
      hub.go                          NEW — WebSocket hub, broadcast, subscribe
      hub_test.go                     NEW
    mdns/
      broadcast.go                    NEW — Bonjour/mDNS service registration
      broadcast_test.go               NEW
    disk/
      monitor.go                      NEW — disk space check, low-disk detection
      monitor_test.go                 NEW
    share/
      detector.go                     NEW — SMB share status detection
      detector_test.go                NEW
    logging/
      logger.go                       NEW — structured logging setup
  syncflow-sidecar.yml                NEW — default config file
```

---

## Task 2.0 🔁 Go Module + Project Skeleton

**Files:**
- Create: `go.mod`, `cmd/syncflow-sidecar/main.go`, `internal/logging/logger.go`, `syncflow-sidecar.yml`

- [ ] **Step 1: Create `go.mod`**

```bash
cd services/sidecar-go
go mod init github.com/syncflow/sidecar
```

- [ ] **Step 2: Create `internal/logging/logger.go`**

```go
package logging

import (
	"log/slog"
	"os"
)

func Setup(level string) {
	var lvl slog.Level
	switch level {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl})
	slog.SetDefault(slog.New(handler))
}
```

- [ ] **Step 3: Create `syncflow-sidecar.yml`**

```yaml
http_port: 39394
tcp_port: 39393
data_dir: ""  # empty = ~/Library/Application Support/SyncFlow
receive_dir: "" # empty = <data_dir>/received
log_level: "info"
device_name: ""  # empty = hostname
low_disk_threshold_bytes: 524288000  # 500 MB
```

- [ ] **Step 4: Create `internal/config/config.go`**

```go
package config

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Config struct {
	HTTPPort              int    `yaml:"http_port"`
	TCPPort               int    `yaml:"tcp_port"`
	DataDir               string `yaml:"data_dir"`
	ReceiveDir            string `yaml:"receive_dir"`
	LogLevel              string `yaml:"log_level"`
	DeviceName            string `yaml:"device_name"`
	LowDiskThresholdBytes int64  `yaml:"low_disk_threshold_bytes"`
}

func Load(path string) (*Config, error) {
	cfg := &Config{
		HTTPPort:              39394,
		TCPPort:               39393,
		LogLevel:              "info",
		LowDiskThresholdBytes: 500 * 1024 * 1024,
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			cfg.setDefaults()
			return cfg, nil
		}
		return nil, err
	}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	cfg.setDefaults()
	return cfg, nil
}

func (c *Config) setDefaults() {
	if c.DataDir == "" {
		home, _ := os.UserHomeDir()
		c.DataDir = filepath.Join(home, "Library", "Application Support", "SyncFlow")
	}
	if c.ReceiveDir == "" {
		c.ReceiveDir = filepath.Join(c.DataDir, "received")
	}
	if c.DeviceName == "" {
		c.DeviceName, _ = os.Hostname()
	}
}

func (c *Config) DBPath() string {
	return filepath.Join(c.DataDir, "sidecar.db")
}

func (c *Config) StagingDir() string {
	return filepath.Join(c.DataDir, "staging")
}

func (c *Config) LogDir() string {
	return filepath.Join(c.DataDir, "logs")
}
```

- [ ] **Step 5: Create `internal/config/config_test.go`**

Test: `Load` with missing file returns defaults. `Load` with valid YAML overrides. `DBPath` returns correct path.

- [ ] **Step 6: Create `cmd/syncflow-sidecar/main.go`**

```go
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/syncflow/sidecar/internal/config"
	"github.com/syncflow/sidecar/internal/logging"
)

func main() {
	cfgPath := "syncflow-sidecar.yml"
	if v := os.Getenv("SYNCFLOW_CONFIG"); v != "" {
		cfgPath = v
	}

	cfg, err := config.Load(cfgPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config: %v\n", err)
		os.Exit(1)
	}

	logging.Setup(cfg.LogLevel)
	slog.Info("starting syncflow-sidecar", "http_port", cfg.HTTPPort)

	// Ensure data directories exist
	for _, dir := range []string{cfg.DataDir, cfg.ReceiveDir, cfg.StagingDir(), cfg.LogDir()} {
		os.MkdirAll(dir, 0755)
	}

	// TODO: init store, init router, init mdns (added in subsequent tasks)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true,"service":"syncflow-sidecar","version":"0.1.0"}`))
	})

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler: mux,
	}

	// Graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		slog.Info("http server listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("http server error", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(shutdownCtx)
}
```

- [ ] **Step 7: Install dependencies + verify**

```bash
cd services/sidecar-go
go mod tidy
go build ./cmd/syncflow-sidecar/
go test ./internal/config/
```

Expected: binary builds, config tests pass.

- [ ] **Step 8: Run and verify health endpoint**

```bash
./syncflow-sidecar &
curl http://127.0.0.1:39394/health
kill %1
```

Expected: `{"ok":true,"service":"syncflow-sidecar","version":"0.1.0"}`

- [ ] **Step 9: Commit**

```bash
git add services/sidecar-go/
git commit -m "feat(sidecar): Go module skeleton with config, logging, graceful shutdown"
```

---

## Task 2.1 🔀 SQLite Schema + Store Layer

**Can run in parallel with T2.2, T2.3 after T2.0.**

**Files:**
- Create: `internal/store/migrations/001_initial.sql`, `internal/store/db.go`, `db_test.go`, `settings.go`, `settings_test.go`, `devices.go`, `devices_test.go`, `uploads.go`, `uploads_test.go`, `share.go`, `share_test.go`, `sessions.go`

- [ ] **Step 1: Create `internal/store/migrations/001_initial.sql`**

```sql
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paired_devices (
  client_id           TEXT PRIMARY KEY,
  client_name         TEXT NOT NULL,
  device_alias        TEXT,
  last_ip             TEXT,
  platform            TEXT NOT NULL,
  pairing_id          TEXT NOT NULL,
  pairing_token_hash  TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  last_seen_at        TEXT NOT NULL,
  revoked_at          TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id      TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  client_name     TEXT NOT NULL,
  state           TEXT NOT NULL,
  active_file_key TEXT,
  active_offset   INTEGER NOT NULL DEFAULT 0,
  started_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
  file_key              TEXT PRIMARY KEY,
  session_id            TEXT,
  client_id             TEXT NOT NULL,
  original_filename     TEXT NOT NULL,
  media_type            TEXT NOT NULL,
  file_size             INTEGER NOT NULL,
  created_at_remote     TEXT,
  modified_at_remote    TEXT,
  status                TEXT NOT NULL,
  part_path             TEXT,
  final_path            TEXT,
  committed_bytes       INTEGER NOT NULL DEFAULT 0,
  sha256                TEXT,
  active_transmission_ms INTEGER NOT NULL DEFAULT 0,
  completed_at          TEXT,
  updated_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_daily_stats (
  stat_date             TEXT NOT NULL,
  client_id             TEXT NOT NULL,
  client_name_snapshot  TEXT NOT NULL,
  client_ip_snapshot    TEXT,
  file_count            INTEGER NOT NULL DEFAULT 0,
  total_bytes           INTEGER NOT NULL DEFAULT 0,
  active_transmission_ms INTEGER NOT NULL DEFAULT 0,
  updated_at            TEXT NOT NULL,
  PRIMARY KEY (stat_date, client_id)
);

CREATE TABLE IF NOT EXISTS share_config (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  receive_root      TEXT NOT NULL,
  share_name        TEXT NOT NULL,
  share_url         TEXT NOT NULL,
  share_status      TEXT NOT NULL,
  last_validated_at TEXT,
  last_error        TEXT
);

-- Default seeds
INSERT OR IGNORE INTO settings (key, value) VALUES ('connection_code', '000000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('device_id', lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))));
INSERT OR IGNORE INTO settings (key, value) VALUES ('device_name', '');
INSERT OR IGNORE INTO share_config (id, receive_root, share_name, share_url, share_status)
  VALUES (1, '', 'SyncFlow', '', 'unknown');
```

> **Note on `receive_root` vs `receivePath`:** The `share_config.receive_root` column stores the filesystem path. The `GET /settings` endpoint reads this and returns it as `receivePath` in the SettingsDTO. `PUT /settings` with `receivePath` updates `share_config.receive_root`. There is no separate `settings` key for receive path — it lives in `share_config` only.

- [ ] **Step 2: Create `internal/store/db.go`**

```go
package store

import (
	"database/sql"
	_ "embed"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed migrations/001_initial.sql
var migrationSQL string

type Store struct {
	db *sql.DB
}

func New(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) migrate() error {
	_, err := s.db.Exec(migrationSQL)
	return err
}
```

> Note: The `migrations/` directory lives inside `internal/store/` so the `go:embed` directive can access it. The SQL is compiled into the binary at build time — no file reads at runtime.

- [ ] **Step 3: Write `db_test.go`**

Test: `New` creates DB file. All 6 tables exist. `Close` succeeds.

- [ ] **Step 4: Create `internal/store/models.go` — shared struct definitions**

```go
package store

type PairedDevice struct {
	ClientID         string  `json:"clientId"`
	ClientName       string  `json:"clientName"`
	DeviceAlias      *string `json:"deviceAlias,omitempty"`
	LastIP           string  `json:"ip,omitempty"`
	Platform         string  `json:"platform"`
	PairingID        string  `json:"pairingId"`
	PairingTokenHash string  `json:"-"`
	CreatedAt        string  `json:"createdAt"`
	LastSeenAt       string  `json:"lastSeenAt"`
	RevokedAt        *string `json:"revokedAt,omitempty"`
}

type Upload struct {
	FileKey             string  `json:"fileKey"`
	SessionID           *string `json:"sessionId,omitempty"`
	ClientID            string  `json:"clientId"`
	OriginalFilename    string  `json:"originalFilename"`
	MediaType           string  `json:"mediaType"`
	FileSize            int64   `json:"fileSize"`
	CreatedAtRemote     *string `json:"createdAtRemote,omitempty"`
	ModifiedAtRemote    *string `json:"modifiedAtRemote,omitempty"`
	Status              string  `json:"status"`
	PartPath            *string `json:"-"`
	FinalPath           *string `json:"finalPath,omitempty"`
	CommittedBytes      int64   `json:"committedBytes"`
	SHA256              *string `json:"sha256,omitempty"`
	ActiveTransmissionMs int64  `json:"activeTransmissionMs"`
	CompletedAt         *string `json:"completedAt,omitempty"`
	UpdatedAt           string  `json:"updatedAt"`
}

type DailyStats struct {
	StatDate            string `json:"statDate"`
	ClientID            string `json:"clientId"`
	ClientNameSnapshot  string `json:"clientNameSnapshot"`
	ClientIPSnapshot    string `json:"clientIpSnapshot"`
	FileCount           int    `json:"fileCount"`
	TotalBytes          int64  `json:"totalBytes"`
	ActiveTransmissionMs int64 `json:"activeTransmissionMs"`
}

type ShareConfig struct {
	ReceiveRoot    string  `json:"receiveRoot"`
	ShareName      string  `json:"shareName"`
	ShareURL       string  `json:"shareUrl"`
	ShareStatus    string  `json:"shareStatus"`
	LastValidatedAt *string `json:"lastValidatedAt,omitempty"`
	LastError      *string `json:"lastError,omitempty"`
}

type Session struct {
	SessionID     string `json:"sessionId"`
	ClientID      string `json:"clientId"`
	ClientName    string `json:"clientName"`
	State         string `json:"state"`
	ActiveFileKey *string `json:"activeFileKey,omitempty"`
	ActiveOffset  int64  `json:"activeOffset"`
	StartedAt     string `json:"startedAt"`
	UpdatedAt     string `json:"updatedAt"`
}
```

- [ ] **Step 5: Create `internal/store/settings.go`**

Implement: `GetSetting(key) (string, error)`, `SetSetting(key, value) error`, `GetConnectionCode() (string, error)`, `SetConnectionCode(code) error`, `GetDeviceID() (string, error)`. Each function uses parameterized SQL queries.

- [ ] **Step 6: Write `settings_test.go`**

Test: Set/Get roundtrip. GetConnectionCode returns value after migration.

- [ ] **Step 7: Create `internal/store/devices.go`**

Implement: `UpsertPairedDevice(d PairedDevice) error`, `GetPairedDevice(clientID) (*PairedDevice, error)`, `ListPairedDevices() ([]PairedDevice, error)`, `RevokePairedDevice(clientID) error`, `UpdateLastSeen(clientID, ip) error`. Use `INSERT OR REPLACE` for upsert.

- [ ] **Step 8: Write `devices_test.go`**

Test: Upsert + Get roundtrip. List returns all. Revoke sets `revoked_at`. UpdateLastSeen updates timestamp.

- [ ] **Step 9: Create `internal/store/uploads.go`**

Implement: `UpsertUpload(u Upload) error`, `GetUpload(fileKey) (*Upload, error)`, `ListUploadsByDeviceAndDate(clientID, date) ([]Upload, error)`, `GetAvailableDates(clientID) ([]string, error)`, `UpdateUploadProgress(fileKey, committedBytes) error`, `CompleteUpload(fileKey, finalPath, sha256, transmissionMs) error`, `UpsertDailyStats(stat DailyStats) error`, `GetDashboardSummary(today) (DashboardSummaryResult, error)`, `GetDashboardDevices(today) ([]DashboardDeviceResult, error)`.

`GetDashboardSummary` aggregates: `SUM(file_count)`, `SUM(total_bytes)` from `device_daily_stats WHERE stat_date = today`.

`GetDashboardDevices` joins `paired_devices` with `device_daily_stats` for today, adds `currentFile` from active `sessions`+`uploads`.

- [ ] **Step 10: Write `uploads_test.go`**

Test: UpsertUpload + ListByDeviceAndDate. CompleteUpload changes status to `completed`. GetDashboardSummary aggregates correctly. GetAvailableDates returns distinct dates desc.

- [ ] **Step 11: Create `internal/store/sessions.go`**

Implement: `UpsertSession(s Session) error`, `GetSession(sessionID) (*Session, error)`, `UpdateSessionState(sessionID, state) error`, `GetActiveSession(clientID) (*Session, error)`.

- [ ] **Step 12: Write `sessions_test.go`**

Test: Upsert + Get roundtrip. UpdateSessionState changes state. GetActiveSession returns latest non-ended session.

- [ ] **Step 13: Create `internal/store/share.go`**

Implement: `GetShareConfig() (*ShareConfig, error)`, `UpdateShareConfig(cfg ShareConfig) error`. Reads/writes the singleton `share_config` row (id=1).

- [ ] **Step 14: Write `share_test.go`**

Test: Get returns default seeded values. Update + Get roundtrip.

- [ ] **Step 15: Run all store tests**

```bash
cd services/sidecar-go && go test ./internal/store/ -v
```

- [ ] **Step 13: Commit**

```bash
git add services/sidecar-go/
git commit -m "feat(sidecar): SQLite store layer with 6 tables + CRUD operations"
```

---

## Task 2.2 🔀 Config + Disk Monitor

**Can run in parallel with T2.1, T2.3 after T2.0.**

**Files:**
- Create: `internal/disk/monitor.go`, `monitor_test.go`

- [ ] **Step 1: Create `internal/disk/monitor.go`**

```go
package disk

import "syscall"

type DiskInfo struct {
	TotalBytes     uint64
	FreeBytes      uint64
	AvailableBytes uint64
}

func Check(path string) (*DiskInfo, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return nil, err
	}
	return &DiskInfo{
		TotalBytes:     stat.Blocks * uint64(stat.Bsize),
		FreeBytes:      stat.Bfree * uint64(stat.Bsize),
		AvailableBytes: stat.Bavail * uint64(stat.Bsize),
	}, nil
}

func IsLow(path string, threshold int64) (bool, uint64, error) {
	info, err := Check(path)
	if err != nil {
		return false, 0, err
	}
	return int64(info.AvailableBytes) < threshold, info.AvailableBytes, nil
}
```

- [ ] **Step 2: Write `monitor_test.go`**

Test: `Check("/")` returns non-zero values. `IsLow` with very high threshold returns true.

- [ ] **Step 3: Commit**

```bash
git add services/sidecar-go/internal/disk/
git commit -m "feat(sidecar): disk space monitor"
```

---

## Task 2.3 🔀 Bonjour/mDNS Broadcast

**Can run in parallel with T2.1, T2.2 after T2.0.**

**Files:**
- Create: `internal/mdns/broadcast.go`, `broadcast_test.go`

- [ ] **Step 1: Create `internal/mdns/broadcast.go`**

```go
package mdns

import (
	"fmt"
	"log/slog"

	"github.com/grandcat/zeroconf"
)

type BroadcastConfig struct {
	DeviceID     string
	DeviceName   string
	DeviceType   string // "mac"
	TCPPort      int    // 39393 — the LMUP TCP port, NOT the HTTP port
	Proto        int    // 2
	ShareEnabled bool
	ShareName    string
}

type Broadcaster struct {
	server *zeroconf.Server
}

func NewBroadcaster(cfg BroadcastConfig) (*Broadcaster, error) {
	txt := []string{
		fmt.Sprintf("id=%s", cfg.DeviceID),
		fmt.Sprintf("name=%s", cfg.DeviceName),
		fmt.Sprintf("type=%s", cfg.DeviceType),
		fmt.Sprintf("proto=%d", cfg.Proto),
		"auth=code",
		fmt.Sprintf("share=%d", boolToInt(cfg.ShareEnabled)),
		fmt.Sprintf("shareName=%s", cfg.ShareName),
	}

	server, err := zeroconf.Register(
		cfg.DeviceName,       // instance
		"_syncflow._tcp",     // service
		"local.",             // domain
		cfg.TCPPort,          // port — must be TCP/LMUP port (39393), NOT HTTP
		txt,                  // TXT records
		nil,                  // interfaces (nil = all)
	)
	if err != nil {
		return nil, fmt.Errorf("mdns register: %w", err)
	}

	slog.Info("bonjour broadcasting", "service", "_syncflow._tcp", "port", cfg.TCPPort, "name", cfg.DeviceName)
	return &Broadcaster{server: server}, nil
}

func (b *Broadcaster) Shutdown() {
	if b.server != nil {
		b.server.Shutdown()
	}
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
```

- [ ] **Step 2: Write `broadcast_test.go`**

Test: `NewBroadcaster` with valid config doesn't error. `Shutdown` is safe to call. TXT record format verification (unit test the string construction without actually broadcasting).

- [ ] **Step 3: Install dependency + verify**

```bash
cd services/sidecar-go
go get github.com/grandcat/zeroconf
go test ./internal/mdns/ -v
```

- [ ] **Step 4: Commit**

```bash
git add services/sidecar-go/
git commit -m "feat(sidecar): Bonjour/mDNS broadcast with zeroconf"
```

---

## Task 2.5 🔁 HTTP API

**Depends on: T2.1 (store) + T2.2 (disk) + T2.4 (event hub).**

**Files:**
- Rewrite: `internal/api/router.go`
- Create: `handlers_health.go`, `handlers_dashboard.go`, `handlers_devices.go`, `handlers_settings.go`, `handlers_share.go`, `handlers_code.go`, `middleware.go`, `router_test.go`

- [ ] **Step 1: Create `internal/api/middleware.go`**

```go
package api

import (
	"log/slog"
	"net/http"
	"time"
)

func withJSON(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		next(w, r)
	}
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		slog.Debug("http request", "method", r.Method, "path", r.URL.Path, "dur", time.Since(start))
	})
}
```

- [ ] **Step 2: Rewrite `internal/api/router.go`**

```go
package api

import (
	"net/http"

	"github.com/syncflow/sidecar/internal/config"
	"github.com/syncflow/sidecar/internal/disk"
	"github.com/syncflow/sidecar/internal/events"
	"github.com/syncflow/sidecar/internal/store"
)

type Server struct {
	store  *store.Store
	config *config.Config
	hub    *events.Hub
}

func NewServer(s *store.Store, cfg *config.Config, hub *events.Hub) http.Handler {
	srv := &Server{store: s, config: cfg, hub: hub}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", withJSON(srv.handleHealth))
	mux.HandleFunc("GET /dashboard/summary", withJSON(srv.handleDashboardSummary))
	mux.HandleFunc("GET /dashboard/devices", withJSON(srv.handleDashboardDevices))
	mux.HandleFunc("GET /devices/{deviceId}", withJSON(srv.handleDeviceDetail))
	mux.HandleFunc("GET /devices/{deviceId}/files", withJSON(srv.handleDeviceFiles))
	mux.HandleFunc("GET /devices/{deviceId}/dates", withJSON(srv.handleDeviceDates))
	mux.HandleFunc("GET /settings", withJSON(srv.handleGetSettings))
	mux.HandleFunc("PUT /settings", withJSON(srv.handleUpdateSettings))
	mux.HandleFunc("POST /connection-code/regenerate", withJSON(srv.handleRegenerateCode))
	mux.HandleFunc("GET /share/status", withJSON(srv.handleShareStatus))
	mux.HandleFunc("POST /share/validate", withJSON(srv.handleShareValidate))
	mux.HandleFunc("GET /events/stream", srv.handleEventStream)

	return withLogging(mux)
}
```

> Note: Go 1.22+ supports method+pattern routing in `net/http.ServeMux` natively (`"GET /path"`).

- [ ] **Step 3: Create `handlers_health.go`**

`handleHealth` — returns `{"ok":true,"service":"syncflow-sidecar","version":"0.1.0"}`

- [ ] **Step 4: Create `handlers_dashboard.go`**

`handleDashboardSummary` — calls `store.GetDashboardSummary(today)` + `disk.IsLow()`, returns `DashboardSummaryDTO` JSON.
`handleDashboardDevices` — calls `store.GetDashboardDevices(today)`, returns `[]DashboardDeviceDTO` JSON.

- [ ] **Step 5: Create `handlers_devices.go`**

`handleDeviceDetail` — reads `{deviceId}` path param, calls store, returns single `DashboardDeviceDTO`.
`handleDeviceFiles` — reads `{deviceId}` + `?date=` query param, calls `store.ListUploadsByDeviceAndDate`, returns `[]DeviceFileLedgerDTO`.
`handleDeviceDates` — calls `store.GetAvailableDates`, returns `{"dates":[...]}`.

- [ ] **Step 6: Create `handlers_settings.go`**

`handleGetSettings` — reads settings + share_config, assembles `SettingsDTO`. `receivePath` comes from `share_config.receive_root`.
`handleUpdateSettings` — decodes JSON body, updates `share_config.receive_root` if `receivePath` present, returns updated `SettingsDTO`.

- [ ] **Step 7: Create `handlers_code.go`**

`handleRegenerateCode` — generates `100000 + rand.IntN(900000)`, stores via `store.SetConnectionCode`, returns `{"code":"..."}`.

- [ ] **Step 8: Create `handlers_share.go`**

`handleShareStatus` — reads `store.GetShareConfig`, returns `ShareStatusDTO`.
`handleShareValidate` — calls `share.Detect()`, updates `store.UpdateShareConfig`, returns result.

- [ ] **Step 9: Write `router_test.go`**

Use `httptest.NewServer`. Test all 12 endpoints:
- `GET /health` → 200, `"ok":true`
- `GET /dashboard/summary` → 200, has `todayUploadCount`
- `GET /dashboard/devices` → 200, returns array
- `GET /devices/{id}` → 200, has `deviceId`
- `GET /devices/{id}/files?date=2026-03-21` → 200, returns array
- `GET /devices/{id}/dates` → 200, has `dates` array
- `GET /settings` → 200, has `connectionCode`
- `PUT /settings` → 200, returns updated DTO
- `POST /connection-code/regenerate` → 200, code is 6 digits
- `GET /share/status` → 200, has `status`
- `POST /share/validate` → 200, has `status`
- `GET /events/stream` → 101 Switching Protocols (WebSocket upgrade)

- [ ] **Step 5: Run tests**

```bash
cd services/sidecar-go && go test ./internal/api/ -v
```

- [ ] **Step 6: Wire into main.go**

Update `cmd/syncflow-sidecar/main.go`: init Store, init Hub, pass to `api.NewServer`, replace inline mux.

After store init, add bootstrap reconciliation:

```go
// Bootstrap reconciliation: ensure DB has config defaults
shareConfig, _ := store.GetShareConfig()
if shareConfig != nil && shareConfig.ReceiveRoot == "" {
	store.UpdateShareConfig(store.ShareConfig{
		ReceiveRoot: cfg.ReceiveDir,
		ShareName:   "SyncFlow",
		ShareURL:    "",
		ShareStatus: "unknown",
	})
}
if name, _ := store.GetSetting("device_name"); name == "" {
	store.SetSetting("device_name", cfg.DeviceName)
}
// Auto-regenerate default connection code
if code, _ := store.GetConnectionCode(); code == "000000" {
	newCode := fmt.Sprintf("%06d", rand.IntN(900000)+100000)
	store.SetConnectionCode(newCode)
}
```

- [ ] **Step 7: Integration test — run sidecar, curl all endpoints**

```bash
cd services/sidecar-go && go run ./cmd/syncflow-sidecar/ &
sleep 1
curl -s http://127.0.0.1:39394/health | jq .
curl -s http://127.0.0.1:39394/dashboard/summary | jq .
curl -s http://127.0.0.1:39394/dashboard/devices | jq .
curl -s http://127.0.0.1:39394/settings | jq .
curl -s -X POST http://127.0.0.1:39394/connection-code/regenerate | jq .
curl -s http://127.0.0.1:39394/share/status | jq .
kill %1
```

All return valid JSON matching spec Section 6.1.

- [ ] **Step 8: Commit**

```bash
git add services/sidecar-go/
git commit -m "feat(sidecar): full HTTP API with 12 endpoints"
```

---

## Task 2.4 🔀 WebSocket Event Hub

**Can run in parallel with T2.1, T2.2, T2.3 after T2.0.**

**Files:**
- Create: `internal/events/hub.go`, `hub_test.go`
- Modify: `internal/api/router.go` (handleEventStream)

- [ ] **Step 1: Create `internal/events/hub.go`**

```go
package events

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

type Event struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type Hub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]struct{}
	upgrader websocket.Upgrader
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[*websocket.Conn]struct{}),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

func (h *Hub) HandleUpgrade(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws upgrade failed", "err", err)
		return
	}
	h.mu.Lock()
	h.clients[conn] = struct{}{}
	h.mu.Unlock()

	// Read loop (just drain; client doesn't send meaningful data)
	go func() {
		defer func() {
			h.mu.Lock()
			delete(h.clients, conn)
			h.mu.Unlock()
			conn.Close()
		}()
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}()
}

func (h *Hub) Broadcast(event Event) {
	data, err := json.Marshal(event)
	if err != nil {
		slog.Error("event marshal error", "err", err)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	var dead []*websocket.Conn
	for conn := range h.clients {
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			slog.Warn("ws write error, removing client", "err", err)
			dead = append(dead, conn)
		}
	}
	for _, conn := range dead {
		conn.Close()
		delete(h.clients, conn)
	}
}
```

- [ ] **Step 2: Write `hub_test.go`**

Test: Create Hub. Simulate upgrade with httptest + gorilla dialer. Broadcast event. Client receives correct JSON. Disconnect removes client.

- [ ] **Step 3: Wire `handleEventStream` in router**

```go
func (s *Server) handleEventStream(w http.ResponseWriter, r *http.Request) {
	s.hub.HandleUpgrade(w, r)
}
```

- [ ] **Step 4: Install dependency + run tests**

```bash
cd services/sidecar-go
go get github.com/gorilla/websocket
go test ./internal/events/ -v
```

- [ ] **Step 5: Commit**

```bash
git add services/sidecar-go/
git commit -m "feat(sidecar): WebSocket event hub with broadcast"
```

---

## Task 2.6 🔁 Connection Code Verification

**Depends on: T2.5 (HTTP API already has regenerate endpoint). This task adds startup auto-regeneration.**

**Files:**
- Modify: `internal/api/handlers_code.go`, `internal/store/settings.go`

- [ ] **Step 1: Implement code generation in `handlers_code.go`**

```go
func (s *Server) handleRegenerateCode(w http.ResponseWriter, r *http.Request) {
	code := generateCode()
	if err := s.store.SetConnectionCode(code); err != nil {
		http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"code": code})
}

func generateCode() string {
	n := rand.IntN(900000) + 100000
	return strconv.Itoa(n)
}
```

- [ ] **Step 2: Add startup auto-regeneration in main.go**

After store init in main.go: if `store.GetConnectionCode()` returns `"000000"`, call `generateCode()` + `store.SetConnectionCode()`. The default `000000` was seeded by migration in T2.1.

- [ ] **Step 3: Test via curl**

```bash
curl -s -X POST http://127.0.0.1:39394/connection-code/regenerate | jq .
# Should return {"code":"<6 digits>"}
curl -s http://127.0.0.1:39394/settings | jq .connectionCode
# Should match the newly generated code
```

- [ ] **Step 4: Commit**

```bash
git add services/sidecar-go/
git commit -m "feat(sidecar): connection code generation + persistence"
```

---

## Task 2.7 🔁 Share Status Detection

**Depends on: T2.5 (HTTP API, which wires share handlers).**

**Files:**
- Create: `internal/share/detector.go`, `detector_test.go`
- Modify: `internal/api/handlers_share.go`

- [ ] **Step 1: Create `internal/share/detector.go`**

```go
package share

import (
	"fmt"
	"net"
	"os/exec"
	"strings"
)

type Status string

const (
	StatusUnknown          Status = "unknown"
	StatusNeedsManualEnable Status = "needs_manual_enable"
	StatusShareRegistered  Status = "share_registered"
	StatusReady            Status = "ready"
	StatusError            Status = "error"
)

type Result struct {
	Enabled  bool    `json:"enabled"`
	SmbURL   *string `json:"smbUrl"`
	Status   Status  `json:"status"`
	Error    *string `json:"lastError"`
}

// Detect checks if macOS File Sharing + SMB is enabled and the path is shared
func Detect(receivePath, shareName string) Result {
	// Step 1: Check if smbd is running
	out, err := exec.Command("pgrep", "-x", "smbd").Output()
	if err != nil || len(strings.TrimSpace(string(out))) == 0 {
		return Result{Status: StatusNeedsManualEnable}
	}

	// Step 2: Check if the share name exists in the system share list
	sharesOut, err := exec.Command("sharing", "-l").Output()
	if err != nil {
		errMsg := fmt.Sprintf("cannot list shares: %v", err)
		return Result{Status: StatusError, Error: &errMsg}
	}

	sharesStr := string(sharesOut)
	if !strings.Contains(sharesStr, shareName) {
		return Result{Status: StatusShareRegistered}  // SMB is on but our share isn't configured
	}

	// Step 3: Verify the share path matches receivePath
	// The `sharing -l` output contains lines like "name: SyncFlow  path: /path/to/dir"
	// Parse to check if the path matches
	shareFound := false
	for _, line := range strings.Split(sharesStr, "\n") {
		if strings.Contains(line, "name:") && strings.Contains(line, shareName) {
			// Check next line or same block for path
			shareFound = true
		}
		if shareFound && strings.Contains(line, "path:") {
			pathPart := strings.TrimSpace(strings.SplitN(line, "path:", 2)[1])
			if pathPart != "" && !strings.HasPrefix(receivePath, pathPart) {
				return Result{Status: StatusShareRegistered}  // share exists but wrong path
			}
			break
		}
	}

	// Step 4: Get local IP
	ip := getLocalIP()
	if ip == "" {
		errMsg := "cannot determine local IP"
		return Result{Status: StatusError, Error: &errMsg}
	}

	smbURL := fmt.Sprintf("smb://%s/%s", ip, shareName)
	return Result{
		Enabled: true,
		SmbURL:  &smbURL,
		Status:  StatusReady,
	}
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
			return ipnet.IP.String()
		}
	}
	return ""
}
```

- [ ] **Step 2: Write `detector_test.go`**

Test: `getLocalIP` returns non-empty on macOS. `Detect` returns a valid `Result` struct.

- [ ] **Step 3: Wire into `handleShareValidate`**

Call `share.Detect`, store result in share_config table, return as ShareStatusDTO.

- [ ] **Step 4: Commit**

```bash
git add services/sidecar-go/
git commit -m "feat(sidecar): SMB share status detection"
```

---

## Task 2.8 🔁 Integration Verification + Review

> **Note:** old `internal/api/router.go` (4 stub endpoints) is fully replaced by T2.5. Delete the old file before writing the new one.

**Depends on: all T2.x complete.**

- [ ] **Step 1: Run all Go tests**

```bash
cd services/sidecar-go && go test ./... -v
```

All pass.

- [ ] **Step 2: Full integration smoke test**

```bash
cd services/sidecar-go && go run ./cmd/syncflow-sidecar/ &
sleep 2

# Health
curl -sf http://127.0.0.1:39394/health | jq .

# Dashboard (empty initially)
curl -sf http://127.0.0.1:39394/dashboard/summary | jq .
curl -sf http://127.0.0.1:39394/dashboard/devices | jq .

# Settings
curl -sf http://127.0.0.1:39394/settings | jq .

# Regenerate code
curl -sf -X POST http://127.0.0.1:39394/connection-code/regenerate | jq .

# Share status
curl -sf http://127.0.0.1:39394/share/status | jq .
curl -sf -X POST http://127.0.0.1:39394/share/validate | jq .

# WebSocket (quick check)
# Use wscat or websocat to verify ws://127.0.0.1:39394/events/stream connects

kill %1
```

All endpoints return valid JSON matching spec Section 6.1.

- [ ] **Step 3: Verify Bonjour broadcast**

On the same Mac, or from an iPhone on the same LAN:

```bash
dns-sd -B _syncflow._tcp
```

Expected: sees the sidecar service with correct TXT records.

- [ ] **Step 4: Dispatch `code-reviewer` agent**

Review scope: entire `services/sidecar-go/`. Criteria:
- Error handling (all errors wrapped, no silent drops)
- Resource cleanup (DB connections, WebSocket connections, mDNS shutdown)
- Concurrency safety (Hub broadcast under lock, no data races)
- SQL injection prevention (parameterized queries only)
- API response shapes match spec Section 6.1 exactly
- Test coverage for all store operations
- No hardcoded paths (all from config)

- [ ] **Step 5: Fix review findings**

- [ ] **Step 6: Final commit**

```bash
git add services/sidecar-go/
git commit -m "chore: Phase 2 complete — Go sidecar with full HTTP API + SQLite + Bonjour"
```

---

## Verification Summary

### Phase 2 Gate

```bash
# All Go tests pass
cd services/sidecar-go && go test ./... -v

# Binary builds
cd services/sidecar-go && go build ./cmd/syncflow-sidecar/

# Sidecar starts and responds
./syncflow-sidecar &
curl -sf http://127.0.0.1:39394/health
curl -sf http://127.0.0.1:39394/dashboard/summary
curl -sf http://127.0.0.1:39394/settings
kill %1

# Bonjour visible
dns-sd -B _syncflow._tcp
```
