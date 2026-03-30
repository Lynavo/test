//go:build windows

package disk

import "errors"

type DiskInfo struct {
	TotalBytes     uint64
	FreeBytes      uint64
	AvailableBytes uint64
}

func Check(path string) (*DiskInfo, error) {
	return nil, errors.New("disk space check is not implemented on windows")
}

func IsLow(path string, threshold int64) (bool, uint64, error) {
	_, err := Check(path)
	if err != nil {
		return false, 0, err
	}
	return false, 0, nil
}
