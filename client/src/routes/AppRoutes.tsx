import { Routes, Route } from "react-router-dom"
import RequiredAuth from "../routes/RequireAuth"
import HomeLayout from "../layouts/HomeLayout"
import SignXLayout from "../layouts/SignXLayout"
import DashboardLayout from "../layouts/DashboardLayout"
import RoomLayout from "../layouts/RoomLayout"
import Home from "../pages/Home"
import AboutUs from "../pages/AboutUs"
import Features from "../pages/Features"
import ContactUs from "../pages/ContactUs"
import SignUp from "../pages/SignUp"
import SignIn from "../pages/SignIn"
import TeacherDashboard from "../pages/teacher/TeacherDashboard"
import Activities from "../pages/teacher/Activities"
import Notes from "../pages/teacher/Notes"
import PreviousActivities from "../pages/teacher/PreviousActivities"
import Settings from "../pages/teacher/Settings"
import PreviousRoom from "../pages/teacher/PreviousRoom"
import RoomEntry from "../routes/RoomEntry"
import CreateActivity from "../pages/teacher/CreateActivity"
import StudentRoom from "../pages/student/StudentRoom"
import NotFound from "../pages/NotFound"
import JoinRoom from "../pages/JoinRoom"
import RoomCreation from "../pages/teacher/RoomCreation"
import SearchResults from "../pages/teacher/SearchResults"
import DashboardNotFound from "../pages/teacher/DashboardNotFound"


export default function AppRoutes() {
    return(
        <Routes>

            <Route path="/" element={<HomeLayout />}>
                <Route index element={<Home />}/>
                <Route path="about" element={<AboutUs />}/>
                <Route path="features" element={<Features />} />
                <Route path="contact" element={<ContactUs />} />
                <Route path="joinroom" element={<JoinRoom />} />
                <Route path="*" element={<NotFound />} />
            </Route>

            <Route element={<SignXLayout />}>
                <Route path="login" element={<SignIn />} />
                <Route path="signup" element={<SignUp />} />
            </Route>

            {/* Public: students join with a room code and a name, no account. */}
            <Route path="/rooms/join/:roomCode" element={<StudentRoom />} />

            {/* Teacher view of the Socket.IO chat, with the raised-hand queue.
                Signed-out visitors (students with a shared link) go to /joinroom with the code filled in. */}
            <Route path="/rooms/:roomId" element={<RoomEntry />} />

            {/* Protected Routes: teachers sign in first. */}
            <Route element={<RequiredAuth />}>
                <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<TeacherDashboard />} />
                    <Route path="activities" element={<Activities />} />
                    <Route path="notes" element={<Notes />} />
                    <Route path="previous-activities" element={<PreviousActivities />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="create-activity" element={<CreateActivity />} />
                    <Route path="search" element={<SearchResults />} />
                    {/* Any other /dashboard/... URL. Rendered inside the dashboard layout. */}
                    <Route path="*" element={<DashboardNotFound />} />
                </Route>

                {/* Create a room: its own page, without the dashboard header and menu. */}
                <Route element={<RoomLayout />}>
                    <Route path="/room-creation" element={<RoomCreation />} />
                </Route>

                {/* A saved (ended) room, read-only. Opened from Previous activities. */}
                <Route path="/previous-rooms/:roomId" element={<PreviousRoom />} />
            </Route>
          
      </Routes>
    )
}
