// Shape of a chat message as it travels over the wire (and how we store it).
export interface ChatMessage {
  username: string;
  text: string;
  createdAt: string; // ISO timestamp
}

// What the client is allowed to send to the server.
export interface ClientToServerEvents {
  "chat message": (payload: { username: string; text: string }) => void;
}

// What the server sends back to clients.
export interface ServerToClientEvents {
  "chat message": (message: ChatMessage) => void;
  "chat history": (messages: ChatMessage[]) => void;
  "system message": (text: string) => void;
}
