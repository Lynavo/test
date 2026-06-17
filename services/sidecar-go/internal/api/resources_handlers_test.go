package api_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
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
		"kind": "shared_file",
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
	if created.Kind != "shared_file" || created.DisplayName != "Manual.pdf" || created.Status != "available" {
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
	insertPairedDeviceWithStableID(t, st, "client-001", "Alice iPhone", "Alice iPhone", "stable-001", "2026-06-14T08:00:00Z")
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
		Kind:            "shared_file",
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
	foundManual := false
	foundVirtual := false
	for _, item := range sharedBody.Items {
		if item.ResourceID == resource.ResourceID {
			foundManual = true
		}
		if item.ResourceID == "user_home" || strings.HasPrefix(item.ResourceID, "drive_") {
			foundVirtual = true
		}
	}
	if !foundManual {
		t.Fatalf("manual resource not found in mobile shared list: %+v", sharedBody.Items)
	}
	if !foundVirtual {
		t.Fatalf("virtual default resource (user_home or drive) not found in mobile shared list: %+v", sharedBody.Items)
	}

	resp, err = http.Get(srv.URL + "/resources/mobile/download/unknown-resource?clientId=client-001")
	if err != nil {
		t.Fatalf("GET unknown download: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("unknown download status=%d, want 404", resp.StatusCode)
	}
	recordsAfterUnknown, err := st.ListAccessRecords(desktopDeviceID, &[]string{"client-001"}[0])
	if err != nil {
		t.Fatalf("ListAccessRecords after unknown download: %v", err)
	}
	if len(recordsAfterUnknown) != 1 {
		t.Fatalf("unknown resource download must not create fake access record, got %d records", len(recordsAfterUnknown))
	}

	resp, err = http.Post(srv.URL+"/resources/mobile/view/"+resource.ResourceID+"?clientId=client-001&clientName=Alice%20iPhone", "application/json", nil)
	if err != nil {
		t.Fatalf("POST mobile view: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("view status=%d, want 200", resp.StatusCode)
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
		t.Fatalf("expected 3 access records for list, view, download; got %d", len(records))
	}
	actions := map[string]bool{}
	results := map[string]bool{}
	kinds := map[string]bool{}
	for _, record := range records {
		actions[record.Action] = true
		results[record.Result] = true
		kinds[record.ResourceKind] = true
		if !isContractAccessAction(record.Action) {
			t.Fatalf("access record action must match contracts enum, got %+v", record)
		}
		if !isContractAccessResult(record.Result) {
			t.Fatalf("access record result must match contracts enum, got %+v", record)
		}
		if !isContractResourceKind(record.ResourceKind) {
			t.Fatalf("access record resource kind must match contracts enum, got %+v", record)
		}
	}
	if !actions["list"] || !actions["view"] || !actions["download"] {
		t.Fatalf("expected list and download access actions, got %+v", actions)
	}
	if !results["ok"] || results["not_found"] {
		t.Fatalf("expected only contract-compatible ok results, got %+v", results)
	}
	if !kinds["shared_file"] {
		t.Fatalf("expected contract-compatible resource kind shared_file, got %+v", kinds)
	}
}

func TestMobileSharedFolderRootListing(t *testing.T) {
	st, cfg, hub := testEnv(t)
	insertPairedDeviceWithStableID(t, st, "client-001", "Alice iPhone", "Alice iPhone", "stable-001", "2026-06-14T08:00:00Z")
	desktopDeviceID, err := st.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID: %v", err)
	}
	sharedRoot := t.TempDir()
	readmePath := filepath.Join(sharedRoot, "Readme.txt")
	if err := os.WriteFile(readmePath, []byte("hello"), 0o644); err != nil {
		t.Fatalf("write shared file: %v", err)
	}
	if err := os.Mkdir(filepath.Join(sharedRoot, "Designs"), 0o755); err != nil {
		t.Fatalf("mkdir nested folder: %v", err)
	}
	resource, err := st.AddSharedResource(store.SharedResourceInput{
		DesktopDeviceID: desktopDeviceID,
		Kind:            "shared_folder",
		DisplayName:     "Project Files",
		LocalPath:       &sharedRoot,
		Status:          "available",
	})
	if err != nil {
		t.Fatalf("AddSharedResource folder: %v", err)
	}

	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/resources/mobile/shared/" + resource.ResourceID + "/list?clientId=client-001&clientName=Alice%20iPhone")
	if err != nil {
		t.Fatalf("GET mobile shared folder root list: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET mobile shared folder root list status=%d, want 200", resp.StatusCode)
	}
	var body mobileDirectoryListingResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode mobile shared folder root list: %v", err)
	}
	if body.Path != "" || body.TotalCount != 2 {
		t.Fatalf("unexpected root listing metadata: %+v", body)
	}
	files := directoryFilesByName(body.Files)
	if files["Readme.txt"].Path != "Readme.txt" || files["Readme.txt"].Type != "document" || files["Readme.txt"].IsDirectory {
		t.Fatalf("unexpected file entry: %+v", files["Readme.txt"])
	}
	if files["Designs"].Path != "Designs" || files["Designs"].Type != "other" || !files["Designs"].IsDirectory {
		t.Fatalf("unexpected folder entry: %+v", files["Designs"])
	}

	records, err := st.ListAccessRecords(desktopDeviceID, &[]string{"client-001"}[0])
	if err != nil {
		t.Fatalf("ListAccessRecords: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 list access record, got %d", len(records))
	}
	if records[0].ResourceID != resource.ResourceID || records[0].ResourceKind != "shared_folder" || records[0].ResourceName != "Project Files" || records[0].Action != "list" || records[0].Result != "ok" {
		t.Fatalf("unexpected list access record: %+v", records[0])
	}
}

