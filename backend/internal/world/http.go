package world

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

type API struct {
	repository    *Repository
	allowedOrigin string
}

func NewAPI(repository *Repository, allowedOrigin string) http.Handler {
	api := &API{repository: repository, allowedOrigin: allowedOrigin}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", api.health)
	mux.HandleFunc("GET /api/v1/dungeons", api.listDungeons)
	mux.HandleFunc("GET /api/v1/dungeons/{dungeonID}", api.getDungeon)
	mux.HandleFunc("GET /api/v1/dungeons/{dungeonID}/rooms/{roomID}", api.getRoom)
	mux.HandleFunc("GET /api/v1/dungeons/{dungeonID}/rooms/{roomID}/map", api.getRoomMap)
	return api.cors(mux)
}

func (a *API) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "emberfall-world"})
}
func (a *API) listDungeons(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.repository.Dungeons())
}

func (a *API) getDungeon(w http.ResponseWriter, r *http.Request) {
	dungeon, ok := a.repository.Dungeon(r.PathValue("dungeonID"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, http.StatusOK, dungeon)
}

func (a *API) getRoom(w http.ResponseWriter, r *http.Request) {
	room, ok := a.repository.Room(r.PathValue("dungeonID"), r.PathValue("roomID"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	writeJSON(w, http.StatusOK, room)
}

func (a *API) getRoomMap(w http.ResponseWriter, r *http.Request) {
	path, ok := a.repository.MapPath(r.PathValue("dungeonID"), r.PathValue("roomID"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	if _, err := os.Stat(path); err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	http.ServeFile(w, r, path)
}

func (a *API) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (a.allowedOrigin == "*" || origin == a.allowedOrigin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

// NormalizeOrigin accepts a single configured origin, or * for local development.
func NormalizeOrigin(origin string) string { return strings.TrimSpace(origin) }
