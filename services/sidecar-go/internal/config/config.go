package config

import (
	"database/sql"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/mattn/go-sqlite3"
	"gopkg.in/yaml.v3"
)

const (
	currentDataDirName        = "Lynavo Drive"
	legacyViviDropDirName     = "Vivi Drop"
	legacyDataDirName         = "小豹闪传"
	preLegacyCopyBackupSuffix = ".pre-legacy-copy"
	freshDBMaxBytes           = 8 * 1024
)

type Config struct {
	HTTPPort   int    `yaml:"http_port"`
	TCPPort    int    `yaml:"tcp_port"`
	DataDir    string `yaml:"data_dir"`
	ReceiveDir string `yaml:"receive_dir"`
	// PersonalShareDir is the account-scoped directory exposed through /personal/*.
	// It is independent from RootDir/ReceiveDir so users can share a whole disk.
	PersonalShareDir string `yaml:"personal_share_dir"`
	LogLevel         string `yaml:"log_level"`
	DeviceName       string `yaml:"device_name"`
	// DeviceIP overrides the IP address advertised in the Bonjour/mDNS TXT
	// record.  Leave empty to let the sidecar auto-detect the best LAN address.
	// Useful on multi-homed Windows machines where auto-detection picks the
	// wrong interface (e.g. wired vs. WiFi on different subnets).
	// Can also be set via the SYNCFLOW_DEVICE_IP environment variable.
	DeviceIP              string `yaml:"device_ip"`
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
		c.DataDir = defaultDataDir()
	}
	if c.ReceiveDir == "" {
		c.ReceiveDir = filepath.Join(c.DataDir, "received")
	}
	if c.PersonalShareDir == "" {
		c.PersonalShareDir = defaultPersonalShareDir(c.RootDir())
	}
	if c.DeviceName == "" {
		hostname, _ := os.Hostname()
		// Remove .local suffix for friendlier display name
		c.DeviceName = strings.TrimSuffix(hostname, ".local")
	}
	// Environment variable takes precedence over the YAML value so that
	// developers can override the IP without touching the config file.
	if env := strings.TrimSpace(os.Getenv("SYNCFLOW_DEVICE_IP")); env != "" {
		c.DeviceIP = env
	}
}

func defaultDataDir() string {
	configDir, err := os.UserConfigDir()
	if err == nil && configDir != "" {
		return selectDataDir(
			filepath.Join(configDir, currentDataDirName),
			filepath.Join(configDir, legacyViviDropDirName),
			filepath.Join(configDir, legacyDataDirName),
		)
	}

	home, _ := os.UserHomeDir()
	return selectDataDir(
		filepath.Join(home, ".config", currentDataDirName),
		filepath.Join(home, ".config", legacyViviDropDirName),
		filepath.Join(home, ".config", legacyDataDirName),
	)
}

func defaultPersonalShareDir(fallbackRoot string) string {
	home, err := os.UserHomeDir()
	if err == nil && strings.TrimSpace(home) != "" {
		return home
	}
	return filepath.Join(fallbackRoot, "personal")
}

func selectDataDir(preferredPath string, legacyPaths ...string) string {
	legacyPath, ok := bestLegacyDataDir(legacyPaths)
	if !ok {
		return preferredPath
	}

	if shouldPreferLegacyDataDir(preferredPath, legacyPath) {
		if copyLegacyDataDir(preferredPath, legacyPath) {
			return preferredPath
		}
		return preferredPath
	}
	if isDir(preferredPath) {
		return preferredPath
	}

	if copyLegacyDataDir(preferredPath, legacyPath) {
		return preferredPath
	}
	return preferredPath
}

