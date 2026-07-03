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

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your Agroloop account" },
      { name: "description", content: "Sign up to monitor your fields with Agroloop." },
    ],
  }),
  component: SignUpPage,
});

export function SignUpPage() {
  const [showPw, setShowPw] = useState(false);
  const navigate = useNavigate();
  return (
    <AuthLayout
      title="Start managing your fields with clarity and control."
      subtitle="Create your free Agroloop account and access powerful irrigation and crop tools — built for growth, precision, and real-time insight."
      footer={
        <>
          Already have an account? <AuthLink to="/signin">Sign in</AuthLink>
        </>
      }
    >
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "#0a0a0a" }}>
          Create your account
        </h2>
        <p className="mt-1 text-sm" style={{ color: "#737373" }}>
          No credit card required. Takes less than a minute.
        </p>
      </div>

      <form
        className="mt-7 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (typeof window !== "undefined") localStorage.setItem("agroloop_auth", "1");
          navigate({ to: "/field" });
        }}
      >
        <AuthField label="Full name" required>
          <AuthInput type="text" placeholder="Enter your name" required />
        </AuthField>
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

        <label className="flex items-center gap-2 text-sm" style={{ color: "#404040" }}>
          <input type="checkbox" required className="h-4 w-4 rounded accent-[#16a36a]" />
          I agree to the <span className="underline">Terms & Data Policy</span>.
        </label>

        <div className="pt-2">
          <AuthButton type="submit">Create account</AuthButton>
        </div>
        <p className="text-center text-xs" style={{ color: "#737373" }}>
          Learn how we <span className="underline">protect</span> your data.
        </p>
      </form>

      <Divider label="or" />
      <SocialRow />
    </AuthLayout>
  );
}
