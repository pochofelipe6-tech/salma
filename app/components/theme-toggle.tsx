"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("velo-theme");
      const next = saved === "light" ? "light" : "dark";
      setTheme(next);
      document.documentElement.dataset.theme = next;
    } catch {}
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("velo-theme", next);
    } catch {}
  }
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"
      }
      title={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
    </button>
  );
}