func TestMobileSharedFolderNestedListing(t *testing.T) {
	st, cfg, hub := testEnv(t)
	insertPairedDeviceWithStableID(t, st, "client-001", "Alice iPhone", "Alice iPhone", "stable-001", "2026-06-14T08:00:00Z")
	desktopDeviceID, err := st.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID: %v", err)
	}
	sharedRoot := t.TempDir()
	nestedDir := filepath.Join(sharedRoot, "Designs", "Screens")
	if err := os.MkdirAll(nestedDir, 0o755); err != nil {
		t.Fatalf("mkdir nested folder: %v", err)
	}
	if err := os.WriteFile(filepath.Join(nestedDir, "Home.png"), []byte("png"), 0o644); err != nil {
		t.Fatalf("write nested file: %v", err)
	}
	resource, err := st.AddSharedResource(store.SharedResourceInput{
		DesktopDeviceID: desktopDeviceID,
		Kind:            "shared_folder",
		DisplayName:     "Project Files",
		LocalPath:       &sharedRoot,
		Status:          "available",
	})
	if err != nil {
		t.Fatalf("AddSharedResource folder: %v", err)
	}

	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/resources/mobile/shared/" + resource.ResourceID + "/list/Designs/Screens?clientId=client-001")
	if err != nil {
		t.Fatalf("GET mobile shared folder nested list: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET mobile shared folder nested list status=%d, want 200", resp.StatusCode)
	}
	var body mobileDirectoryListingResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode mobile shared folder nested list: %v", err)
	}
	if body.Path != "Designs/Screens" || body.TotalCount != 1 {
		t.Fatalf("unexpected nested listing metadata: %+v", body)
	}
	files := directoryFilesByName(body.Files)
	if files["Home.png"].Path != "Designs/Screens/Home.png" || files["Home.png"].Type != "image" || files["Home.png"].IsDirectory {
		t.Fatalf("unexpected nested image entry: %+v", files["Home.png"])
	}

	records, err := st.ListAccessRecords(desktopDeviceID, &[]string{"client-001"}[0])
	if err != nil {
		t.Fatalf("ListAccessRecords: %v", err)
	}
	if len(records) != 1 || records[0].ResourceID != resource.ResourceID || records[0].Action != "list" || records[0].Result != "ok" {
		t.Fatalf("unexpected nested list access records: %+v", records)
	}
}

