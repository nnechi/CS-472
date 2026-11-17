import { Link, useNavigate, useLocation } from "react-router-dom"
import { useRef, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import useAuth from "../hooks/useAuth"
import { fakeLoginApi } from '../mockDb'
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
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
            <div className="flex w-full max-w-lg flex-col gap-6">
                <Link to="/" className="self-center" aria-label="LittlePointers home">
                    <img src={textLogo} alt="LittlePointers" />
                </Link>
                {/* Typing in LoginForm's inputs bubbles up here, so the page can check them. */}
                <div
                    onChange={(e) => {
                        const input = e.target as HTMLInputElement
                        if (input.id === 'email') setForm((prev) => ({ ...prev, email: input.value }))
                        if (input.id === 'password') setForm((prev) => ({ ...prev, password: input.value }))
                    }}
                >
                    <LoginForm submitDisabled={!form.email || !form.password} />
                </div>
            </div>
        </div>
    )
}