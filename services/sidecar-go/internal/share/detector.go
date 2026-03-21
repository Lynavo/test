package share

import (
	"fmt"
	"net"
	"os/exec"
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
	Enabled bool    `json:"enabled"`
	SmbURL  *string `json:"smbUrl"`
	Status  Status  `json:"status"`
	Error   *string `json:"lastError,omitempty"`
}

// Detect performs a 4-step SMB share status verification:
//  1. Check if smbd is running
//  2. Check if shareName exists in the system share list
//  3. Verify the share path matches receivePath
//  4. Build the smb:// URL using the local IP
func Detect(receivePath, shareName string) Result {
	// Step 1: Check if smbd is running
	out, err := exec.Command("pgrep", "-x", "smbd").Output()
	if err != nil || len(strings.TrimSpace(string(out))) == 0 {
		return Result{Status: StatusNeedsManualEnable}
	}

	// Step 2: Check if share name exists in system share list
	sharesOut, err := exec.Command("sharing", "-l").Output()
	if err != nil {
		errMsg := fmt.Sprintf("cannot list shares: %v", err)
		return Result{Status: StatusError, Error: &errMsg}
	}

	sharesStr := string(sharesOut)
	if !strings.Contains(sharesStr, shareName) {
		return Result{Status: StatusShareRegistered, Enabled: true}
	}

	// Step 3: Verify share path contains receivePath
	shareFound := false
	for _, line := range strings.Split(sharesStr, "\n") {
		if strings.Contains(line, "name:") && strings.Contains(line, shareName) {
			shareFound = true
		}
		if shareFound && strings.Contains(line, "path:") {
			pathPart := strings.TrimSpace(strings.SplitN(line, "path:", 2)[1])
			if pathPart != "" && !strings.HasPrefix(receivePath, pathPart) {
				return Result{Status: StatusShareRegistered, Enabled: true}
			}
			break
		}
	}

	// Step 4: Get local IP and build SMB URL
	ip := GetLocalIP()
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
