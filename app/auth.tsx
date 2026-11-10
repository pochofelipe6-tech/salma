"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
export type Role = "admin" | "conductor";
type Session = { role: Role; email: string; expiresAt: number };
const KEY = "velo-demo-session";
// Demo accounts only. Client checks do not provide server authorization.
export const DEMO_ACCOUNTS = {
  admin: { email: "admin@velo.app", password: "Admin123!" },
  conductor: { email: "conductor@velo.app", password: "Conductor123!" },
};
export function readSession(): Session | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (
      value &&
      (value.role === "admin" || value.role === "conductor") &&
      typeof value.email === "string" &&
      Number.isFinite(value.expiresAt) &&
      value.expiresAt > Date.now()
    )
      return value;
    sessionStorage.removeItem(KEY);
  } catch {}
  return null;
}
export function signIn(role: Role, email: string, password: string) {
  const account = DEMO_ACCOUNTS[role];
  if (
    email.trim().toLowerCase() !== account.email ||
    password !== account.password
  )
    return false;
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      role,
      email: account.email,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    }),
  );
  window.dispatchEvent(new Event("velo-session"));
  return true;
}
export function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const [allowed, setAllowed] = useState(false);
  const router = useRouter();
  useEffect(() => {
    function check() {
      const s = readSession();
      if (!s) {
        setAllowed(false);
        router.replace("/");
      } else if (s.role !== role) {
        setAllowed(false);
        router.replace(s.role === "admin" ? "/admin" : "/conductor");
      } else setAllowed(true);
    }
    check();
    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("velo-session", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("velo-session", check);
    };
  }, [role, router]);
  return allowed ? (
    children
  ) : (
    <div className="auth-loading">
      <ShieldCheck size={28} />
      <p>Preparando tu espacio…</p>
    </div>
  );
}
export function LogoutButton({ beforeLogout }: { beforeLogout?: () => void }) {
  const router = useRouter();
  return (
    <button
      className="logout-button"
      onClick={() => {
        beforeLogout?.();
        sessionStorage.removeItem(KEY);
        window.dispatchEvent(new Event("velo-session"));
        router.replace("/");
      }}
    >
      <LogOut size={15} /> Cerrar sesión
    </button>
  );
}
