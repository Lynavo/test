package config

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestLoadMissingFileReturnsDefaults(t *testing.T) {
	cfg, err := Load("/tmp/does-not-exist-syncflow.yml")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if cfg.HTTPPort != 39394 {
		t.Errorf("HTTPPort = %d, want 39394", cfg.HTTPPort)
	}
	if cfg.TCPPort != 39393 {
		t.Errorf("TCPPort = %d, want 39393", cfg.TCPPort)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("LogLevel = %q, want \"info\"", cfg.LogLevel)
	}
	if cfg.LowDiskThresholdBytes != 500*1024*1024 {
		t.Errorf("LowDiskThresholdBytes = %d, want %d", cfg.LowDiskThresholdBytes, 500*1024*1024)
	}
}

func TestLoadValidYAMLOverridesValues(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.yml")
	content := []byte(`http_port: 8080
tcp_port: 9090
log_level: "debug"
low_disk_threshold_bytes: 1000000
`)
	if err := os.WriteFile(path, content, 0644); err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if cfg.HTTPPort != 8080 {
		t.Errorf("HTTPPort = %d, want 8080", cfg.HTTPPort)
	}
	if cfg.TCPPort != 9090 {
		t.Errorf("TCPPort = %d, want 9090", cfg.TCPPort)
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("LogLevel = %q, want \"debug\"", cfg.LogLevel)
	}
	if cfg.LowDiskThresholdBytes != 1000000 {
		t.Errorf("LowDiskThresholdBytes = %d, want 1000000", cfg.LowDiskThresholdBytes)
	}
}

func TestDBPathReturnsCorrectPath(t *testing.T) {
	cfg := &Config{DataDir: "/tmp/syncflow-test"}
	want := "/tmp/syncflow-test/sidecar.db"
	if got := cfg.DBPath(); got != want {
		t.Errorf("DBPath() = %q, want %q", got, want)
	}
}

func TestStagingDirReturnsCorrectPath(t *testing.T) {
	cfg := &Config{DataDir: "/tmp/syncflow-test"}
	want := "/tmp/syncflow-test/staging"
	if got := cfg.StagingDir(); got != want {
		t.Errorf("StagingDir() = %q, want %q", got, want)
	}
}

func TestStagingDirFollowsCustomReceiveDirVolume(t *testing.T) {
	cfg := &Config{
		DataDir:    filepath.Join("/tmp", "syncflow-test"),
		ReceiveDir: filepath.Join("/tmp", "external", "received"),
	}
	want := filepath.Join("/tmp", "external", "staging")
	if got := cfg.StagingDir(); got != want {
		t.Errorf("StagingDir() = %q, want %q", got, want)
	}
}

func TestManagedLayoutDirsDeriveFromRoot(t *testing.T) {
	root := filepath.Join("/tmp", "syncflow-test")
	cfg := &Config{
		DataDir:    root,
		ReceiveDir: filepath.Join(root, "received"),
	}

	if got := cfg.RootDir(); got != root {
		t.Errorf("RootDir() = %q, want %q", got, root)
	}
	if got := cfg.PersonalDir(); got != filepath.Join(root, "personal") {
		t.Errorf("PersonalDir() = %q", got)
	}
	if got := cfg.SharedDir(); got != filepath.Join(root, "shared") {
		t.Errorf("SharedDir() = %q", got)
	}
	if got := cfg.StagingDir(); got != filepath.Join(root, "staging") {
		t.Errorf("StagingDir() = %q", got)
	}
}

func TestSharedDirUsesRootForManagedReceivePath(t *testing.T) {
	cfg := &Config{
		DataDir:    filepath.Join("/tmp", "syncflow-test"),
		ReceiveDir: filepath.Join("/tmp", "external", "received"),
	}
	want := filepath.Join("/tmp", "external", "shared")
	if got := cfg.SharedDir(); got != want {
		t.Errorf("SharedDir() = %q, want %q", got, want)
	}
}

func TestObsoletePersonalReceiveLayoutDirsDeriveFromOuterRoot(t *testing.T) {
	root := filepath.Join("/tmp", "syncflow-test")
	cfg := &Config{
		DataDir:    root,
		ReceiveDir: filepath.Join(root, "personal", "received"),
	}

	if got := cfg.RootDir(); got != root {
		t.Errorf("RootDir() = %q, want %q", got, root)
	}
	if got := cfg.SharedDir(); got != filepath.Join(root, "shared") {
		t.Errorf("SharedDir() = %q", got)
	}
	if got := cfg.StagingDir(); got != filepath.Join(root, "staging") {
		t.Errorf("StagingDir() = %q", got)
	}
}

