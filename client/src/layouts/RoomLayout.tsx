import { Outlet } from "react-router-dom"

// Plain page frame for focused tasks like creating a room. No dashboard menu.
// Pages draw their own header, so this only sets the background.
export default function RoomLayout() {
    return(
        <div className="min-h-screen bg-white text-brand">
            <Outlet />
        </div>
    )
}