func TestMobileSharedFolderListingRejectsPathTraversal(t *testing.T) {
	st, cfg, hub := testEnv(t)
	insertPairedDeviceWithStableID(t, st, "client-001", "Alice iPhone", "Alice iPhone", "stable-001", "2026-06-14T08:00:00Z")
	desktopDeviceID, err := st.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID: %v", err)
	}
	sharedRoot := t.TempDir()
	resource, err := st.AddSharedResource(store.SharedResourceInput{
		DesktopDeviceID: desktopDeviceID,
		Kind:            "shared_folder",
		DisplayName:     "Project Files",
		LocalPath:       &sharedRoot,
		Status:          "available",
	})
	if err != nil {
		t.Fatalf("AddSharedResource folder: %v", err)
	}

	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/resources/mobile/shared/" + resource.ResourceID + "/list/%2e%2e?clientId=client-001")
	if err != nil {
		t.Fatalf("GET mobile shared folder traversal list: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("GET mobile shared folder traversal list status=%d, want 400", resp.StatusCode)
	}
	records, err := st.ListAccessRecords(desktopDeviceID, &[]string{"client-001"}[0])
	if err != nil {
		t.Fatalf("ListAccessRecords: %v", err)
	}
	if len(records) != 0 {
		t.Fatalf("path traversal must not create access record, got %+v", records)
	}
}

func TestMobileSharedFolderListingRejectsSharedFileResource(t *testing.T) {
	st, cfg, hub := testEnv(t)
	insertPairedDeviceWithStableID(t, st, "client-001", "Alice iPhone", "Alice iPhone", "stable-001", "2026-06-14T08:00:00Z")
	desktopDeviceID, err := st.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID: %v", err)
	}
	sharedPath := filepath.Join(t.TempDir(), "Manual.pdf")
	if err := os.WriteFile(sharedPath, []byte("manual bytes"), 0o644); err != nil {
		t.Fatalf("write shared file: %v", err)
	}
	resource, err := st.AddSharedResource(store.SharedResourceInput{
		DesktopDeviceID: desktopDeviceID,
		Kind:            "shared_file",
		DisplayName:     "Manual.pdf",
		LocalPath:       &sharedPath,
		Status:          "available",
	})
	if err != nil {
		t.Fatalf("AddSharedResource file: %v", err)
	}

	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/resources/mobile/shared/" + resource.ResourceID + "/list?clientId=client-001")
	if err != nil {
		t.Fatalf("GET mobile shared file list: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("GET mobile shared file list status=%d, want 400", resp.StatusCode)
	}
	records, err := st.ListAccessRecords(desktopDeviceID, &[]string{"client-001"}[0])
	if err != nil {
		t.Fatalf("ListAccessRecords: %v", err)
	}
	if len(records) != 0 {
		t.Fatalf("shared_file listing must not create access record, got %+v", records)
	}
}

