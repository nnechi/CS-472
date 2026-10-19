import { Routes, Route } from "react-router-dom"
import RequiredAuth from "../routes/RequireAuth"
import HomeLayout from "../layouts/HomeLayout"
import SignXLayout from "../layouts/SignXLayout"
import DashboardLayout from "../layouts/DashboardLayout"
import Home from "../pages/Home"
import AboutUs from "../pages/AboutUs"
import Features from "../pages/Features"
import ContactUs from "../pages/ContactUs"
import SignUp from "../pages/SignUp"
import SignIn from "../pages/SignIn"
import TeacherDashboard from "../pages/teacher/TeacherDashboard"
import TeacherRoom from "../pages/teacher/TeacherRoom"
import CreateActivity from "../pages/teacher/CreateActivity"
import StudentRoom from "../pages/student/StudentRoom"
import NotFound from "../pages/NotFound"
import JoinRoom from "../pages/JoinRoom"


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

            {/* Protected Routes: teachers sign in first. */}
            <Route element={<RequiredAuth />}>
                <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<TeacherDashboard />} />
                    <Route path="create-activity" element={<CreateActivity />} />
                </Route>

                {/* Teacher view of the Socket.IO chat, with the raised-hand queue. */}
                <Route path="/rooms/:roomId" element={<TeacherRoom />} />
            </Route>
          
      </Routes>
    )
}
