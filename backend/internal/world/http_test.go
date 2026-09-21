package world

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDungeonAndRoomEndpoints(t *testing.T) {
	repo, err := Load(projectRoot(t))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	handler := NewAPI(repo, "http://localhost:5173")

	for _, path := range []string{
		"/health",
		"/api/v1/dungeons",
		"/api/v1/dungeons/d1_emberfall",
		"/api/v1/dungeons/d1_emberfall/rooms/d1_entry",
		"/api/v1/dungeons/d1_emberfall/rooms/d1_entry/map",
	} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, path, nil)
		handler.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusOK {
			t.Errorf("GET %s status = %d, want %d; body=%s", path, recorder.Code, http.StatusOK, recorder.Body.String())
		}
	}
}

func TestUnknownDungeonReturns404(t *testing.T) {
	repo, err := Load(projectRoot(t))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/dungeons/missing", nil)
	NewAPI(repo, "http://localhost:5173").ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
}
