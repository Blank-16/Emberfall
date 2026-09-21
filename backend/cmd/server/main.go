package main

import (
	"log"
	"net/http"
	"os"

	"emberfall/backend/internal/world"
)

func main() {
	dataDir := env("EMBERFALL_DATA_DIR", ".")
	port := env("PORT", "8080")
	allowedOrigin := world.NormalizeOrigin(env("EMBERFALL_ALLOWED_ORIGIN", "http://localhost:5173"))

	repository, err := world.Load(dataDir)
	if err != nil {
		log.Fatalf("load Emberfall world data: %v", err)
	}

	address := ":" + port
	log.Printf("Emberfall world API listening on %s", address)
	log.Printf("Loaded %d dungeon(s) from %s", len(repository.Dungeons()), dataDir)
	if err := http.ListenAndServe(address, world.NewAPI(repository, allowedOrigin)); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
