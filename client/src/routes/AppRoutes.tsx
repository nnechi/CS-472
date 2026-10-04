import { Routes, Route } from "react-router-dom"
import RequiredAuth from "./RequireAuth"
import HomeLayout from "../layouts/HomeLayout"
import SignXLayout from "../layouts/SignXLayout"
import TeacherDashboardLayout from "../layouts/TeacherDashboardLayout"
import Home from "../pages/Home"
import AboutUs from "../pages/AboutUs"
import LearnMore from "../pages/LearnMore"
import ContactUs from "../pages/ContactUs"
import SignUp from "../pages/SignUp"
import SignIn from "../pages/SignIn"
import TeacherDashboard from "../pages/teacher/TeacherDashboard"
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

            {/* Protected Routes  */}
            <Route element={<RequiredAuth />}>
                <Route path="/dashboard" element={<TeacherDashboardLayout />}>
                    <Route index element={<TeacherDashboard/>} />
                    <Route path="rooms/new" element={<CreateRoom />} />
                </Route>
            </Route>

            <Route path="/teacher/room/:roomId" element={<TeacherRoom />} />
            <Route path="/room/:roomCode" element={<StudentRoom />} />
          
      </Routes>
    )
}