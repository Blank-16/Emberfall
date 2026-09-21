package world

import (
	"path/filepath"
	"testing"
)

func projectRoot(t *testing.T) string {
	t.Helper()
	root := filepath.Join("..", "..", "..")
	return root
}

func TestLoadExistingDungeonData(t *testing.T) {
	repo, err := Load(projectRoot(t))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if got, want := len(repo.Dungeons()), 1; got != want {
		t.Fatalf("dungeon count = %d, want %d", got, want)
	}
	room, ok := repo.Room("d1_emberfall", "d1_entry")
	if !ok {
		t.Fatal("expected d1_entry to be available")
	}
	if room.AuthoredRoom.Width != 30 || room.AuthoredRoom.Height != 20 {
		t.Fatalf("unexpected room dimensions: %dx%d", room.AuthoredRoom.Width, room.AuthoredRoom.Height)
	}
	if len(room.AuthoredRoom.Objects) != 4 {
		t.Fatalf("entry object count = %d, want 4", len(room.AuthoredRoom.Objects))
	}
}

func TestUnknownRoomIsNotReturned(t *testing.T) {
	repo, err := Load(projectRoot(t))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if _, ok := repo.Room("d1_emberfall", "not_a_room"); ok {
		t.Fatal("unknown room unexpectedly returned")
	}
}
