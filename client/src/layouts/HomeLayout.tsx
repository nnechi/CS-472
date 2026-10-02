import { Outlet } from "react-router-dom"
import Navbar from '../components/Navbar'
import Footer from "../components/Footer"

export default function HomeLayout() {
    return(
        <div className="min-h-screen flex flex-col">
            <Navbar className="min-h-[8vh] flex-shrink-0"/>
            <main className="flex-1">
                <Outlet />
            </main>
            <Footer className="min-h-[8vh] flex-shrink-0"/>
        </div>
    )
}