import { Link, useNavigate, useLocation } from "react-router-dom"
import React, { useEffect, useState } from "react";
import useAuth from "../hooks/useAuth"
import { login } from "../api"
import LoginForm from "../components/LoginForm"
import textLogo from "../assets/LittlePointers Logo/Text Logo.png"

type SignInForm = {
  email: string;
  password: string;
};

export default function SignIn() {
    const navigate = useNavigate();
    const location = useLocation();
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/dashboard";
    const { setAuth } = useAuth()

    const [form, setForm] = useState<SignInForm>({ email: '', password: '' });
    // Only teachers sign in. Students join a room from the home page with a code.
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setError('')
    }, [form.email, form.password])

    // Attached to the div around <LoginForm />: the form's submit event bubbles up to it.
    async function handleSubmit(e: React.FormEvent) {
        // Prevents page from reloading when submitted
        e.preventDefault();
        setError('');

        if (!form.email || !form.password) {
            setError('Please enter both your email and password.');
            return;
        }

        setLoading(true);
        try {
            try {
                // The server has logged them in, so tell the rest of the app
                setAuth(await login(form.email, form.password))
            } catch (e) {
                // No answer, a wrong email or password, or a missing field; the message says which
                setError(e instanceof Error ? e.message : 'Login failed. Please try again.')
                return
            }
            setForm({ email: "", password: "" });
            navigate(from, { replace: true })
        } finally {
            setLoading(false)
        }
    }

    return(
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
            <div className="flex w-full max-w-lg flex-col gap-6">
                <Link to="/" className="self-center" aria-label="LittlePointers home">
                    <img src={textLogo} alt="LittlePointers" />
                </Link>
                {/* Typing in and submitting LoginForm bubble up here, so the page can check and send them. */}
                <div
                    onSubmit={handleSubmit}
                    onChange={(e) => {
                        const input = e.target as HTMLInputElement
                        if (input.id === 'email') setForm((prev) => ({ ...prev, email: input.value }))
                        if (input.id === 'password') setForm((prev) => ({ ...prev, password: input.value }))
                    }}
                >
                    <LoginForm
                        // Also disabled while a login is in progress, so it can't be sent twice
                        submitDisabled={!form.email || !form.password || loading}
                        errorMessage={error} // e.g. wrong email or password, or no server response
                    />
                </div>
            </div>
        </div>
    )
}
