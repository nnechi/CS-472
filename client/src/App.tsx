import { useState } from "react";
import Login from "./components/Login";
import Chat from "./components/Chat";
import { socket } from "./socket";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
// Called by <Login> when the user submits a name.
  const handleJoin = (payload: Session) => {
    setSession(payload);
    socket.connect(); // open the socket after login
  };


  // Not logged in yet -> show the username picker.
  if (!session) {
    return <Login onJoin={handleJoin} />;
  }

  // Logged in -> show the chat room.
  return <Chat session={session} />;
}
