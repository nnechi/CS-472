import { Routes, Route } from "react-router-dom"
import HomeLayout from "../layouts/HomeLayout"
import Home from "../pages/Home"
import AboutUs from "../pages/AboutUs"
import LearnMore from "../pages/LearnMore"
import ContactUs from "../pages/ContactUs"
import SignUp from "../pages/SignUp"
import SignIn from "../pages/SignIn"

export default function AppRoutes() {
    return(
        <Routes>

            <Route path="/" element={<HomeLayout />}>
                <Route index element={<Home />}/>
                <Route path="about" element={<AboutUs />}/>
                <Route path="learn-more" element={<LearnMore />} />
                <Route path="contact" element={<ContactUs />} />
                <Route path="signup" element={<SignUp />} />
                <Route path="signin" element={<SignIn />} />
            </Route>

      </Routes>
    )
}