func copyLegacyDataDir(preferredPath string, legacyPath string) bool {
	if !isDir(legacyPath) {
		return false
	}

	if !isDir(preferredPath) {
		return copyLegacyDataDirToMissingPreferred(preferredPath, legacyPath)
	}

	preferredState := inspectDataDirState(preferredPath)
	if preferredState.hasMeaningfulState() {
		return false
	}

	backupPath := preferredPath + preLegacyCopyBackupSuffix
	if _, err := os.Stat(backupPath); err == nil {
		return false
	} else if !os.IsNotExist(err) {
		return false
	}

	if err := os.Rename(preferredPath, backupPath); err != nil {
		return false
	}

	if err := copyDir(legacyPath, preferredPath); err != nil {
		_ = os.RemoveAll(preferredPath)
		_ = os.Rename(backupPath, preferredPath)
		return false
	}

	return true
}

func copyLegacyDataDirToMissingPreferred(preferredPath string, legacyPath string) bool {
	if _, err := os.Stat(preferredPath); err == nil {
		return false
	} else if !os.IsNotExist(err) {
		return false
	}

	parentDir := filepath.Dir(preferredPath)
	if err := os.MkdirAll(parentDir, 0o755); err != nil {
		return false
	}

	tempPath, err := os.MkdirTemp(parentDir, filepath.Base(preferredPath)+".copy-")
	if err != nil {
		return false
	}
	if err := copyDir(legacyPath, tempPath); err != nil {
		_ = os.RemoveAll(tempPath)
		return false
	}
	if err := os.Rename(tempPath, preferredPath); err != nil {
		_ = os.RemoveAll(tempPath)
		return false
	}
	return true
}

func bestLegacyDataDir(legacyPaths []string) (string, bool) {
	bestPath := ""
	bestScore := -1
	for _, path := range legacyPaths {
		if !isDir(path) {
			continue
		}
		state := inspectDataDirState(path)
		score := 1
		if state.hasDB {
			score = 2
		}
		if state.hasDB && state.dbSize > freshDBMaxBytes {
			score = 3
		}
		if state.hasMeaningfulState() {
			score = 4
		}
		if score > bestScore {
			bestPath = path
			bestScore = score
		}
	}
	return bestPath, bestPath != ""
}

func shouldPreferLegacyDataDir(preferredPath string, legacyPath string) bool {
	if !isDir(legacyPath) {
		return false
	}
	if !isDir(preferredPath) {
		return true
	}

	legacyState := inspectDataDirState(legacyPath)
	preferredState := inspectDataDirState(preferredPath)

	if preferredState.hasMeaningfulState() {
		return false
	}

	if !preferredState.hasDB {
		return legacyState.hasDB || isDir(legacyPath)
	}

	if legacyState.hasMeaningfulState() && !preferredState.hasMeaningfulState() {
		return true
	}

	if !legacyState.hasDB {
		return false
	}

	return preferredState.dbSize <= freshDBMaxBytes && legacyState.dbSize > preferredState.dbSize
}

func copyDir(from string, to string) error {
	from = filepath.Clean(from)
	to = filepath.Clean(to)
	sourceInfo, err := os.Stat(from)
	if err != nil {
		return fmt.Errorf("stat source dir: %w", err)
	}
	if !sourceInfo.IsDir() {
		return fmt.Errorf("source is not a directory: %s", from)
	}
	if err := os.MkdirAll(to, sourceInfo.Mode().Perm()); err != nil {
		return fmt.Errorf("create target dir: %w", err)
	}

	return filepath.WalkDir(from, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == from {
			return nil
		}
		rel, err := filepath.Rel(from, path)
		if err != nil {
			return err
		}
		target := filepath.Join(to, rel)
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return os.MkdirAll(target, info.Mode().Perm())
		}
		if entry.Type()&os.ModeSymlink != 0 {
			linkTarget, err := os.Readlink(path)
			if err != nil {
				return err
			}
			return os.Symlink(linkTarget, target)
		}
		if !entry.Type().IsRegular() {
			return nil
		}
		return copyFile(path, target, info.Mode().Perm())
	})
}