func TestMobileResourceAccessNormalizesLegacyResourceKind(t *testing.T) {
	st, cfg, hub := testEnv(t)
	insertPairedDeviceWithStableID(t, st, "client-001", "Alice iPhone", "Alice iPhone", "stable-001", "2026-06-14T08:00:00Z")
	insertPairedDeviceWithStableID(t, st, "legacy-client", "Legacy Client", "Legacy Client", "stable-legacy", "2026-06-14T08:00:00Z")
	desktopDeviceID, err := st.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID: %v", err)
	}
	sharedPath := filepath.Join(t.TempDir(), "Legacy.pdf")
	if err := os.WriteFile(sharedPath, []byte("legacy bytes"), 0o644); err != nil {
		t.Fatalf("write legacy shared file: %v", err)
	}
	resource, err := st.AddSharedResource(store.SharedResourceInput{
		DesktopDeviceID: desktopDeviceID,
		Kind:            "file",
		DisplayName:     "Legacy.pdf",
		LocalPath:       &sharedPath,
		Status:          "available",
	})
	if err != nil {
		t.Fatalf("AddSharedResource legacy file: %v", err)
	}

	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/resources/mobile/shared?clientId=legacy-client")
	if err != nil {
		t.Fatalf("GET legacy mobile shared: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET legacy mobile shared status=%d, want 200", resp.StatusCode)
	}
	var sharedBody struct {
		Items []store.SharedResource `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&sharedBody); err != nil {
		t.Fatalf("decode legacy mobile shared: %v", err)
	}
	foundLegacy := false
	for _, item := range sharedBody.Items {
		if item.ResourceID == resource.ResourceID {
			foundLegacy = true
			if item.Kind != "shared_file" {
				t.Fatalf("expected legacy shared resource kind to normalize to shared_file, got %q", item.Kind)
			}
		}
	}
	if !foundLegacy {
		t.Fatalf("legacy resource not found in response, got %+v", sharedBody.Items)
	}

	resp, err = http.Post(srv.URL+"/resources/mobile/view/"+resource.ResourceID+"?clientId=legacy-client", "application/json", nil)
	if err != nil {
		t.Fatalf("POST legacy view: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("POST legacy view status=%d, want 200", resp.StatusCode)
	}

	resp, err = http.Get(srv.URL + "/resources/mobile/download/" + resource.ResourceID + "?clientId=legacy-client")
	if err != nil {
		t.Fatalf("GET legacy download: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET legacy download status=%d, want 200", resp.StatusCode)
	}

	records, err := st.ListAccessRecords(desktopDeviceID, &[]string{"legacy-client"}[0])
	if err != nil {
		t.Fatalf("ListAccessRecords legacy: %v", err)
	}
	if len(records) != 3 {
		t.Fatalf("expected 3 legacy access records, got %d", len(records))
	}
	for _, record := range records {
		if record.ResourceKind != "shared_file" {
			t.Fatalf("expected legacy access record kind shared_file, got %+v", record)
		}
		if !isContractAccessAction(record.Action) || !isContractAccessResult(record.Result) {
			t.Fatalf("legacy access record must match contracts enums, got %+v", record)
		}
	}
}

func TestMobileReceivedResourcesCreatesAccessRecord(t *testing.T) {
	st, cfg, hub := testEnv(t)
	insertPairedDeviceWithStableID(t, st, "client-001", "Alice iPhone", "Alice iPhone", "stable-001", "2026-06-14T08:00:00Z")
	desktopDeviceID, err := st.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID: %v", err)
	}
	completedAt := "2026-06-14T09:00:00Z"
	for _, upload := range []store.Upload{
		{
			FileKey:              "client-001-photo",
			ClientID:             "client-001",
			OriginalFilename:     "client-001.jpg",
			MediaType:            "image",
			FileSize:             2048,
			Status:               "completed",
			CommittedBytes:       2048,
			ActiveTransmissionMs: 250,
			CompletedAt:          &completedAt,
			UpdatedAt:            completedAt,
		},
		{
			FileKey:              "other-client-photo",
			ClientID:             "other-client",
			OriginalFilename:     "other-client.jpg",
			MediaType:            "image",
			FileSize:             4096,
			Status:               "completed",
			CommittedBytes:       4096,
			ActiveTransmissionMs: 300,
			CompletedAt:          &completedAt,
			UpdatedAt:            completedAt,
		},
		{
			FileKey:              "2026/06/14/client-001-notes.pdf",
			ClientID:             "client-001",
			OriginalFilename:     "notes.pdf",
			MediaType:            "document",
			FileSize:             1024,
			Status:               "completed",
			CommittedBytes:       1024,
			ActiveTransmissionMs: 220,
			CompletedAt:          &completedAt,
			UpdatedAt:            completedAt,
		},
	} {
		if err := st.UpsertUpload(upload); err != nil {
			t.Fatalf("UpsertUpload %s: %v", upload.FileKey, err)
		}
	}

	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/resources/mobile/received?clientId=client-001&clientName=Alice%20iPhone")
	if err != nil {
		t.Fatalf("GET /resources/mobile/received: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET mobile received status=%d, want 200", resp.StatusCode)
	}
	var receivedBody struct {
		Items []store.ReceivedLibraryItem `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&receivedBody); err != nil {
		t.Fatalf("decode mobile received: %v", err)
	}
	if err := resp.Body.Close(); err != nil {
		t.Fatalf("close mobile received body: %v", err)
	}
	if len(receivedBody.Items) != 3 {
		t.Fatalf("default mobile received endpoint should preserve legacy all-client library, got %+v", receivedBody.Items)
	}

	scopedResp, err := http.Get(srv.URL + "/resources/mobile/received?clientId=client-001&clientName=Alice%20iPhone&scope=client")
	if err != nil {
		t.Fatalf("GET /resources/mobile/received scoped: %v", err)
	}
	if scopedResp.StatusCode != http.StatusOK {
		t.Fatalf("GET scoped mobile received status=%d, want 200", scopedResp.StatusCode)
	}
	var scopedBody struct {
		Items []store.ReceivedLibraryItem `json:"items"`
	}
	if err := json.NewDecoder(scopedResp.Body).Decode(&scopedBody); err != nil {
		t.Fatalf("decode scoped mobile received: %v", err)
	}
	if err := scopedResp.Body.Close(); err != nil {
		t.Fatalf("close scoped mobile received body: %v", err)
	}
	if len(scopedBody.Items) != 2 {
		t.Fatalf("scoped mobile received endpoint should include current client only, got %+v", scopedBody.Items)
	}
	scopedByName := make(map[string]store.ReceivedLibraryItem, len(scopedBody.Items))
	for _, item := range scopedBody.Items {
		scopedByName[item.Filename] = item
	}
	if scopedByName["client-001.jpg"].ClientID != "client-001" ||
		!strings.Contains(scopedByName["client-001.jpg"].PreviewURL, "/resources/mobile/received/preview?") {
		t.Fatalf("scoped mobile received endpoint returned wrong image item: %+v", scopedByName["client-001.jpg"])
	}
	if scopedByName["notes.pdf"].ClientID != "client-001" ||
		!strings.Contains(scopedByName["notes.pdf"].PreviewURL, "/resources/mobile/received/download?") {
		t.Fatalf("scoped mobile received endpoint should use download url for documents: %+v", scopedByName["notes.pdf"])
	}

	records, err := st.ListAccessRecords(desktopDeviceID, &[]string{"client-001"}[0])
	if err != nil {
		t.Fatalf("ListAccessRecords: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("expected 2 access records, got %d", len(records))
	}
	for _, record := range records {
		if record.ResourceID != "received_library" || record.ResourceKind != "received_file" || record.Action != "list" || record.Result != "ok" {
			t.Fatalf("unexpected access record: %+v", record)
		}
	}
}

