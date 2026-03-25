// internal/sse/hub.go - Add heartbeat functionality

package sse

import (
	"encoding/json"
	"log"
	"time"
)

var GlobalHub *SSEHub

type SSEHub struct {
	AllPosts      map[SSEClient]bool
	UserPosts     map[int]map[SSEClient]bool
	Register      chan registration
	Unregister    chan registration
	BroadcastAll  chan []byte
	BroadcastUser chan UserMessage
	stopHeartbeat chan bool
}

func NewHub() *SSEHub {
	hub := &SSEHub{
		AllPosts:      make(map[SSEClient]bool),
		UserPosts:     make(map[int]map[SSEClient]bool),
		Register:      make(chan registration),
		Unregister:    make(chan registration),
		BroadcastAll:  make(chan []byte),
		BroadcastUser: make(chan UserMessage),
		stopHeartbeat: make(chan bool),
	}

	GlobalHub = hub

	return hub
}

func (hub *SSEHub) Run() {
	// Start heartbeat
	go hub.heartbeat()

	for {
		select {
		case reg := <-hub.Register:
			if reg.UserID == -1 {
				hub.AllPosts[reg.Client] = true
				log.Printf("New client connected to all posts stream. Total: %d", len(hub.AllPosts))
			} else {
				if hub.UserPosts[reg.UserID] == nil {
					hub.UserPosts[reg.UserID] = make(map[SSEClient]bool)
				}
				hub.UserPosts[reg.UserID][reg.Client] = true
				log.Printf("New client connected to user %d stream. Total for user: %d",
					reg.UserID, len(hub.UserPosts[reg.UserID]))
			}

		case reg := <-hub.Unregister:
			if reg.UserID == -1 {
				delete(hub.AllPosts, reg.Client)
				log.Printf("Client disconnected from all posts stream. Remaining: %d", len(hub.AllPosts))
			} else {
				if clients, ok := hub.UserPosts[reg.UserID]; ok {
					delete(clients, reg.Client)
					log.Printf("Client disconnected from user %d stream. Remaining for user: %d",
						reg.UserID, len(clients))
				}
			}
			close(reg.Client)

		case msg := <-hub.BroadcastAll:
			for client := range hub.AllPosts {
				select {
				case client <- msg:
				default:
					// Client is slow, close it
					delete(hub.AllPosts, client)
					close(client)
				}
			}

		case um := <-hub.BroadcastUser:
			if clients, ok := hub.UserPosts[um.UserID]; ok {
				for client := range clients {
					select {
					case client <- um.Data:
					default:
						// Client is slow, close it
						delete(clients, client)
						close(client)
					}
				}
			}
		}
	}
}

// heartbeat sends a ping every 30 seconds to keep connections alive
func (hub *SSEHub) heartbeat() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			heartbeatMsg, _ := json.Marshal(map[string]string{"type": "HEARTBEAT"})

			// Send to all clients
			for client := range hub.AllPosts {
				select {
				case client <- heartbeatMsg:
				default:
					// Client is slow, will be cleaned up in main loop
				}
			}

			// Send to all user streams
			for _, clients := range hub.UserPosts {
				for client := range clients {
					select {
					case client <- heartbeatMsg:
					default:
					}
				}
			}

			log.Printf("Heartbeat sent to %d all-posts clients and %d user streams",
				len(hub.AllPosts), len(hub.UserPosts))

		case <-hub.stopHeartbeat:
			return
		}
	}
}

func (hub *SSEHub) Stop() {
	close(hub.stopHeartbeat)
}
