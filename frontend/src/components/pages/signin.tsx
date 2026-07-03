import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  AuthLayout,
  AuthField,
  AuthInput,
  AuthButton,
  SocialRow,
  AuthLink,
  Divider,
} from "@/components/auth-layout";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in to Agroloop" },
      { name: "description", content: "Sign in to your Agroloop dashboard." },
    ],
  }),
  component: SignInPage,
});

export function SignInPage() {
  const [showPw, setShowPw] = useState(false);
  const navigate = useNavigate();
  return (
    <AuthLayout
      title="Welcome back to your fields."
      subtitle="Sign in to keep tabs on irrigation, weather, and crop health — every drop and every degree, in one place."
      footer={
        <>
          New to Agroloop? <AuthLink to="/signup">Create an account</AuthLink>
        </>
      }
    >
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "#0a0a0a" }}>
          Sign in to your account
        </h2>
        <p className="mt-1 text-sm" style={{ color: "#737373" }}>
          Good to see you again. Let's check on your fields.
        </p>
      </div>

      <form
        className="mt-7 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          // Backend auth not wired yet.
          // Keep UI working; next change will connect to backend.
          if (typeof window !== "undefined") localStorage.setItem("agroloop_auth", "1");
          navigate({ to: "/field" });
        }}
      >
        <AuthField label="Email address" required>
          <AuthInput type="email" placeholder="Enter your email" required />
        </AuthField>
        <AuthField label="Password" required>
          <div className="relative">
            <AuthInput
              type={showPw ? "text" : "password"}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "#737373" }}
              aria-label="Toggle password"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </AuthField>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2" style={{ color: "#404040" }}>
            <input type="checkbox" className="h-4 w-4 rounded accent-[#16a36a]" />
            Remember me
          </label>
          <button type="button" className="underline" style={{ color: "#404040" }}>
            Forgot password?
          </button>
        </div>

        <div className="pt-2">
          <AuthButton type="submit">Sign in</AuthButton>
        </div>
      </form>

      <Divider label="or" />
      <SocialRow />
    </AuthLayout>
  );
}
