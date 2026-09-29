// import { useState } from "react";
// import Login from "./components/Login";
// import Chat from "./components/Chat";
// import { socket } from "./socket";

// export default function App() {
//   const [username, setUsername] = useState<string | null>(null);

//   // Called by <Login> when the user submits a name.
//   const handleJoin = (name: string) => {
//     setUsername(name);
//     socket.connect(); // open the socket only after we have a username
//   };

//   // Not logged in yet -> show the username picker.
//   if (!username) {
//     return <Login onJoin={handleJoin} />;
//   }

//   // Logged in -> show the chat room.
//   return <Chat username={username} />;
// }

import { BrowserRouter} from "react-router-dom"
import AppRoutes from "./routes/AppRoutes"

export default function App() {

  return(
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