func TestPersonalDirIsIndependentFromReceiveDir(t *testing.T) {
	cfg := &Config{
		DataDir:          filepath.Join("/tmp", "syncflow-test"),
		ReceiveDir:       filepath.Join("/tmp", "external", "received"),
		PersonalShareDir: filepath.Join("/tmp", "whole-disk"),
	}
	want := filepath.Join("/tmp", "whole-disk")
	if got := cfg.PersonalDir(); got != want {
		t.Errorf("PersonalDir() = %q, want %q", got, want)
	}

	rel, err := filepath.Rel(cfg.PersonalDir(), cfg.ReceiveDir)
	if err != nil {
		t.Fatalf("Rel(PersonalDir, ReceiveDir): %v", err)
	}
	if rel == "." || (!strings.HasPrefix(rel, ".."+string(filepath.Separator)) && rel != ".." && !filepath.IsAbs(rel)) {
		t.Fatalf("ReceiveDir %q should not be implicitly contained in PersonalDir %q", cfg.ReceiveDir, cfg.PersonalDir())
	}
}

func TestDefaultPersonalDirDoesNotExposeManagedReceiveSiblings(t *testing.T) {
	cfg := &Config{
		DataDir:    filepath.Join("/tmp", "syncflow-test"),
		ReceiveDir: filepath.Join("/tmp", "external", "received"),
	}
	siblingPath := filepath.Join(filepath.Dir(cfg.ReceiveDir), "private.txt")
	rel, err := filepath.Rel(cfg.PersonalDir(), siblingPath)
	if err != nil {
		t.Fatalf("Rel(PersonalDir, sibling): %v", err)
	}
	if rel == "." || !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && rel != ".." && !filepath.IsAbs(rel) {
		t.Fatalf("sibling path %q should not be contained in PersonalDir %q", siblingPath, cfg.PersonalDir())
	}
}

func TestLegacyStagingDirReturnsDataDirStaging(t *testing.T) {
	cfg := &Config{
		DataDir:    filepath.Join("/tmp", "syncflow-test"),
		ReceiveDir: filepath.Join("/tmp", "external", "received"),
	}
	want := filepath.Join("/tmp", "syncflow-test", "staging")
	if got := cfg.LegacyStagingDir(); got != want {
		t.Errorf("LegacyStagingDir() = %q, want %q", got, want)
	}
}

func TestLogDirReturnsCorrectPath(t *testing.T) {
	cfg := &Config{DataDir: "/tmp/syncflow-test"}
	want := "/tmp/syncflow-test/logs"
	if got := cfg.LogDir(); got != want {
		t.Errorf("LogDir() = %q, want %q", got, want)
	}
}

func TestSetDefaultsFillsDataDirReceiveDirDeviceName(t *testing.T) {
	cfg := &Config{}
	cfg.setDefaults()

	expectedDataDir := defaultDataDir()
	if cfg.DataDir != expectedDataDir {
		t.Errorf("DataDir = %q, want %q", cfg.DataDir, expectedDataDir)
	}

	expectedReceiveDir := filepath.Join(expectedDataDir, "received")
	if cfg.ReceiveDir != expectedReceiveDir {
		t.Errorf("ReceiveDir = %q, want %q", cfg.ReceiveDir, expectedReceiveDir)
	}
	expectedPersonalShareDir, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("UserHomeDir: %v", err)
	}
	if cfg.PersonalShareDir != expectedPersonalShareDir {
		t.Errorf("PersonalShareDir = %q, want %q", cfg.PersonalShareDir, expectedPersonalShareDir)
	}

	hostname, _ := os.Hostname()
	expectedDeviceName := strings.TrimSuffix(hostname, ".local")
	if cfg.DeviceName != expectedDeviceName {
		t.Errorf("DeviceName = %q, want %q", cfg.DeviceName, expectedDeviceName)
	}
}

func TestSelectDataDirPrefersCurrentBrandDir(t *testing.T) {
	if currentDataDirName != "Lynavo Drive" {
		t.Fatalf("currentDataDirName = %q, want Lynavo Drive", currentDataDirName)
	}

	dir := t.TempDir()
	preferredPath := filepath.Join(dir, currentDataDirName)
	legacyPath := filepath.Join(dir, "Vivi Drop")

	if err := os.MkdirAll(preferredPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(preferredPath): %v", err)
	}
	if err := os.MkdirAll(legacyPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(legacyPath): %v", err)
	}

	if got := selectDataDir(preferredPath, legacyPath); got != preferredPath {
		t.Errorf("selectDataDir() = %q, want %q", got, preferredPath)
	}
}

