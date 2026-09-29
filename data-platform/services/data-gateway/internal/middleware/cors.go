package middleware

import (
	"net/http"

	"github.com/rs/cors"
)

// CORSMiddleware returns an HTTP middleware that handles CORS headers
// for the React frontend running on localhost:3000.
func CORSMiddleware(next http.Handler) http.Handler {
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})
	return c.Handler(next)
}
