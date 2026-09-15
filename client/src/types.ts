// Keep this in sync with the server's src/types.ts.
export interface ChatMessage {
  username: string;
  text: string;
  createdAt: string; // ISO timestamp
}

export interface ServerToClientEvents {
  "chat message": (message: ChatMessage) => void;
  "chat history": (messages: ChatMessage[]) => void;
  "system message": (text: string) => void;
}

export interface ClientToServerEvents {
  "chat message": (payload: { username: string; text: string }) => void;
}
