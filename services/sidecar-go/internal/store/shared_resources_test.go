package store

import "testing"

func stringPtr(value string) *string {
	return &value
}

func int64Ptr(value int64) *int64 {
	return &value
}

func TestSharedResourceRejectsTraversal(t *testing.T) {
	s := newTestStore(t)

	_, err := s.AddSharedResource(SharedResourceInput{
		DesktopDeviceID: "desktop-1",
		Kind:            "shared_file",
		DisplayName:     "Secret",
		LocalPath:       stringPtr("../secret.txt"),
		Status:          "available",
	})
	if err == nil {
		t.Fatal("expected traversal path to be rejected")
	}
}

func TestSharedResourceLifecycle(t *testing.T) {
	s := newTestStore(t)

	added, err := s.AddSharedResource(SharedResourceInput{
		DesktopDeviceID: "desktop-1",
		Kind:            "shared_file",
		DisplayName:     "Clip.mov",
		LocalPath:       stringPtr("/Users/test/Clip.mov"),
		FileSize:        int64Ptr(2048),
		MediaType:       stringPtr("video/quicktime"),
		Status:          "available",
	})
	if err != nil {
		t.Fatalf("AddSharedResource: %v", err)
	}
	if added.ResourceID == "" {
		t.Fatal("expected generated resource id")
	}
	if added.LocalPath == nil || *added.LocalPath != "/Users/test/Clip.mov" {
		t.Fatalf("expected local path to be persisted internally, got %#v", added.LocalPath)
	}

	resources, err := s.ListSharedResources("desktop-1")
	if err != nil {
		t.Fatalf("ListSharedResources: %v", err)
	}
	if len(resources) != 1 {
		t.Fatalf("expected 1 active resource, got %d", len(resources))
	}
	if resources[0].ResourceID != added.ResourceID {
		t.Fatalf("expected listed resource %q, got %q", added.ResourceID, resources[0].ResourceID)
	}

	resolved, err := s.ResolveSharedResource("desktop-1", added.ResourceID)
	if err != nil {
		t.Fatalf("ResolveSharedResource: %v", err)
	}
	if resolved.DisplayName != "Clip.mov" {
		t.Fatalf("expected display name Clip.mov, got %q", resolved.DisplayName)
	}

	if err := s.RemoveSharedResource("desktop-1", added.ResourceID); err != nil {
		t.Fatalf("RemoveSharedResource: %v", err)
	}
	resources, err = s.ListSharedResources("desktop-1")
	if err != nil {
		t.Fatalf("ListSharedResources after remove: %v", err)
	}
	if len(resources) != 0 {
		t.Fatalf("expected removed resource to be hidden, got %d resources", len(resources))
	}
	if _, err := s.ResolveSharedResource("desktop-1", added.ResourceID); err == nil {
		t.Fatal("expected removed resource not to resolve")
	}
}