func TestSelectDataDirFallsBackToLegacyDir(t *testing.T) {
	dir := t.TempDir()
	preferredPath := filepath.Join(dir, currentDataDirName)
	legacyPath := filepath.Join(dir, "Vivi Drop")

	if err := os.MkdirAll(legacyPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(legacyPath): %v", err)
	}
	if err := os.WriteFile(filepath.Join(legacyPath, "sidecar.db-wal"), []byte("wal"), 0o644); err != nil {
		t.Fatalf("WriteFile legacy wal: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(legacyPath, "logs"), 0o755); err != nil {
		t.Fatalf("MkdirAll legacy logs: %v", err)
	}
	if err := os.WriteFile(filepath.Join(legacyPath, "logs", "sidecar.log"), []byte("log"), 0o644); err != nil {
		t.Fatalf("WriteFile legacy log: %v", err)
	}

	if got := selectDataDir(preferredPath, legacyPath); got != preferredPath {
		t.Errorf("selectDataDir() = %q, want %q", got, preferredPath)
	}
	if !isDir(preferredPath) {
		t.Fatalf("expected preferred path to exist after migration")
	}
	if !isDir(legacyPath) {
		t.Fatalf("expected legacy path to remain after migration")
	}
	if _, err := os.Stat(filepath.Join(preferredPath, "sidecar.db-wal")); err != nil {
		t.Fatalf("expected WAL file copied to preferred path: %v", err)
	}
	if _, err := os.Stat(filepath.Join(preferredPath, "logs", "sidecar.log")); err != nil {
		t.Fatalf("expected representative nested file copied to preferred path: %v", err)
	}
}

func TestSelectDataDirCopiesOlderLegacyDirWithoutDeletingSource(t *testing.T) {
	dir := t.TempDir()
	preferredPath := filepath.Join(dir, currentDataDirName)
	viviLegacyPath := filepath.Join(dir, "Vivi Drop")
	olderLegacyPath := filepath.Join(dir, legacyDataDirName)

	writeSQLiteState(t, olderLegacyPath, sqliteState{
		sessions:      1,
		uploads:       1,
		pairedDevices: 1,
		shareStatus:   "share_registered",
	})
	if err := os.WriteFile(filepath.Join(olderLegacyPath, "sidecar.db-shm"), []byte("shm"), 0o644); err != nil {
		t.Fatalf("WriteFile legacy shm: %v", err)
	}

	if got := selectDataDir(preferredPath, viviLegacyPath, olderLegacyPath); got != preferredPath {
		t.Errorf("selectDataDir() = %q, want %q", got, preferredPath)
	}
	if !isDir(olderLegacyPath) {
		t.Fatalf("expected older legacy path to remain after migration")
	}
	if _, err := os.Stat(filepath.Join(preferredPath, "sidecar.db")); err != nil {
		t.Fatalf("expected DB copied to preferred path: %v", err)
	}
	if _, err := os.Stat(filepath.Join(preferredPath, "sidecar.db-shm")); err != nil {
		t.Fatalf("expected SHM copied to preferred path: %v", err)
	}
}

func TestSelectDataDirReturnsPreferredWhenLegacyCopyFails(t *testing.T) {
	dir := t.TempDir()
	blockingParent := filepath.Join(dir, "blocked-parent")
	preferredPath := filepath.Join(blockingParent, currentDataDirName)
	legacyPath := filepath.Join(dir, "Vivi Drop")

	if err := os.WriteFile(blockingParent, []byte("not a directory"), 0o644); err != nil {
		t.Fatalf("WriteFile(blockingParent): %v", err)
	}
	if err := os.MkdirAll(legacyPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(legacyPath): %v", err)
	}
	if err := os.WriteFile(filepath.Join(legacyPath, "sidecar.db"), []byte("legacy"), 0o644); err != nil {
		t.Fatalf("WriteFile legacy DB: %v", err)
	}

	if got := selectDataDir(preferredPath, legacyPath); got != preferredPath {
		t.Errorf("selectDataDir() = %q, want %q", got, preferredPath)
	}
	if _, err := os.Stat(filepath.Join(legacyPath, "sidecar.db")); err != nil {
		t.Fatalf("expected legacy DB to remain after failed copy: %v", err)
	}
	if _, err := os.Stat(preferredPath); err == nil {
		t.Fatalf("expected failed copy not to create preferred path")
	}
}

func TestSelectDataDirDoesNotLeavePartialPreferredDirWhenLegacyCopyFails(t *testing.T) {
	dir := t.TempDir()
	preferredPath := filepath.Join(dir, currentDataDirName)
	legacyPath := filepath.Join(dir, "Vivi Drop")

	if err := os.MkdirAll(filepath.Join(legacyPath, "a-logs"), 0o755); err != nil {
		t.Fatalf("MkdirAll legacy logs: %v", err)
	}
	if err := os.WriteFile(filepath.Join(legacyPath, "a-logs", "sidecar.log"), []byte("log"), 0o644); err != nil {
		t.Fatalf("WriteFile legacy log: %v", err)
	}
	if err := os.WriteFile(filepath.Join(legacyPath, "sidecar.db"), []byte("legacy"), 0o644); err != nil {
		t.Fatalf("WriteFile legacy DB: %v", err)
	}
	deniedFile := filepath.Join(legacyPath, "z-denied.bin")
	if err := os.WriteFile(deniedFile, []byte("denied"), 0o644); err != nil {
		t.Fatalf("WriteFile denied file: %v", err)
	}
	if err := os.Chmod(deniedFile, 0); err != nil {
		t.Fatalf("Chmod denied file: %v", err)
	}
	defer func() {
		_ = os.Chmod(deniedFile, 0o644)
	}()

	if got := selectDataDir(preferredPath, legacyPath); got != preferredPath {
		t.Errorf("selectDataDir() = %q, want %q", got, preferredPath)
	}
	if _, err := os.Stat(preferredPath); err == nil {
		t.Fatalf("expected failed copy not to leave partial preferred path")
	} else if !os.IsNotExist(err) {
		t.Fatalf("expected preferred path to be absent after failed copy, got err=%v", err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir(temp root): %v", err)
	}
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), currentDataDirName+".copy-") {
			t.Fatalf("expected failed copy to remove temp dir, found %q", entry.Name())
		}
	}
	if _, err := os.Stat(filepath.Join(legacyPath, "a-logs", "sidecar.log")); err != nil {
		t.Fatalf("expected legacy log to remain after failed copy: %v", err)
	}
	if _, err := os.Stat(filepath.Join(legacyPath, "sidecar.db")); err != nil {
		t.Fatalf("expected legacy DB to remain after failed copy: %v", err)
	}
}

