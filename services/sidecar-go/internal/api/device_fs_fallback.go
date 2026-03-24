package api

import (
	"errors"
	"os"
	"path/filepath"
	"sort"
	"time"

	internalserver "github.com/nicksyncflow/sidecar/internal/server"
	"github.com/nicksyncflow/sidecar/internal/store"
)

func (s *Server) deviceDirPath(deviceID string) string {
	dirName := deviceID

	device, err := s.store.GetPairedDevice(deviceID)
	if err == nil {
		switch {
		case device.ReceiveDirName != nil && *device.ReceiveDirName != "":
			dirName = *device.ReceiveDirName
		case device.DeviceAlias != nil && *device.DeviceAlias != "":
			dirName = internalserver.SanitizeDirName(*device.DeviceAlias)
		case device.ClientName != "":
			dirName = internalserver.SanitizeDirName(device.ClientName)
		}
	}

	return filepath.Join(s.config.ReceiveDir, dirName)
}

func (s *Server) filesystemDates(deviceID string) ([]string, error) {
	deviceDir := s.deviceDirPath(deviceID)
	entries, err := os.ReadDir(deviceDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []string{}, nil
		}
		return nil, err
	}

	dates := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		if _, err := time.Parse("2006-01-02", name); err == nil {
			dates = append(dates, name)
		}
	}

	sort.Slice(dates, func(i, j int) bool {
		return dates[i] > dates[j]
	})
	return dates, nil
}

func mergeDateKeys(primary, fallback []string) []string {
	seen := make(map[string]struct{}, len(primary)+len(fallback))
	merged := make([]string, 0, len(primary)+len(fallback))

	for _, date := range append(primary, fallback...) {
		if date == "" {
			continue
		}
		if _, ok := seen[date]; ok {
			continue
		}
		seen[date] = struct{}{}
		merged = append(merged, date)
	}

	sort.Slice(merged, func(i, j int) bool {
		return merged[i] > merged[j]
	})
	return merged
}

func (s *Server) filesystemUploads(deviceID, date string) ([]store.Upload, error) {
	dateDir := filepath.Join(s.deviceDirPath(deviceID), date)
	entries, err := os.ReadDir(dateDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []store.Upload{}, nil
		}
		return nil, err
	}

	type uploadWithTime struct {
		upload store.Upload
		ts     time.Time
	}

	files := make([]uploadWithTime, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		if !info.Mode().IsRegular() {
			continue
		}

		fullPath := filepath.Join(dateDir, entry.Name())
		relPath, err := filepath.Rel(s.config.ReceiveDir, fullPath)
		if err != nil {
			relPath = filepath.Base(fullPath)
		}

		completedAt := info.ModTime().UTC().Format(time.RFC3339)
		finalPath := relPath
		files = append(files, uploadWithTime{
			ts: info.ModTime(),
			upload: store.Upload{
				FileKey:              relPath,
				ClientID:             deviceID,
				OriginalFilename:     entry.Name(),
				FileSize:             info.Size(),
				Status:               "completed",
				FinalPath:            &finalPath,
				ActiveTransmissionMs: 0,
				CompletedAt:          &completedAt,
				UpdatedAt:            completedAt,
			},
		})
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].ts.After(files[j].ts)
	})

	uploads := make([]store.Upload, 0, len(files))
	for _, file := range files {
		uploads = append(uploads, file.upload)
	}
	return uploads, nil
}
