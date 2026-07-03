import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import authImage from "@/assets/field-aerial.jpg";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      className="min-h-screen w-full p-3 md:p-5"
      style={{
        background:
          "linear-gradient(135deg, #eaf6ef 0%, #e8efe9 35%, #e6e6f2 70%, #ddd9ef 100%)",
      }}
    >
      <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-1.5rem)] md:min-h-[calc(100vh-2.5rem)]">
        {/* Left visual panel */}
        <div className="relative overflow-hidden rounded-[28px] bg-black lg:w-1/2 min-h-[280px]">
          <img
            src={authImage}
            alt="Field irrigation sprinklers watering crops"
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            width={1024}
            height={1024}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.0) 100%)",
            }}
          />
          <div className="relative z-10 p-8 md:p-12 max-w-xl">
            <h1 className="text-white text-3xl md:text-4xl font-semibold leading-tight tracking-tight">
              {title}
            </h1>
            <p className="mt-4 text-white/75 text-sm md:text-base leading-relaxed max-w-md">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex-1 flex items-center justify-center px-4 py-10 md:py-16">
          <div className="w-full max-w-md flex flex-col" style={{ color: "#0a0a0a" }}>
            {children}
            <div className="mt-10 text-center text-sm" style={{ color: "#525252" }}>
              {footer}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5" style={{ color: "#0a0a0a" }}>
        {label}
        {required && <span style={{ color: "#e11d48" }}>*</span>}
      </span>
      {children}
    </label>
  );
}

export function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-11 rounded-xl border px-4 text-sm outline-none transition-colors focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20"
      style={{ borderColor: "#d4d4d8", background: "#ffffff", color: "#0a0a0a" }}
    />
  );
}

export function AuthButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full h-11 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
      style={{ background: "#16a36a" }}
    >
      {children}
    </button>
  );
}

export function SocialRow() {
  const Btn = ({ children, label }: { children: ReactNode; label: string }) => (
    <button
      aria-label={label}
      className="h-11 w-11 rounded-xl border flex items-center justify-center bg-white hover:bg-neutral-50 transition-colors"
      style={{ borderColor: "#e5e5e5" }}
    >
      {children}
    </button>
  );
  return (
    <div className="flex items-center justify-center gap-3">
      <Btn label="Google">
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.3-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.6 8.8 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.7 13-4.6l-6-5c-1.9 1.4-4.4 2.1-7 2.1-5.3 0-9.7-3-11.3-7.5l-6.5 5C9.4 39.2 16.1 43.5 24 43.5z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4-4.3 5.3l6 5c-.4.4 6.5-4.7 6.5-14.3 0-1.2-.1-2.3-.3-3.5z"/>
        </svg>
      </Btn>
      <Btn label="Apple">
        <svg width="18" height="20" viewBox="0 0 24 24" fill="#000">
          <path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.1-1.6-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.8-3.2-.8-1.6 0-3.2 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.8zM14 4.8c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/>
        </svg>
      </Btn>
      <Btn label="Agroloop">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2l10 10-10 10L2 12 12 2z" fill="#f5a524"/>
        </svg>
      </Btn>
      <Btn label="X">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#000">
          <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.812l-5.34-6.99L4.8 22H1.54l8.02-9.17L1 2h6.93l4.83 6.39L18.244 2zm-1.193 18h1.88L7.06 4H5.04l12.01 16z"/>
        </svg>
      </Btn>
    </div>
  );
}

export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="underline underline-offset-2" style={{ color: "#0a0a0a" }}>
      {children}
    </Link>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: "#e5e5e5" }} />
      <span className="text-xs" style={{ color: "#737373" }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: "#e5e5e5" }} />
    </div>
  );
}
