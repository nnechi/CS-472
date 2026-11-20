import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { SERVER_URL } from "../../api"
import useAuth from "../../hooks/useAuth"

const inputClass = "w-full rounded-lg border border-brand/25 bg-white px-3 py-2.5 text-base text-brand outline-none placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/15"
const saveClass = "rounded-lg bg-brand px-4 py-2.5 font-medium text-white cursor-pointer hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
const cancelClass = "rounded-lg border border-brand/25 px-4 py-2.5 text-brand cursor-pointer hover:bg-brand-light/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"

function PasswordField({ label, name, newPassword = false }: {
    label: string
    name: string
    newPassword?: boolean
}) {
    const id = useId()
    const [visible, setVisible] = useState(false)

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={id} className="font-medium">{label}</label>
            <div className="relative">
                <input
                    id={id}
                    name={name}
                    type={visible ? "text" : "password"}
                    autoComplete={name === "newPassword" || name === "confirmPassword" ? "new-password" : "current-password"}
                    required
                    minLength={newPassword ? 8 : undefined}
                    maxLength={newPassword ? 24 : undefined}
                    pattern={newPassword ? "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,24}" : undefined}
                    title={newPassword ? "Use 8-24 characters, at least 1 uppercase letter, at least 1 lowercase letter, and at least 1 number." : undefined}
                    aria-describedby={newPassword ? `${id}-help` : undefined}
                    className={`${inputClass} pr-12`}
                />
                <button
                    type="button"
                    onClick={() => setVisible((value) => !value)}
                    aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
                    aria-pressed={visible}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-brand/60 cursor-pointer hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
            {newPassword && <p id={`${id}-help`} className="text-sm text-brand/65">Use 8-24 characters, at least 1 uppercase letter, at least 1 lowercase letter, and at least 1 number.</p>}
        </div>
    )
}

