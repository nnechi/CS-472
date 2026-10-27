import { Link, useNavigate, useLocation } from "react-router-dom"
import { useRef, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import useAuth from "../hooks/useAuth"
import { fakeLoginApi } from '../mockDb'
import AuthCard from "../components/AuthCard"
/* adding Google Auth Log in  */


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
    // Only teachers sign in. Students join a room from the home page with a code.
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
            setAuth({ user: response.user })
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
                <div style={{ margin: '16px 0', textAlign: 'center'}}>or</div>
                {/* <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <a className="auth-google" href={`${import.meta.env.VITE_SERVER_URL}/auth/google`}>
                        Sign in with Google
                    </a>
                </div> */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <a className="gsi-material-button" href={`${import.meta.env.VITE_SERVER_URL}/auth/google`}>
                        <div className="gsi-material-button-state"></div>
                        <div className="gsi-material-button-content-wrapper">
                            <div className="gsi-material-button-icon">
                            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlnsXlink="http://www.w3.org/1999/xlink" style={{ display: 'block' }} aria-hidden="true">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                                <path fill="none" d="M0 0h48v48H0z"></path>
                            </svg>
                            </div>
                            <span className="gsi-material-button-contents">Sign in with Google</span>
                            <span style={{ display: 'none' }}>Sign in with Google</span>
                        </div>
                    </a>
                </div>

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