func TestSelectDataDirPrefersLegacyWhenPreferredHasFreshDB(t *testing.T) {
	dir := t.TempDir()
	preferredPath := filepath.Join(dir, currentDataDirName)
	legacyPath := filepath.Join(dir, "Vivi Drop")

	if err := os.MkdirAll(preferredPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(preferredPath): %v", err)
	}
	if err := os.MkdirAll(legacyPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(legacyPath): %v", err)
	}
	if err := os.WriteFile(filepath.Join(preferredPath, "sidecar.db"), make([]byte, freshDBMaxBytes), 0o644); err != nil {
		t.Fatalf("WriteFile(preferred sidecar.db): %v", err)
	}
	if err := os.WriteFile(filepath.Join(legacyPath, "sidecar.db"), make([]byte, freshDBMaxBytes*4), 0o644); err != nil {
		t.Fatalf("WriteFile(legacy sidecar.db): %v", err)
	}

	if got := selectDataDir(preferredPath, legacyPath); got != preferredPath {
		t.Errorf("selectDataDir() = %q, want %q", got, preferredPath)
	}
	if !isDir(preferredPath + ".pre-legacy-copy") {
		t.Fatalf("expected fresh preferred dir to be backed up before migration")
	}
	if !isDir(legacyPath) {
		t.Fatalf("expected legacy path to remain after migration")
	}
}

func TestSelectDataDirPrefersLegacyWhenLegacyHasMeaningfulState(t *testing.T) {
	dir := t.TempDir()
	preferredPath := filepath.Join(dir, currentDataDirName)
	legacyPath := filepath.Join(dir, "Vivi Drop")

	writeSQLiteState(t, preferredPath, sqliteState{
		sessions:      0,
		uploads:       0,
		pairedDevices: 0,
		shareStatus:   "unknown",
	})
	writeSQLiteState(t, legacyPath, sqliteState{
		sessions:      2,
		uploads:       5,
		pairedDevices: 1,
		shareStatus:   "share_registered",
	})

	if got := selectDataDir(preferredPath, legacyPath); got != preferredPath {
		t.Errorf("selectDataDir() = %q, want %q", got, preferredPath)
	}
	if !isDir(preferredPath + ".pre-legacy-copy") {
		t.Fatalf("expected placeholder preferred dir to be backed up before migration")
	}
	if !isDir(legacyPath) {
		t.Fatalf("expected legacy path to remain after migration")
	}
	if inspectDataDirState(preferredPath).sessions != 2 {
		t.Fatalf("expected preferred path to use copied legacy state")
	}
}