// Account settings use the signed-in session; no user id is sent by the browser.
export default function Settings() {
    const { auth, setAuth } = useAuth()
    const navigate = useNavigate()
    const [passwordAccount, setPasswordAccount] = useState<boolean | null>(null)
    const [accountError, setAccountError] = useState("")
    const [busy, setBusy] = useState(false)
    useEffect(() => {
        let cancelled = false
        fetch(`${SERVER_URL}/api/account`, { credentials: "include" })
            .then(async response => {
                if (!response.ok) throw new Error("Could not load account settings. Please refresh or sign in again.")
                const data = await response.json()
                if (!cancelled) setPasswordAccount(data.passwordAccount)
            }).catch(error => { if (!cancelled) setAccountError(error.message) })
        return () => { cancelled = true }
    }, [])

    async function updateAccount(action: string, body: object) {
        const response = await fetch(`${SERVER_URL}/api/account/${action}`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Could not update your account.")
        return data
    }
    const [emailNotice, setEmailNotice] = useState("")
    const [passwordNotice, setPasswordNotice] = useState("")
    const [passwordError, setPasswordError] = useState("")
    const [deleteNotice, setDeleteNotice] = useState("")
    const deleteDialog = useRef<HTMLDialogElement>(null)
    const emailId = useId()
    const passwordErrorId = useId()

    async function changeEmail(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = event.currentTarget
        if (busy) return
        const email = form.elements.namedItem("email") as HTMLInputElement
        if (email.value.trim().toLowerCase() === auth?.user.email.toLowerCase()) {
            email.setCustomValidity("Enter a different email address.")
            email.reportValidity()
            return
        }
        setBusy(true)
        try {
            const password = form.elements.namedItem("emailPassword") as HTMLInputElement
            const data = await updateAccount("email", { email: email.value, currentPassword: password.value })
            setAuth(previous => previous ? { user: { ...previous.user, email: data.user.email } } : previous)
            form.reset()
            setEmailNotice(data.message)
        } catch (error) { setEmailNotice(error instanceof Error ? error.message : "Could not update email.") }
        finally { setBusy(false) }
    }

    async function changePassword(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = event.currentTarget
        const current = form.elements.namedItem("currentPassword") as HTMLInputElement
        const next = form.elements.namedItem("newPassword") as HTMLInputElement
        const confirm = form.elements.namedItem("confirmPassword") as HTMLInputElement
        if (next.value !== confirm.value) {
            setPasswordError("Your new passwords do not match.")
            confirm.focus()
            return
        }
        if (next.value === current.value) {
            setPasswordError("Choose a password different from your current password.")
            next.focus()
            return
        }
        if (busy) return
        setBusy(true)
        try {
            const data = await updateAccount("password", { currentPassword: current.value, newPassword: next.value })
            form.reset()
            setPasswordNotice(data.message)
        } catch (error) { setPasswordError(error instanceof Error ? error.message : "Could not update password.") }
        finally { setBusy(false) }
    }

    return (
        <section className="mt-8 flex max-w-3xl flex-col gap-6 pb-10 text-brand">
            <div>
                <h1 className="text-4xl font-bold">Settings</h1>
                <p className="mt-2 text-brand/65">Manage your account email and password.</p>
            </div>
            <p className="rounded-lg border border-brand/15 bg-brand-light/25 px-4 py-3 text-sm">
                {accountError || (passwordAccount === null ? "Loading account settings..." : passwordAccount ? "Confirm your current password to change your credentials. Other sessions will be signed out." : "You sign in with Google. Manage your email and password in your Google account.")}
            </p>

            <fieldset disabled={busy || passwordAccount !== true} className="flex min-w-0 flex-col gap-6 disabled:opacity-60">
            <section aria-labelledby="email-heading" className="rounded-xl border border-brand/20 bg-white p-5 sm:p-6">
                <div className="mb-6 flex items-start gap-3">
                    <Mail className="mt-1 shrink-0" size={22} aria-hidden="true" />
                    <div>
                        <h2 id="email-heading" className="text-2xl font-bold">Change email</h2>
                        <p className="mt-1 break-all text-sm text-brand/65">
                            {auth?.user.email ? <>Current email: <span className="font-medium text-brand">{auth.user.email}</span></> : "Update the email address you use to sign in."}
                        </p>
                    </div>
                </div>
                <form onSubmit={changeEmail} onChange={() => setEmailNotice("")} onReset={(event) => {
                    setEmailNotice("")
                    const form = event.currentTarget
        if (busy) return
        const email = form.elements.namedItem("email") as HTMLInputElement
                    email.setCustomValidity("")
                }} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <label htmlFor={emailId} className="font-medium">New email address</label>
                        <input id={emailId} name="email" type="email" autoComplete="email" placeholder="you@example.com" required className={inputClass} onChange={(event) => event.currentTarget.setCustomValidity("")} />
                    </div>
                    <PasswordField label="Current password" name="emailPassword" />
                    <div className="flex flex-wrap gap-3 border-t border-brand/10 pt-5">
                        <button type="submit" className={saveClass}>Update email</button>
                        <button type="reset" className={cancelClass}>Cancel</button>
                    </div>
                    <p role="status" className={emailNotice ? "text-sm text-brand/75" : "sr-only"}>{emailNotice}</p>
                </form>
            </section>

            <section aria-labelledby="password-heading" className="rounded-xl border border-brand/20 bg-white p-5 sm:p-6">
                <div className="mb-6 flex items-start gap-3">
                    <LockKeyhole className="mt-1 shrink-0" size={22} aria-hidden="true" />
                    <div>
                        <h2 id="password-heading" className="text-2xl font-bold">Change password</h2>
                        <p className="mt-1 text-sm text-brand/65">Choose a strong password to keep your account secure.</p>
                    </div>
                </div>
                <form
                    onSubmit={changePassword}
                    onChange={() => { setPasswordError(""); setPasswordNotice("") }}
                    onReset={() => { setPasswordError(""); setPasswordNotice("") }}
                    aria-describedby={passwordError ? passwordErrorId : undefined}
                    className="flex flex-col gap-5"
                >
                    <PasswordField label="Current password" name="currentPassword" />
                    <PasswordField label="New password" name="newPassword" newPassword />
                    <PasswordField label="Confirm new password" name="confirmPassword" />
                    {passwordError && <p id={passwordErrorId} role="alert" className="text-sm text-red-700">{passwordError}</p>}
                    <div className="flex flex-wrap gap-3 border-t border-brand/10 pt-5">
                        <button type="submit" className={saveClass}>Update password</button>
                        <button type="reset" className={cancelClass}>Cancel</button>
                    </div>
                    <p role="status" className={passwordNotice ? "text-sm text-brand/75" : "sr-only"}>{passwordNotice}</p>
                </form>
            </section>

            </fieldset>
            <section aria-labelledby="delete-heading" className="rounded-xl border border-red-200 bg-white p-5 sm:p-6">
                <h2 id="delete-heading" className="text-2xl font-bold text-red-700">Delete account</h2>
                <p className="mt-2 text-sm text-brand/65">Permanently delete your LittlePointers account.</p>
                <button
                    type="button"
                    className="mt-5 rounded-lg border border-red-700 px-4 py-2.5 font-medium text-red-700 cursor-pointer hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    onClick={() => { setDeleteNotice(""); deleteDialog.current?.showModal() }}
                >
                    Delete account
                </button>
                <p role="status" className={deleteNotice ? "mt-4 text-sm text-brand/75" : "sr-only"}>{deleteNotice}</p>
            </section>

            <dialog
                ref={deleteDialog}
                aria-labelledby="delete-dialog-heading"
                aria-describedby="delete-dialog-description"
                className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-xl border border-brand/20 bg-white p-6 text-brand shadow-xl backdrop:bg-black/40"
            >
                <h2 id="delete-dialog-heading" className="text-2xl font-bold">Are you sure?</h2>
                <p id="delete-dialog-description" className="mt-3 text-brand/75">
                    Deleting your account is permanent. You will lose access to your account.
                </p>
                <form onSubmit={async event => {
                    event.preventDefault()
                    if (busy) return
                    const form = event.currentTarget
                    const password = form.elements.namedItem("deletePassword") as HTMLInputElement | null
                    setBusy(true)
                    setDeleteNotice("")
                    try {
                        await updateAccount("delete", { confirm: true, currentPassword: password?.value })
                        setAuth(null)
                        navigate("/", { replace: true })
                    } catch (error) { setDeleteNotice(error instanceof Error ? error.message : "Could not delete account.") }
                    finally { setBusy(false) }
                }} className="mt-6 flex flex-col gap-4">
                    {passwordAccount && <PasswordField label="Current password" name="deletePassword" />}
                    {deleteNotice && <p role="alert" className="text-sm text-red-700">{deleteNotice}</p>}
                    <fieldset disabled={busy || passwordAccount === null} className="flex flex-wrap justify-end gap-3 disabled:opacity-60">
                    <button type="button" autoFocus onClick={() => deleteDialog.current?.close()} className={cancelClass}>Cancel</button>
                    <button
                        type="submit"
                        className="rounded-lg bg-red-700 px-4 py-2.5 font-medium text-white cursor-pointer hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                    >
                        {busy ? "Deleting..." : "Yes, delete account"}
                    </button>
                    </fieldset>
                </form>
            </dialog>
        </section>
    )
}
