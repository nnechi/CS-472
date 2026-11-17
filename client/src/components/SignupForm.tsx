import { useState } from "react"
import { Link } from "react-router-dom"
import { Check, X } from "lucide-react"

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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

// Shown under the password field, each with a check or an x as the user types.
const PASSWORD_REQUIREMENTS = [
  { label: "Between 8 and 24 characters", test: (pw: string) => pw.length >= 8 && pw.length <= 24 },
  { label: "At least one lowercase letter", test: (pw: string) => /[a-z]/.test(pw) },
  { label: "At least one uppercase letter", test: (pw: string) => /[A-Z]/.test(pw) },
  { label: "At least one digit", test: (pw: string) => /[0-9]/.test(pw) },
]

interface SignupFormProps {
  nameError?: string // Error from not satisfying name requirement
  confirmPasswordError?: string // Error from "confirm password" not matching "password" field
  submitDisabled?: boolean // Represents whether the button should be disabled or not
}

// This component represents the design elements of the sign up form. Only does minimal error checking to determine if button should be disabled
export default function SignupForm({nameError, confirmPasswordError, submitDisabled = false}: SignupFormProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  // The browser's own email check (type="email"), read from the input as the user types.
  const [emailValid, setEmailValid] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Create Account stays disabled until every field is filled in and passes its checks.
  const canSubmit =
    email !== "" &&
    emailValid &&
    PASSWORD_REQUIREMENTS.every(({ test }) => test(password)) &&
    confirmPassword === password

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-4 text-base [--card-spacing:--spacing(8)]">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl text-[#1F1666]">Sign up</CardTitle>
          <CardDescription className="text-lg">
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <FieldGroup>
              <Field>
                <FieldLabel className="text-base text-[#1F1666]" htmlFor="name">Full Name</FieldLabel>
                <Input id="name" type="text" placeholder="John Doe" autoFocus value={name} onChange={(e) => setName(e.target.value)} required aria-describedby="name-error" className="h-11 border-[#5A52A6] px-3 text-base md:text-base" />
                {nameError && (
                  <p id="name-error" role="alert" className="text-base text-red-600">{nameError}</p>
                )}
              </Field>
              <Field>
                <FieldLabel className="text-base text-[#1F1666]" htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setEmailValid(e.target.validity.valid)
                  }}
                  required
                  className="h-11 border-[#5A52A6] px-3 text-base md:text-base"
                />
              </Field>
              <Field>
                <FieldLabel className="text-base text-[#1F1666]" htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 border-[#5A52A6] px-3 text-base md:text-base"
                />
                <ul className="flex flex-col gap-1 text-base text-muted-foreground">
                  {PASSWORD_REQUIREMENTS.map(({ label, test }) => {
                    const met = test(password)
                    return (
                      <li key={label} className="flex items-center gap-2">
                        {/* Fixed-size slot so the text doesn't shift when an icon appears. */}
                        <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                          {met
                            ? <Check className="size-4 text-green-600" />
                            : <X className="size-4 text-red-600" />}
                        </span>
                        <span>{label}</span>
                        <span className="sr-only">{met ? "(met)" : "(not met)"}</span>
                      </li>
                    )
                  })}
                </ul>
              </Field>
              <Field>
                <FieldLabel className="text-base text-[#1F1666]" htmlFor="confirm-password">
                  Confirm Password
                </FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  aria-describedby="confirm-password-error"
                  className="h-11 border-[#5A52A6] px-3 text-base md:text-base"
                />
                {confirmPasswordError && (
                  <p id="confirm-password-error" role="alert" className="text-base text-red-600">{confirmPasswordError}</p>
                )}
              </Field>
              <Field>
                <Button type="submit" disabled={!canSubmit || submitDisabled} className="h-11 bg-[#1F1666] text-base text-white hover:bg-[#1F1666]/85">Create Account</Button>
                <FieldDescription className="text-center text-base">
                  Already have an account? <Link to="/login">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
