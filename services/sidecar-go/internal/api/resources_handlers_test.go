package api_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/nicksyncflow/sidecar/internal/api"
	"github.com/nicksyncflow/sidecar/internal/store"
)

func TestResourcesSharedListAddAndRemove(t *testing.T) {
	st, cfg, hub := testEnv(t)
	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	body := bytes.NewBufferString(`{
		"kind": "file",
		"displayName": "Manual.pdf",
		"localPath": "/tmp/Manual.pdf",
		"fileSize": 1234,
		"mediaType": "application/pdf"
	}`)
	resp, err := http.Post(srv.URL+"/resources/shared", "application/json", body)
	if err != nil {
		t.Fatalf("POST /resources/shared: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("POST /resources/shared status=%d, want 201", resp.StatusCode)
	}

	var created store.SharedResource
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		t.Fatalf("decode created resource: %v", err)
	}
	if created.ResourceID == "" {
		t.Fatal("resourceId is empty")
	}
	if created.Kind != "file" || created.DisplayName != "Manual.pdf" || created.Status != "available" {
		t.Fatalf("unexpected created resource: %+v", created)
	}

	resp, err = http.Get(srv.URL + "/resources/shared")
	if err != nil {
		t.Fatalf("GET /resources/shared: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /resources/shared status=%d, want 200", resp.StatusCode)
	}
	var listBody struct {
		Items []store.SharedResource `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&listBody); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(listBody.Items) != 1 || listBody.Items[0].ResourceID != created.ResourceID {
		t.Fatalf("unexpected shared resources list: %+v", listBody.Items)
	}

	req, err := http.NewRequest(http.MethodDelete, srv.URL+"/resources/shared/"+created.ResourceID, nil)
	if err != nil {
		t.Fatalf("NewRequest DELETE: %v", err)
	}
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("DELETE /resources/shared/{id}: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("DELETE status=%d, want 200", resp.StatusCode)
	}

	resp, err = http.Get(srv.URL + "/resources/shared")
	if err != nil {
		t.Fatalf("GET /resources/shared after delete: %v", err)
	}
	defer resp.Body.Close()
	var afterDelete struct {
		Items []store.SharedResource `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&afterDelete); err != nil {
		t.Fatalf("decode after delete: %v", err)
	}
	if len(afterDelete.Items) != 0 {
		t.Fatalf("expected removed resource hidden, got %+v", afterDelete.Items)
	}
}

func TestResourcesReceivedLibraryList(t *testing.T) {
	st, cfg, hub := testEnv(t)
	insertPairedDeviceWithStableID(t, st, "client-001", "Alice iPhone", "Alice iPhone", "stable-001", "2026-06-14T08:00:00Z")
	completedAt := "2026-06-14T09:00:00Z"
	finalPath := filepath.Join(t.TempDir(), "photo.jpg")
	if err := st.UpsertUpload(store.Upload{
		FileKey:              "file-001",
		ClientID:             "client-001",
		OriginalFilename:     "photo.jpg",
		MediaType:            "image",
		FileSize:             2048,
		Status:               "completed",
		FinalPath:            &finalPath,
		CommittedBytes:       2048,
		ActiveTransmissionMs: 250,
		CompletedAt:          &completedAt,
		UpdatedAt:            completedAt,
	}); err != nil {
		t.Fatalf("UpsertUpload: %v", err)
	}

	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/resources/received")
	if err != nil {
		t.Fatalf("GET /resources/received: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /resources/received status=%d, want 200", resp.StatusCode)
	}
	var receivedBody struct {
		Items []store.ReceivedLibraryItem `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&receivedBody); err != nil {
		t.Fatalf("decode received library: %v", err)
	}
	if len(receivedBody.Items) != 1 {
		t.Fatalf("expected 1 received item, got %d", len(receivedBody.Items))
	}
	if receivedBody.Items[0].FileKey != "file-001" || receivedBody.Items[0].ShareStatus != "not_shared" {
		t.Fatalf("unexpected received item: %+v", receivedBody.Items[0])
	}
}

func TestMobileResourcesListDownloadAndAccessRecords(t *testing.T) {
	st, cfg, hub := testEnv(t)
	desktopDeviceID, err := st.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID: %v", err)
	}
	sharedDir := t.TempDir()
	sharedPath := filepath.Join(sharedDir, "Manual.pdf")
	if err := os.WriteFile(sharedPath, []byte("manual bytes"), 0o644); err != nil {
		t.Fatalf("write shared file: %v", err)
	}
	resource, err := st.AddSharedResource(store.SharedResourceInput{
		DesktopDeviceID: desktopDeviceID,
		Kind:            "file",
		DisplayName:     "Manual.pdf",
		LocalPath:       &sharedPath,
		Status:          "available",
	})
	if err != nil {
		t.Fatalf("AddSharedResource: %v", err)
	}

	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/resources/mobile/shared?clientId=client-001&clientName=Alice%20iPhone")
	if err != nil {
		t.Fatalf("GET /resources/mobile/shared: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET mobile shared status=%d, want 200", resp.StatusCode)
	}
	var sharedBody struct {
		Items []store.SharedResource `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&sharedBody); err != nil {
		t.Fatalf("decode mobile shared: %v", err)
	}
	if len(sharedBody.Items) != 1 || sharedBody.Items[0].ResourceID != resource.ResourceID {
		t.Fatalf("unexpected mobile shared list: %+v", sharedBody.Items)
	}

	resp, err = http.Get(srv.URL + "/resources/mobile/download/unknown-resource?clientId=client-001")
	if err != nil {
		t.Fatalf("GET unknown download: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("unknown download status=%d, want 404", resp.StatusCode)
	}

	resp, err = http.Get(srv.URL + "/resources/mobile/download/" + resource.ResourceID + "?clientId=client-001&clientName=Alice%20iPhone")
	if err != nil {
		t.Fatalf("GET mobile download: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("download status=%d, want 200", resp.StatusCode)
	}
	downloaded, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read download: %v", err)
	}
	if string(downloaded) != "manual bytes" {
		t.Fatalf("download body=%q, want manual bytes", string(downloaded))
	}

	records, err := st.ListAccessRecords(desktopDeviceID, &[]string{"client-001"}[0])
	if err != nil {
		t.Fatalf("ListAccessRecords: %v", err)
	}
	if len(records) != 3 {
		t.Fatalf("expected 3 access records for list, failed download, download; got %d", len(records))
	}
	actions := map[string]bool{}
	results := map[string]bool{}
	for _, record := range records {
		actions[record.Action] = true
		results[record.Result] = true
	}
	if !actions["list"] || !actions["download"] {
		t.Fatalf("expected list and download access actions, got %+v", actions)
	}
	if !results["ok"] || !results["not_found"] {
		t.Fatalf("expected ok and not_found access results, got %+v", results)
	}
}

func TestMobileReceivedResourcesCreatesAccessRecord(t *testing.T) {
	st, cfg, hub := testEnv(t)
	desktopDeviceID, err := st.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID: %v", err)
	}

	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/resources/mobile/received?clientId=client-001&clientName=Alice%20iPhone")
	if err != nil {
		t.Fatalf("GET /resources/mobile/received: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET mobile received status=%d, want 200", resp.StatusCode)
	}

	records, err := st.ListAccessRecords(desktopDeviceID, &[]string{"client-001"}[0])
	if err != nil {
		t.Fatalf("ListAccessRecords: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 access record, got %d", len(records))
	}
	if records[0].ResourceID != "received_library" || records[0].Action != "list" || records[0].Result != "ok" {
		t.Fatalf("unexpected access record: %+v", records[0])
	}
}
