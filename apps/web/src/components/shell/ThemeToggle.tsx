"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export const THEME_STORAGE_KEY = "akylla-theme";

/**
 * Script que roda antes da página pintar (no <head>): aplica o tema salvo
 * ou, sem escolha salva, o tema do sistema. Evita o "piscar" claro→escuro.
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

/** Botão sol/lua do topo: alterna entre visualização clara e noturna. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // navegador sem armazenamento: vale só nesta aba
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Usar visualização clara" : "Usar visualização noturna"}
      aria-pressed={dark}
      title={dark ? "Visualização clara" : "Visualização noturna"}
      className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
