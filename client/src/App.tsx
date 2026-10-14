import { BrowserRouter } from "react-router-dom"
import AppRoutes from "./routes/AppRoutes"

// Teachers sign in at /login and manage rooms at /dashboard. Students join a
// room from the home page with a code. The Socket.IO chat is rendered by the
// room pages under /rooms. See AppRoutes.
export default function App() {
  return(
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
