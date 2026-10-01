import { Outlet } from "react-router-dom"

export default function TeacherDashboardLayout() {
    return(
        <>
            <h1>Need to make a teacher dashboard menu component later and put here!</h1>
            <p>Should have a menu bar that could contain...</p>
            <ul>
                <li>Home(which we are on)</li>
                <li>Templates</li>
                <li>Notes</li>
                <li>Settings</li>
                <li>Logout</li>
            </ul>
            <Outlet />
        </>
    )
}