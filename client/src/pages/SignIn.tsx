import { Link, useNavigate, useLocation } from "react-router-dom"
import { useRef, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import useAuth from "../hooks/useAuth"
import { fakeLoginApi } from '../mockDb'
import AuthCard from "../components/AuthCard"

type SignInForm = {
  email: string;
  password: string;
};

export default function SignIn() {
    const navigate = useNavigate();
    const location = useLocation();
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/dashboard";
    const { setAuth } = useAuth()

    const userRef = useRef<HTMLInputElement>(null)
    const errRef = useRef<HTMLParagraphElement>(null)

    const [form, setForm] = useState<SignInForm>({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        userRef.current?.focus()
    },[])

    useEffect(() => {
        setError('')
    }, [form.email, form.password])

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // FormEvent<HTMLFormElement>
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        if (!form.email || !form.password) {
            setError('Please enter both your email and password.');
        return;
        }

        setLoading(true);
        try {
        // Commented out code what we will actually use when the server is set up
        // const response = await fetch('api/auth/login', {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({
        //         email, password
        //     })
        // })

        // if(!response.ok) 
        //     throw new Error('Invalid email or password')

        // const data = await response.json()
        // setAuth(data)
        const response = await fakeLoginApi(form.email, form.password)
            setAuth(response)
            setForm({ email: "", password: ""});
            navigate(from, { replace: true })
        }
        catch (err){
            // Later add 400, 401 and no server response messages later
             if (err instanceof Error) 
                setError(err.message)
            else 
                setError('Something went wrong. Please try again.')
            
            errRef.current?.focus()
        } finally {
            setLoading(false)
        }
    };

    return(
        <AuthCard title="Sign in">
            <form
                aria-label="Sign in form"
                aria-describedby="form-description"
                onSubmit={handleSubmit}
                noValidate
            >
                {/* Add aria-describedby + sr-only text to sign-in form (WCAG compliance) */}
                <div id="form-description" className="sr-only">
                    Use this form to sign in to your account. Enter your email
                    and password.
                </div>
                <p
                    ref={errRef}
                    className={error ? "auth-error" : "sr-only"}
                    role="alert"
                    aria-live="assertive"
                >
                    {error}
                </p>
                
                <div className="auth-field">
                    <label htmlFor="email">Email</label>
                        <input 
                            type="email"
                            name="email"
                            id="email"
                            placeholder="name@example.com"
                            required
                            aria-required="true"
                            value={form.email}
                            onChange={handleChange}
                            autoComplete="email"
                        />
                </div>
                <div className="auth-field">
                    <label htmlFor="password">Password</label>
                        <input 
                            type="password"
                            name="password"
                            id="password"
                            required
                            aria-required="true"
                            value={form.password}
                            onChange={handleChange}
                            autoComplete="current-password"
                        />
                </div>
                <button
                    type="submit"
                    className="auth-submit"
                    disabled={loading}
                    aria-busy={loading}
                >
                    {loading ? 'Signing in…' : 'Sign In'}
                </button>
            </form>
                {/* TODO Make forgot password page and links/route stuff. 
                We can also move this around once styled*/}
                <p className="auth-forgot">
                    {<Link to="/">Forgot password?</Link>} 
                </p>
                <p>
                    Don't have an account yet? 
                    {<Link to="/signup" style={{ marginLeft: '5px' }} className="auth-switch">Sign up</Link>} 
                </p>
        </AuthCard>
    )
}