// internal/sse/handlers.go
package sse

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
)

func (hub *SSEHub) StreamAllPosts(w http.ResponseWriter, r *http.Request) {
	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
	w.Header().Set("Access-Control-Allow-Credentials", "true")

	// Получаем flusher И ИСПОЛЬЗУЕМ его
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	client := make(SSEClient, 10)
	hub.Register <- registration{UserID: -1, Client: client}

	log.Printf("Client registered for all posts stream")

	// ИСПОЛЬЗУЕМ flusher для отправки начального сообщения
	initialMsg, _ := json.Marshal(map[string]string{"type": "CONNECTED"})
	fmt.Fprintf(w, "data: %s\n\n", initialMsg)
	flusher.Flush() // <-- ВАЖНО: используем flusher здесь

	notify := r.Context().Done()
	go func() {
		<-notify
		hub.Unregister <- registration{UserID: -1, Client: client}
		log.Printf("Client disconnected from all posts stream")
	}()

	for {
		select {
		case msg, ok := <-client:
			if !ok {
				return
			}
			fmt.Fprintf(w, "data: %s\n\n", msg)
			flusher.Flush() // <-- И здесь используем flusher
		case <-notify:
			return
		}
	}
}

func (hub *SSEHub) StreamUserPosts(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		userID = -1
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
	w.Header().Set("Access-Control-Allow-Credentials", "true")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}
	flusher.Flush()

	client := make(SSEClient, 10)
	hub.Register <- registration{UserID: userID, Client: client}

	log.Printf("Client registered for user %d stream", userID)

	// Send initial connection confirmation
	initialMsg, _ := json.Marshal(map[string]string{"type": "CONNECTED"})
	fmt.Fprintf(w, "data: %s\n\n", initialMsg)
	flusher.Flush()

	notify := r.Context().Done()
	go func() {
		<-notify
		hub.Unregister <- registration{UserID: userID, Client: client}
		log.Printf("Client disconnected from user %d stream", userID)
	}()

	for {
		select {
		case msg, ok := <-client:
			if !ok {
				return
			}
			fmt.Fprintf(w, "data: %s\n\n", msg)
			flusher.Flush()
		case <-notify:
			return
		}
	}
}
