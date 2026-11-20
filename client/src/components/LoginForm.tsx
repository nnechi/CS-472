import { Link } from "react-router-dom"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

interface LoginFormProps {
  submitDisabled?: boolean // Whether the Login button should be disabled
  errorMessage?: string // Error from logging in (e.g. wrong password), shown above the button
}

export default function LoginForm({ submitDisabled = false, errorMessage }: LoginFormProps){
  return (
    <div className={cn("flex flex-col gap-6")}>
      <Card className="gap-4 text-base [--card-spacing:--spacing(8)]">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl text-[#1F1666]">Log in</CardTitle>
          <CardDescription className="text-lg">
            Login with your Google account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <FieldGroup>
              <Field>
                <a
                  href={`${import.meta.env.VITE_SERVER_URL}/auth/google`}
                  className="group relative block h-12 w-full overflow-hidden rounded-lg border border-[#747775] bg-white px-4 font-[Roboto,Arial,sans-serif] text-base tracking-[0.25px] whitespace-nowrap text-[#1f1f1f] no-underline outline-none select-none transition-[background-color,border-color,box-shadow] duration-200 hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.30),0_1px_3px_1px_rgba(60,64,67,0.15)]"
                >
                  <div className="absolute inset-0 bg-[#303030] opacity-0 transition-opacity duration-200 group-hover:opacity-[0.08] group-focus:opacity-[0.12]"></div>
                  <div className="relative flex h-full w-full flex-row flex-nowrap items-center justify-center">
                    <div className="mr-3 size-6 min-w-6">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlnsXlink="http://www.w3.org/1999/xlink" style={{ display: 'block' }} aria-hidden="true">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                    </div>
                    <span className="overflow-hidden font-medium text-ellipsis">Sign in with Google</span>
                  </div>
                </a>
              </Field>
              <FieldSeparator className="text-base *:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email" className="text-base text-[#1F1666]">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  className="h-11 border-[#5A52A6] px-3 text-base md:text-base"
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password" className="text-base text-[#1F1666]">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto text-base underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input id="password" type="password" required className="h-11 border-[#5A52A6] px-3 text-base md:text-base" />
              </Field>
              <Field>
                {errorMessage && (
                  <p role="alert" className="text-center text-base text-red-600">{errorMessage}</p>
                )}
                <Button type="submit" disabled={submitDisabled} className="h-11 bg-[#1F1666] text-base text-white hover:bg-[#1F1666]/85">Login</Button>
                <FieldDescription className="text-center text-base">
                  Don&apos;t have an account? <Link to="/signup">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
