import { Outlet } from "react-router-dom"
import Navbar from '../components/Navbar'
import Footer from "../components/Footer"

export default function HomeLayout() {
    return(
        <div className="min-h-screen flex flex-col bg-paper text-brand">
            <Navbar className="min-h-[8vh] flex-shrink-0"/>
            <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-12">
                <Outlet />
            </main>
            <Footer className="min-h-[8vh] flex-shrink-0"/>
        </div>
    )
}