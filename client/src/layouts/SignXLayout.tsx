import { Outlet } from "react-router-dom"
import Footer from "../components/Footer"

export default function HomeLayout() {
    return(
        <div className="h-screen flex flex-col">
            <main className="flex-1 min-h-0">
                <Outlet />
            </main>
            <Footer className="min-h-[8vh] flex-shrink-0"/>
        </div>
    )
}