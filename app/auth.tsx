"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { cloudEnabled, demoEnabled, getSupabase } from "./lib/supabase";
export type Role = "admin" | "conductor";
type Session = {
  role: Role;
  email: string;
  expiresAt: number;
  userId?: string;
  fullName?: string;
};
let authenticatedUserId: string | null = null;
export function currentUserId() {
  return authenticatedUserId;
}
export function storageKey(key: string) {
  if (demoEnabled) return key;
  if (!authenticatedUserId) throw new Error("No hay usuario autenticado");
  return `${key}:${authenticatedUserId}`;
}
const KEY = "velo-demo-session";
// Demo accounts only. Client checks do not provide server authorization.
export const DEMO_ACCOUNTS = {
  admin: { email: "admin@velo.app", password: "Admin123!" },
  conductor: { email: "conductor@velo.app", password: "Conductor123!" },
};
export async function readSession(): Promise<Session | null> {
  if (!demoEnabled) {
    if (!cloudEnabled) return null;
    const db = getSupabase();
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) {
      authenticatedUserId = null;
      return null;
    }
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id,email,full_name,role")
      .eq("id", data.user.id)
      .single();
    if (
      profileError ||
      !profile ||
      !["admin", "conductor"].includes(profile.role)
    ) {
      authenticatedUserId = null;
      return null;
    }
    authenticatedUserId = data.user.id;
    return {
      role: profile.role,
      email: profile.email,
      userId: profile.id,
      fullName: profile.full_name,
      expiresAt: Date.now() + 60000,
    };
  }
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
export async function signIn(role: Role, email: string, password: string) {
  if (!demoEnabled) {
    if (!cloudEnabled)
      throw new Error(
        "Completa la URL y clave pública de Supabase en .env.local.",
      );
    const db = getSupabase();
    const { error } = await db.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return false;
    const session = await readSession();
    if (!session || session.role !== role) {
      await db.auth.signOut();
      authenticatedUserId = null;
      return false;
    }
    window.dispatchEvent(new Event("velo-session"));
    return true;
  }
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
    let disposed = false;
    let checking = false;
    async function check() {
      if (checking) return;
      checking = true;
      const s = await readSession().catch(() => null);
      checking = false;
      if (disposed) return;
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
      disposed = true;
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
export function LogoutButton({
  beforeLogout,
}: {
  beforeLogout?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <span>
      <button
        className="logout-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await beforeLogout?.();
            if (cloudEnabled) {
              const { error } = await getSupabase().auth.signOut();
              if (error) throw error;
              authenticatedUserId = null;
            }
            sessionStorage.removeItem(KEY);
            window.dispatchEvent(new Event("velo-session"));
            router.replace("/");
          } catch {
            setError("No se pudo cerrar sesión. Reintenta.");
            setBusy(false);
          }
        }}
      >
        <LogOut size={15} /> {busy ? "Cerrando…" : "Cerrar sesión"}
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