func copyFile(from string, to string, perm fs.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
		return err
	}
	source, err := os.Open(from)
	if err != nil {
		return err
	}
	defer source.Close()

	target, err := os.OpenFile(to, os.O_WRONLY|os.O_CREATE|os.O_EXCL, perm)
	if err != nil {
		return err
	}
	defer target.Close()

	if _, err := io.Copy(target, source); err != nil {
		return err
	}
	return target.Chmod(perm)
}

type dataDirState struct {
	hasDB         bool
	dbSize        int64
	sessions      int
	uploads       int
	pairedDevices int
	shareStatus   string
}

func (s dataDirState) hasMeaningfulState() bool {
	return s.sessions > 0 ||
		s.uploads > 0 ||
		s.pairedDevices > 0 ||
		(s.shareStatus != "" && s.shareStatus != "unknown")
}

func inspectDataDirState(dirPath string) dataDirState {
	size, hasDB := dbSize(dirPath)
	if !hasDB {
		return dataDirState{}
	}

	state := dataDirState{
		hasDB:  true,
		dbSize: size,
	}

	db, err := sql.Open("sqlite3", filepath.Join(dirPath, "sidecar.db"))
	if err != nil {
		return state
	}
	defer db.Close()

	row := db.QueryRow(`
		SELECT
			(SELECT COUNT(*) FROM sessions),
			(SELECT COUNT(*) FROM uploads),
			(SELECT COUNT(*) FROM paired_devices),
			COALESCE((SELECT share_status FROM share_config WHERE id = 1), '')
	`)
	if err := row.Scan(&state.sessions, &state.uploads, &state.pairedDevices, &state.shareStatus); err != nil {
		return state
	}

	return state
}

func dbSize(dirPath string) (int64, bool) {
	info, err := os.Stat(filepath.Join(dirPath, "sidecar.db"))
	if err != nil || info.IsDir() {
		return 0, false
	}
	return info.Size(), true
}

func isDir(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func (c *Config) DBPath() string {
	return filepath.Join(c.DataDir, "sidecar.db")
}

func (c *Config) StagingDir() string {
	if c.ReceiveDir != "" {
		if c.usesManagedReceiveLayout() || c.usesLegacyDataReceiveLayout() {
			return filepath.Join(c.RootDir(), "staging")
		}
		return filepath.Join(filepath.Dir(c.ReceiveDir), "staging")
	}
	return filepath.Join(c.DataDir, "staging")
}

func (c *Config) LegacyStagingDir() string {
	return filepath.Join(c.DataDir, "staging")
}

func (c *Config) LogDir() string {
	return filepath.Join(c.DataDir, "logs")
}

func (c *Config) RootDir() string {
	if c.usesPersonalReceiveLayout() {
		return filepath.Dir(filepath.Dir(c.ReceiveDir))
	}
	if c.usesManagedReceiveLayout() {
		return filepath.Dir(c.ReceiveDir)
	}
	return c.DataDir
}

func (c *Config) PersonalDir() string {
	if strings.TrimSpace(c.PersonalShareDir) != "" {
		return c.PersonalShareDir
	}
	return filepath.Join(c.RootDir(), "personal")
}

func (c *Config) SharedDir() string {
	return filepath.Join(c.RootDir(), "shared")
}

func (c *Config) usesCustomReceiveLayout() bool {
	return c.ReceiveDir != "" && !c.usesManagedReceiveLayout() && !c.usesLegacyDataReceiveLayout()
}

func (c *Config) usesPersonalReceiveLayout() bool {
	if c.ReceiveDir == "" {
		return false
	}
	return filepath.Base(c.ReceiveDir) == "received" &&
		filepath.Base(filepath.Dir(c.ReceiveDir)) == "personal"
}

func (c *Config) usesManagedReceiveLayout() bool {
	if c.ReceiveDir == "" {
		return false
	}
	return filepath.Base(c.ReceiveDir) == "received"
}

func (c *Config) usesLegacyDataReceiveLayout() bool {
	if c.ReceiveDir == "" || c.DataDir == "" {
		return false
	}
	return filepath.Clean(c.ReceiveDir) == filepath.Join(filepath.Clean(c.DataDir), "received")
}
