import { BrowserRouter } from "react-router-dom"
import AppRoutes from "./routes/AppRoutes"

// Sign-in lives at /login, the role-aware dashboard at /dashboard, and the
// Socket.IO chat is rendered by the room pages under /rooms. See AppRoutes.
export default function App() {
  return(
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
