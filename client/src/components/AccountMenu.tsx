import { useState } from "react"
import { Link } from "react-router-dom"
import useAuth from "../hooks/useAuth"
import UserAvatar from "./UserAvatar"
import { LogoutIcon, SettingsIcon } from "./MenuIcons"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"

// Each row in the menu: full width, icon then text, highlighted on hover.
const itemClass = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-base cursor-pointer"

// The profile picture in the header. Clicking it opens a small menu with who is signed in,
// a link to Settings, and Log out. Renders nothing while signed out.
export default function AccountMenu() {
    const { auth, logout } = useAuth()
    const [open, setOpen] = useState(false)

    if (!auth) return null
    const { name, email, picture } = auth.user

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                aria-label="Account menu"
                className="rounded-full cursor-pointer outline-offset-2 hover:ring-2 hover:ring-white/80 data-popup-open:ring-2 data-popup-open:ring-brand"
            >
                <UserAvatar name={name} picture={picture} />
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-64 p-2">
                {/* Who is signed in, so a teacher on a shared computer can tell at a glance. */}
                <div className="flex items-center gap-3 border-b border-brand/15 px-2 pt-1 pb-3">
                    <UserAvatar name={name} picture={picture} />
                    <div className="min-w-0">
                        <PopoverTitle className="truncate text-base">{name}</PopoverTitle>
                        <p className="truncate text-sm text-gray-600">{email}</p>
                    </div>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                    <Link
                        to="/dashboard/settings"
                        className={`${itemClass} text-brand hover:bg-neutral-100`}
                        onClick={() => setOpen(false)}
                    >
                        <SettingsIcon />
                        Settings
                    </Link>
                    <button type="button" className={`${itemClass} text-red-800 hover:bg-red-50`} onClick={logout}>
                        <LogoutIcon />
                        Log out
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
