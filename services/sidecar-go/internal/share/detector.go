package share

import (
	"bufio"
	"fmt"
	"net"
	"os/exec"
	"path/filepath"
	"strings"
)

// Status represents the current state of SMB share detection.
type Status string

const (
	StatusUnknown           Status = "unknown"
	StatusNeedsManualEnable Status = "needs_manual_enable"
	StatusShareRegistered   Status = "share_registered"
	StatusReady             Status = "ready"
	StatusError             Status = "error"
)

// Result holds the outcome of a share detection check.
type Result struct {
	Enabled   bool    `json:"enabled"`
	SmbURL    *string `json:"smbUrl"`
	ShareName *string `json:"shareName,omitempty"`
	Status    Status  `json:"status"`
	Error     *string `json:"lastError,omitempty"`
}

type sharePoint struct {
	Name      string
	Path      string
	SMBShared bool
}

// Detect verifies whether the current receive path is exposed via macOS file sharing.
// It relies on `sharing -l`, which reflects system sharing configuration more reliably
// than checking whether smbd happens to be running at this instant.
func Detect(receivePath, shareName string) Result {
	sharesOut, err := exec.Command("sharing", "-l").Output()
	if err != nil {
		errMsg := fmt.Sprintf("cannot list shares: %v", err)
		return Result{Status: StatusError, Error: &errMsg}
	}

	shares := parseSharePoints(string(sharesOut))
	return detectFromSharePoints(receivePath, shareName, shares, GetLocalIP())
}

func detectFromSharePoints(receivePath, shareName string, shares []sharePoint, localIP string) Result {
	smbShares := make([]sharePoint, 0, len(shares))
	for _, share := range shares {
		if share.SMBShared {
			smbShares = append(smbShares, share)
		}
	}
	if len(smbShares) == 0 {
		return Result{Status: StatusNeedsManualEnable}
	}

	normalizedReceivePath := filepath.Clean(receivePath)
	var nameAndPathMatch *sharePoint
	var pathMatch *sharePoint
	var nameMatch *sharePoint

	for i := range smbShares {
		share := &smbShares[i]
		if sharePathCoversReceivePath(share.Path, normalizedReceivePath) {
			if pathMatch == nil {
				pathMatch = share
			}
			if share.Name == shareName {
				nameAndPathMatch = share
				break
			}
		}
		if share.Name == shareName && nameMatch == nil {
			nameMatch = share
		}
	}

	switch {
	case nameAndPathMatch != nil:
		return Result{
			Enabled:   true,
			SmbURL:    buildSMBURL(localIP, nameAndPathMatch.Name),
			ShareName: strPtr(nameAndPathMatch.Name),
			Status:    StatusReady,
		}
	case pathMatch != nil:
		return Result{
			Enabled:   true,
			SmbURL:    buildSMBURL(localIP, pathMatch.Name),
			ShareName: strPtr(pathMatch.Name),
			Status:    StatusReady,
		}
	case nameMatch != nil:
		return Result{
			Enabled:   true,
			SmbURL:    buildSMBURL(localIP, nameMatch.Name),
			ShareName: strPtr(nameMatch.Name),
			Status:    StatusShareRegistered,
		}
	default:
		firstShare := smbShares[0]
		return Result{
			Enabled:   true,
			SmbURL:    buildSMBURL(localIP, firstShare.Name),
			ShareName: strPtr(firstShare.Name),
			Status:    StatusShareRegistered,
		}
	}
}

func parseSharePoints(output string) []sharePoint {
	scanner := bufio.NewScanner(strings.NewReader(output))
	entries := make([]sharePoint, 0)
	var current *sharePoint
	inSMBBlock := false

	flush := func() {
		if current == nil {
			return
		}
		if current.Name != "" || current.Path != "" {
			entries = append(entries, *current)
		}
		current = nil
	}

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		switch {
		case inSMBBlock && line == "}":
			inSMBBlock = false
			continue
		case inSMBBlock && strings.HasPrefix(line, "shared:"):
			current.SMBShared = strings.TrimSpace(strings.TrimPrefix(line, "shared:")) == "1"
			continue
		case inSMBBlock:
			continue
		}

		switch {
		case strings.HasPrefix(line, "name:"):
			flush()
			current = &sharePoint{
				Name: normalizeShareToken(strings.TrimSpace(strings.TrimPrefix(line, "name:"))),
			}
		case current != nil && strings.HasPrefix(line, "path:"):
			current.Path = filepath.Clean(strings.TrimSpace(strings.TrimPrefix(line, "path:")))
		case current != nil && strings.HasPrefix(line, "smb:"):
			current.SMBShared = true
			inSMBBlock = true
		}
	}
	flush()
	return entries
}

func normalizeShareToken(value string) string {
	return strings.Trim(value, "\"“”")
}

func sharePathCoversReceivePath(sharePath, receivePath string) bool {
	normalizedSharePath := filepath.Clean(sharePath)
	if normalizedSharePath == receivePath {
		return true
	}
	prefix := normalizedSharePath + string(filepath.Separator)
	return strings.HasPrefix(receivePath, prefix)
}

func buildSMBURL(localIP, shareName string) *string {
	if localIP == "" || shareName == "" {
		return nil
	}
	smbURL := fmt.Sprintf("smb://%s/%s", localIP, shareName)
	return &smbURL
}

func strPtr(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

// GetLocalIP returns the first non-loopback IPv4 address found on the host.
func GetLocalIP() string {
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
