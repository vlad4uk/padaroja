package sse

type SSEClient chan []byte

type registration struct {
	UserID int
	Client SSEClient
}

type UserMessage struct {
	UserID int
	Data   []byte
}
