import { Routes, Route } from "react-router-dom"
import RequiredAuth from "../routes/RequireAuth"
import HomeLayout from "../layouts/HomeLayout"
import SignXLayout from "../layouts/SignXLayout"
import DashboardLayout from "../layouts/DashboardLayout"
import Home from "../pages/Home"
import AboutUs from "../pages/AboutUs"
import LearnMore from "../pages/LearnMore"
import ContactUs from "../pages/ContactUs"
import SignUp from "../pages/SignUp"
import SignIn from "../pages/SignIn"
import Dashboard from "../pages/Dashboard"
import CreateRoom from "../pages/teacher/CreateRoom"
import TeacherRoom from "../pages/teacher/TeacherRoom"
import StudentRoom from "../pages/student/StudentRoom"
import NotFound from "../pages/NotFound"


export default function AppRoutes() {
    return(
        <Routes>

            <Route path="/" element={<HomeLayout />}>
                <Route index element={<Home />}/>
                <Route path="about" element={<AboutUs />}/>
                <Route path="learn-more" element={<LearnMore />} />
                <Route path="contact" element={<ContactUs />} />
                <Route path="*" element={<NotFound />} />
            </Route>

            <Route element={<SignXLayout />}>
                <Route path="login" element={<SignIn />} />
                <Route path="signup" element={<SignUp />} />
            </Route>

            {/* Protected Routes: sign in (and pick a role) first. */}
            <Route element={<RequiredAuth />}>
                <Route path="/dashboard" element={<DashboardLayout />}>
                    {/* Students: join a room by code. Teachers: create a room. */}
                    <Route index element={<Dashboard/>} />
                    <Route path="rooms/new" element={<CreateRoom />} />
                </Route>

                {/* Both render the Socket.IO chat; the role decides the view. */}
                <Route path="/rooms/:roomId" element={<TeacherRoom />} />
                <Route path="/rooms/join/:roomCode" element={<StudentRoom />} />
            </Route>
          
      </Routes>
    )
}