func TestMobileReceivedFilePreviewByFileKeyIsScopedToCurrentClient(t *testing.T) {
	st, cfg, hub := testEnv(t)
	insertPairedDeviceWithStableID(t, st, "client-001", "Alice iPhone", "Alice iPhone", "stable-001", "2026-06-14T08:00:00Z")
	insertPairedDeviceWithStableID(t, st, "other-client", "Bob iPhone", "Bob iPhone", "stable-002", "2026-06-14T08:00:00Z")
	desktopDeviceID, err := st.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID: %v", err)
	}
	completedAt := "2026-06-14T09:00:00Z"
	receivedRelPath := filepath.Join("Alice iPhone", "2026-06-14", "photo.jpg")
	receivedAbsPath := filepath.Join(cfg.ReceiveDir, receivedRelPath)
	if err := os.MkdirAll(filepath.Dir(receivedAbsPath), 0o755); err != nil {
		t.Fatalf("mkdir received path: %v", err)
	}
	if err := os.WriteFile(receivedAbsPath, []byte("image bytes"), 0o644); err != nil {
		t.Fatalf("write received file: %v", err)
	}
	for _, upload := range []store.Upload{
		{
			FileKey:              "client-001-photo",
			ClientID:             "client-001",
			OriginalFilename:     "photo.jpg",
			MediaType:            "image",
			FileSize:             11,
			Status:               "completed",
			FinalPath:            &receivedRelPath,
			CommittedBytes:       11,
			ActiveTransmissionMs: 250,
			CompletedAt:          &completedAt,
			UpdatedAt:            completedAt,
		},
		{
			FileKey:              "other-client-photo",
			ClientID:             "other-client",
			OriginalFilename:     "other.jpg",
			MediaType:            "image",
			FileSize:             11,
			Status:               "completed",
			FinalPath:            &receivedRelPath,
			CommittedBytes:       11,
			ActiveTransmissionMs: 250,
			CompletedAt:          &completedAt,
			UpdatedAt:            completedAt,
		},
	} {
		if err := st.UpsertUpload(upload); err != nil {
			t.Fatalf("UpsertUpload %s: %v", upload.FileKey, err)
		}
	}

	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/resources/mobile/received/preview?clientId=client-001&clientName=Alice%20iPhone&fileKey=client-001-photo")
	if err != nil {
		t.Fatalf("GET received preview: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("received preview status=%d, want 200", resp.StatusCode)
	}
	if contentDisposition := resp.Header.Get("Content-Disposition"); strings.Contains(contentDisposition, "attachment") {
		t.Fatalf("preview should not be served as attachment, got %q", contentDisposition)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read preview body: %v", err)
	}
	if string(body) != "image bytes" {
		t.Fatalf("preview body=%q, want image bytes", string(body))
	}

	thumbResp, err := http.Get(srv.URL + "/resources/mobile/received/thumbnail?clientId=client-001&clientName=Alice%20iPhone&fileKey=client-001-photo")
	if err != nil {
		t.Fatalf("GET received thumbnail: %v", err)
	}
	defer thumbResp.Body.Close()
	if thumbResp.StatusCode != http.StatusOK {
		t.Fatalf("received thumbnail status=%d, want 200", thumbResp.StatusCode)
	}

	otherResp, err := http.Get(srv.URL + "/resources/mobile/received/preview?clientId=client-001&clientName=Alice%20iPhone&fileKey=other-client-photo")
	if err != nil {
		t.Fatalf("GET other client received preview: %v", err)
	}
	defer otherResp.Body.Close()
	if otherResp.StatusCode != http.StatusNotFound {
		t.Fatalf("other client preview status=%d, want 404", otherResp.StatusCode)
	}

	records, err := st.ListAccessRecords(desktopDeviceID, &[]string{"client-001"}[0])
	if err != nil {
		t.Fatalf("ListAccessRecords: %v", err)
	}
	seenView := false
	for _, record := range records {
		if record.ResourceID == "client-001-photo" && record.ResourceKind == "received_file" && record.Action == "view" && record.Result == "ok" {
			seenView = true
		}
	}
	if !seenView {
		t.Fatalf("expected received preview to create a view access record, got %+v", records)
	}
}