func TestSelectDataDirKeepsPreferredWhenPreferredHasEstablishedDB(t *testing.T) {
	dir := t.TempDir()
	preferredPath := filepath.Join(dir, currentDataDirName)
	legacyPath := filepath.Join(dir, "Vivi Drop")

	if err := os.MkdirAll(preferredPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(preferredPath): %v", err)
	}
	if err := os.MkdirAll(legacyPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(legacyPath): %v", err)
	}
	if err := os.WriteFile(filepath.Join(preferredPath, "sidecar.db"), make([]byte, freshDBMaxBytes*4), 0o644); err != nil {
		t.Fatalf("WriteFile(preferred sidecar.db): %v", err)
	}
	if err := os.WriteFile(filepath.Join(legacyPath, "sidecar.db"), make([]byte, freshDBMaxBytes*2), 0o644); err != nil {
		t.Fatalf("WriteFile(legacy sidecar.db): %v", err)
	}

	if got := selectDataDir(preferredPath, legacyPath); got != preferredPath {
		t.Errorf("selectDataDir() = %q, want %q", got, preferredPath)
	}
	if _, err := os.Stat(filepath.Join(legacyPath, "sidecar.db")); err != nil {
		t.Fatalf("expected legacy DB to remain untouched: %v", err)
	}
}

func TestSelectDataDirKeepsPreferredWhenPreferredHasMeaningfulState(t *testing.T) {
	dir := t.TempDir()
	preferredPath := filepath.Join(dir, currentDataDirName)
	legacyPath := filepath.Join(dir, "Vivi Drop")

	writeSQLiteState(t, preferredPath, sqliteState{
		sessions:      4,
		uploads:       8,
		pairedDevices: 1,
		shareStatus:   "ready",
	})
	writeSQLiteState(t, legacyPath, sqliteState{
		sessions:      0,
		uploads:       0,
		pairedDevices: 0,
		shareStatus:   "unknown",
	})

	if got := selectDataDir(preferredPath, legacyPath); got != preferredPath {
		t.Errorf("selectDataDir() = %q, want %q", got, preferredPath)
	}
}

func TestSelectDataDirDefaultsToCurrentBrandDirWhenMissing(t *testing.T) {
	dir := t.TempDir()
	preferredPath := filepath.Join(dir, currentDataDirName)
	legacyPath := filepath.Join(dir, legacyDataDirName)

	if got := selectDataDir(preferredPath, legacyPath); got != preferredPath {
		t.Errorf("selectDataDir() = %q, want %q", got, preferredPath)
	}
}

type sqliteState struct {
	sessions      int
	uploads       int
	pairedDevices int
	shareStatus   string
}

func writeSQLiteState(t *testing.T, dirPath string, state sqliteState) {
	t.Helper()

	if err := os.MkdirAll(dirPath, 0o755); err != nil {
		t.Fatalf("MkdirAll(%q): %v", dirPath, err)
	}

	db, err := sql.Open("sqlite3", filepath.Join(dirPath, "sidecar.db"))
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	defer db.Close()

	for _, stmt := range []string{
		`CREATE TABLE sessions (id INTEGER PRIMARY KEY);`,
		`CREATE TABLE uploads (id INTEGER PRIMARY KEY);`,
		`CREATE TABLE paired_devices (id INTEGER PRIMARY KEY);`,
		`CREATE TABLE share_config (id INTEGER PRIMARY KEY, share_status TEXT NOT NULL);`,
		`INSERT INTO share_config (id, share_status) VALUES (1, '` + state.shareStatus + `');`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("db.Exec(%q): %v", stmt, err)
		}
	}

	insertRows := func(table string, count int) {
		t.Helper()
		for i := 0; i < count; i++ {
			if _, err := db.Exec(`INSERT INTO ` + table + ` DEFAULT VALUES;`); err != nil {
				t.Fatalf("insert into %s: %v", table, err)
			}
		}
	}

	insertRows("sessions", state.sessions)
	insertRows("uploads", state.uploads)
	insertRows("paired_devices", state.pairedDevices)
}
