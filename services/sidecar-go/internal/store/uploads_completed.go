package store

import "fmt"

// ListCompletedUploadsByDevice returns every completed upload row for a client.
func (s *Store) ListCompletedUploadsByDevice(clientID string) ([]Upload, error) {
	rows, err := s.db.Query(`
		SELECT file_key, session_id, client_id, original_filename, media_type,
		       file_size, created_at_remote, modified_at_remote, status, part_path, final_path,
		       committed_bytes, sha256, active_transmission_ms, completed_at, updated_at
		FROM uploads
		WHERE client_id = ? AND status = 'completed'
		ORDER BY COALESCE(completed_at, updated_at) DESC, file_key DESC`, clientID,
	)
	if err != nil {
		return nil, fmt.Errorf("list completed uploads for %q: %w", clientID, err)
	}
	defer rows.Close()

	uploads := make([]Upload, 0)
	for rows.Next() {
		var u Upload
		if err := rows.Scan(
			&u.FileKey, &u.SessionID, &u.ClientID, &u.OriginalFilename, &u.MediaType,
			&u.FileSize, &u.CreatedAtRemote, &u.ModifiedAtRemote, &u.Status, &u.PartPath, &u.FinalPath,
			&u.CommittedBytes, &u.SHA256, &u.ActiveTransmissionMs, &u.CompletedAt, &u.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan completed upload: %w", err)
		}
		uploads = append(uploads, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate completed uploads for %q: %w", clientID, err)
	}

	return uploads, nil
}