func TestMobileReceivedFileDownloadByFileKeyServesDocuments(t *testing.T) {
	st, cfg, hub := testEnv(t)
	insertPairedDeviceWithStableID(t, st, "client-001", "Alice iPhone", "Alice iPhone", "stable-001", "2026-06-14T08:00:00Z")
	desktopDeviceID, err := st.GetDeviceID()
	if err != nil {
		t.Fatalf("GetDeviceID: %v", err)
	}
	completedAt := "2026-06-14T09:00:00Z"
	receivedRelPath := filepath.Join("Alice iPhone", "2026-06-14", "notes.pdf")
	receivedAbsPath := filepath.Join(cfg.ReceiveDir, receivedRelPath)
	if err := os.MkdirAll(filepath.Dir(receivedAbsPath), 0o755); err != nil {
		t.Fatalf("mkdir received path: %v", err)
	}
	if err := os.WriteFile(receivedAbsPath, []byte("document bytes"), 0o644); err != nil {
		t.Fatalf("write received file: %v", err)
	}
	for _, upload := range []store.Upload{
		{
			FileKey:              "2026/06/14/client-001-doc.pdf",
			ClientID:             "client-001",
			OriginalFilename:     "notes.pdf",
			MediaType:            "document",
			FileSize:             14,
			Status:               "completed",
			FinalPath:            &receivedRelPath,
			CommittedBytes:       14,
			ActiveTransmissionMs: 250,
			CompletedAt:          &completedAt,
			UpdatedAt:            completedAt,
		},
		{
			FileKey:              "2026/06/14/other-client-doc.pdf",
			ClientID:             "other-client",
			OriginalFilename:     "other.pdf",
			MediaType:            "document",
			FileSize:             14,
			Status:               "completed",
			FinalPath:            &receivedRelPath,
			CommittedBytes:       14,
			ActiveTransmissionMs: 250,
			CompletedAt:          &completedAt,
			UpdatedAt:            completedAt,
		},
	} {
		if err := st.UpsertUpload(upload); err != nil {
			t.Fatalf("UpsertUpload %s: %v", upload.FileKey, err)
		}
	}

	_, handler := api.NewServer(st, cfg, hub, nil)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/resources/mobile/received/download?clientId=client-001&clientName=Alice%20iPhone&fileKey=" + url.QueryEscape("2026/06/14/client-001-doc.pdf"))
	if err != nil {
		t.Fatalf("GET received download: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("received download status=%d, want 200", resp.StatusCode)
	}
	if contentDisposition := resp.Header.Get("Content-Disposition"); !strings.Contains(contentDisposition, "attachment") {
		t.Fatalf("download should be served as attachment, got %q", contentDisposition)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read download body: %v", err)
	}
	if string(body) != "document bytes" {
		t.Fatalf("download body=%q, want document bytes", string(body))
	}

	otherResp, err := http.Get(srv.URL + "/resources/mobile/received/download?clientId=client-001&clientName=Alice%20iPhone&fileKey=" + url.QueryEscape("2026/06/14/other-client-doc.pdf"))
	if err != nil {
		t.Fatalf("GET other client received download: %v", err)
	}
	defer otherResp.Body.Close()
	if otherResp.StatusCode != http.StatusNotFound {
		t.Fatalf("other client download status=%d, want 404", otherResp.StatusCode)
	}

	records, err := st.ListAccessRecords(desktopDeviceID, &[]string{"client-001"}[0])
	if err != nil {
		t.Fatalf("ListAccessRecords: %v", err)
	}
	seenDownload := false
	for _, record := range records {
		if record.ResourceID == "2026/06/14/client-001-doc.pdf" && record.ResourceKind == "received_file" && record.Action == "download" && record.Result == "ok" {
			seenDownload = true
		}
	}
	if !seenDownload {
		t.Fatalf("expected received download to create a download access record, got %+v", records)
	}
}

func isContractResourceKind(kind string) bool {
	switch kind {
	case "shared_file", "shared_folder", "received_file":
		return true
	default:
		return false
	}
}

func isContractAccessAction(action string) bool {
	switch action {
	case "list", "view", "download", "error":
		return true
	default:
		return false
	}
}

func isContractAccessResult(result string) bool {
	switch result {
	case "ok", "denied", "missing", "error":
		return true
	default:
		return false
	}
}

type mobileDirectoryListingResponse struct {
	Path       string                            `json:"path"`
	Files      []mobileDirectoryListingFileEntry `json:"files"`
	TotalCount int                               `json:"totalCount"`
}

type mobileDirectoryListingFileEntry struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Type        string `json:"type"`
	IsDirectory bool   `json:"isDirectory,omitempty"`
}

func directoryFilesByName(files []mobileDirectoryListingFileEntry) map[string]mobileDirectoryListingFileEntry {
	byName := make(map[string]mobileDirectoryListingFileEntry, len(files))
	for _, file := range files {
		byName[file.Name] = file
	}
	return byName
}
