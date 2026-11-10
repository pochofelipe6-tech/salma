"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Car,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Route,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { DEMO_ACCOUNTS, readSession, signIn, type Role } from "./auth";
import { demoEnabled, cloudEnabled } from "./lib/supabase";
import "./login.css";
export default function Login() {
  const [role, setRole] = useState<Role>("conductor"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    void readSession()
      .then((s) => {
        if (cancelled) return;
        if (s) router.replace(s.role === "admin" ? "/admin" : "/conductor");
        else setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setReady(true);
          setError(
            "No se pudo comprobar la sesión. Revisa la conexión con Supabase.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);
  function changeRole(next: Role) {
    setRole(next);
    setEmail("");
    setPassword("");
    setError("");
    setVisible(false);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (await signIn(role, email, password))
        router.replace(role === "admin" ? "/admin" : "/conductor");
      else {
        setError(
          "El correo o la contraseña no corresponden al rol seleccionado.",
        );
        setBusy(false);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo iniciar sesión. Revisa tu conexión.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <a className="login-brand" href="/">
          <span>
            <Zap size={27} fill="currentColor" />
          </span>
          vélo<small>SEGURIDAD EN MOVIMIENTO</small>
        </a>
        <div className="login-story-content">
          <span className="login-eyebrow">CADA VIAJE CUENTA</span>
          <h1>
            El mejor destino
            <br />
            es llegar <em>bien.</em>
          </h1>
          <p>
            Un espacio para cuidar a quienes conducen y acompañar cada kilómetro
            del camino.
          </p>
          <div className="login-route-art" aria-hidden="true">
            <div className="route-line" />
            <div className="route-start">
              <Car size={23} />
            </div>
            <div className="route-end">
              <FlagIcon />
            </div>
            <div className="route-label">
              <span>
                <ShieldCheck size={16} /> PREVENCIÓN SST
              </span>
              <strong>Conectados por tu seguridad.</strong>
            </div>
            <span className="route-dot one" />
            <span className="route-dot two" />
          </div>
          <div className="login-benefits">
            <span>
              <Check size={15} /> Recorridos con GPS
            </span>
            <span>
              <Check size={15} /> Alertas preventivas
            </span>
            <span>
              <Check size={15} /> Control por zona
            </span>
          </div>
        </div>
        <div className="login-story-footer">
          <span>DISEÑADO PARA CUIDARTE</span>
          <ShieldCheck size={18} />
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-mobile-brand">
          <Zap size={22} fill="currentColor" /> vélo
        </div>
        <div className="login-form-wrap">
          <span className="login-welcome">
            <span /> BIENVENIDO A VÉLO
          </span>
          <h2>Tu camino empieza aquí.</h2>
          <p className="login-subtitle">
            Inicia sesión y entra a tu espacio de seguridad vial.
          </p>
          <div className="login-roles" role="group" aria-label="Tipo de acceso">
            <button
              type="button"
              aria-pressed={role === "conductor"}
              className={role === "conductor" ? "selected" : ""}
              onClick={() => changeRole("conductor")}
            >
              <Car size={20} />
              <span>
                <strong>Conductor</strong>
                <small>Mi recorrido</small>
              </span>
              {role === "conductor" && <Check size={15} />}
            </button>
            <button
              type="button"
              aria-pressed={role === "admin"}
              className={role === "admin" ? "selected" : ""}
              onClick={() => changeRole("admin")}
            >
              <ShieldCheck size={20} />
              <span>
                <strong>Administrador</strong>
                <small>Mi organización</small>
              </span>
              {role === "admin" && <Check size={15} />}
            </button>
          </div>
          <form onSubmit={submit}>
            <label htmlFor="email">Correo electrónico</label>
            <div className="login-input">
              <Mail size={17} />
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder={
                  demoEnabled ? DEMO_ACCOUNTS[role].email : "tu@correo.com"
                }
                required
                maxLength={150}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            <label htmlFor="password">Contraseña</label>
            <div className="login-input">
              <LockKeyhole size={17} />
              <input
                id="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                required
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                aria-label={
                  visible ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}
            <button
              className="login-submit"
              type="submit"
              disabled={!ready || busy}
            >
              {busy
                ? "Iniciando sesión…"
                : `Entrar como ${role === "admin" ? "administrador" : "conductor"}`}
              <ArrowRight size={18} />
            </button>
          </form>
          {demoEnabled ? (
            <div className="login-demo">
              <div>
                <span>ACCESO DE DEMOSTRACIÓN</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(DEMO_ACCOUNTS[role].email);
                    setPassword(DEMO_ACCOUNTS[role].password);
                    setError("");
                  }}
                >
                  Usar cuenta de prueba <ArrowRight size={12} />
                </button>
              </div>
              <p>
                <strong>{DEMO_ACCOUNTS[role].email}</strong>
                <span>
                  Contraseña: <code>{DEMO_ACCOUNTS[role].password}</code>
                </span>
              </p>
              <small>
                Prototipo con sesión local. Las cuentas son públicas y no
                protegen datos reales; la autenticación de producción requiere
                un backend.
              </small>
            </div>
          ) : (
            <div className="login-demo">
              <span>
                {cloudEnabled
                  ? "ACCESO CON SUPABASE"
                  : "CONFIGURACIÓN PENDIENTE"}
              </span>
              <p>
                {cloudEnabled
                  ? "Usa tu cuenta registrada. Tu rol lo asigna el administrador."
                  : "Completa las variables de Supabase y reinicia la aplicación."}
              </p>
            </div>
          )}
          <p className="login-help">
            <ShieldCheck size={14} /> Cada decisión segura hace la diferencia.
          </p>
        </div>
        <div className="login-bottom">
          VÉLO · PREVENCIÓN Y SEGURIDAD VIAL <span>Programa SST</span>
        </div>
      </section>
    </div>
  );
}
function FlagIcon() {
  return <Route size={25} />;
}
