import { useId, useRef, useState, type FormEvent } from "react"
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"
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
                    pattern={newPassword ? "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%]).{8,24}" : undefined}
                    title={newPassword ? "Use 8–24 characters with uppercase and lowercase letters, a number, and one of ! @ # $ %." : undefined}
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
            {newPassword && <p id={`${id}-help`} className="text-sm text-brand/65">Use 8–24 characters with uppercase and lowercase letters, a number, and one of ! @ # $ %.</p>}
        </div>
    )
}

// UI preview; connect these forms when email/password authentication lands.
export default function Settings() {
    const { auth } = useAuth()
    const [emailNotice, setEmailNotice] = useState("")
    const [passwordNotice, setPasswordNotice] = useState("")
    const [passwordError, setPasswordError] = useState("")
    const [deleteNotice, setDeleteNotice] = useState("")
    const deleteDialog = useRef<HTMLDialogElement>(null)
    const emailId = useId()
    const passwordErrorId = useId()

    function previewEmailChange(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const email = event.currentTarget.elements.namedItem("email") as HTMLInputElement
        if (email.value.trim().toLowerCase() === auth?.user.email.toLowerCase()) {
            email.setCustomValidity("Enter a different email address.")
            email.reportValidity()
            return
        }
        setEmailNotice("Email changes are coming soon. Your email has not been changed.")
    }

    function previewPasswordChange(event: FormEvent<HTMLFormElement>) {
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
        form.reset()
        setPasswordNotice("Password changes are coming soon. Your password has not been changed.")
    }

    return (
        <section className="mt-8 flex max-w-3xl flex-col gap-6 pb-10 text-brand">
            <div>
                <h1 className="text-4xl font-bold">Settings</h1>
                <p className="mt-2 text-brand/65">Manage your account email and password.</p>
            </div>
            <p className="rounded-lg border border-brand/15 bg-brand-light/25 px-4 py-3 text-sm">
                Email and password changes are coming soon. You can preview the forms below; changes will not be saved.
            </p>

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
                <form onSubmit={previewEmailChange} onChange={() => setEmailNotice("")} onReset={(event) => {
                    setEmailNotice("")
                    const email = event.currentTarget.elements.namedItem("email") as HTMLInputElement
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
                    onSubmit={previewPasswordChange}
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
                    Deleting your account is permanent. This is a preview, so your account will not be deleted yet.
                </p>
                <form method="dialog" className="mt-6 flex flex-wrap justify-end gap-3">
                    <button type="submit" autoFocus className={cancelClass}>Cancel</button>
                    <button
                        type="submit"
                        className="rounded-lg bg-red-700 px-4 py-2.5 font-medium text-white cursor-pointer hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                        onClick={() => setDeleteNotice("Account deletion is coming soon. Your account has not been deleted.")}
                    >
                        Yes, delete account
                    </button>
                </form>
            </dialog>
        </section>
    )
}
