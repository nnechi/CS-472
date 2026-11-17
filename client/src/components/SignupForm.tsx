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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
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
                <Input id="name" type="text" placeholder="John Doe" required className="h-11 border-[#5A52A6] px-3 text-base md:text-base" />
              </Field>
              <Field>
                <FieldLabel className="text-base text-[#1F1666]" htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  className="h-11 border-[#5A52A6] px-3 text-base md:text-base"
                />
              </Field>
              <Field>
                <FieldLabel className="text-base text-[#1F1666]" htmlFor="password">Password</FieldLabel>
                <Input id="password" type="password" required className="h-11 border-[#5A52A6] px-3 text-base md:text-base" />
                <FieldDescription className="text-base">
                  Must be at least 8 characters long <br />
                  Must contain at least one lowercase letter, one uppercase letter, and one digit
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel className="text-base text-[#1F1666]" htmlFor="confirm-password">
                  Confirm Password
                </FieldLabel>
                <Input id="confirm-password" type="password" required className="h-11 border-[#5A52A6] px-3 text-base md:text-base" />
              </Field>
              <Field>
                <Button type="submit" className="h-11 bg-[#1F1666] text-base text-white hover:bg-[#1F1666]/85">Create Account</Button>
                <FieldDescription className="text-center text-base">
                  Already have an account? <a href="#">Sign in</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
