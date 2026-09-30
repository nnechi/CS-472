import { Outlet } from "react-router-dom"
import Footer from "../components/Footer"

export default function HomeLayout() {
    return(
        <div className="site-wrapper">
            <main>
                <Outlet />
            </main>
            <Footer />
        </div>
    )
}