"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Package, PawPrint, Receipt, Scissors, Search, Users, Wrench, type LucideIcon } from "lucide-react";
import type { GlobalSearchItem, GlobalSearchKind, GlobalSearchResult } from "@petflow/shared";
import { api } from "@/lib/api";

const ICONS: Record<GlobalSearchKind, LucideIcon> = {
  client: Users,
  product: Package,
  sale: Receipt,
  serviceOrder: Wrench,
  service: Scissors,
  pet: PawPrint,
};

/**
 * Busca global (Fase 7 · 7.3): `GET /api/search`, debounce de 300 ms,
 * mínimo 2 caracteres, resultados agrupados por tipo e navegação por
 * teclado (↑ ↓ Enter Esc) no padrão combobox do WAI-ARIA.
 */
export function GlobalSearch({ inputClassName }: { inputClassName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [active, setActive] = useState(-1);

  const flat = useMemo<GlobalSearchItem[]>(() => result?.groups.flatMap((g) => g.items) ?? [], [result]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function onChange(value: string) {
    setTerm(value);
    setOpen(true);
    setActive(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 2) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      const requestId = ++requestRef.current;
      api<GlobalSearchResult>(`/api/search?q=${encodeURIComponent(q)}`, { redirectOnUnauthorized: false })
        .then((data) => {
          if (requestId === requestRef.current) setResult(data);
        })
        .catch(() => {
          if (requestId === requestRef.current) setResult({ query: q, groups: [] });
        })
        .finally(() => {
          if (requestId === requestRef.current) setLoading(false);
        });
    }, 300);
  }

  function go(item: GlobalSearchItem) {
    setOpen(false);
    setTerm("");
    setResult(null);
    router.push(item.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!flat.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? flat.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flat[active >= 0 ? active : 0];
      if (item) go(item);
    }
  }

  const showPanel = open && term.trim().length >= 2;
  const optionId = (index: number) => `${listId}-opt-${index}`;
  let index = -1;

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        role="combobox"
        aria-label="Busca global"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
        value={term}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar…"
        className={inputClassName}
      />
      {showPanel && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          {loading && <p className="px-4 py-3 text-sm text-slate-600">Buscando…</p>}
          {!loading && flat.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-600">Nenhum resultado para “{term.trim()}”.</p>
          )}
          <ul id={listId} role="listbox" aria-label="Resultados da busca" className="max-h-96 overflow-y-auto py-1 text-slate-700">
            {!loading &&
              result?.groups.map((group) => (
                <li key={group.kind} role="presentation">
                  <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{group.label}</p>
                  <ul role="presentation">
                    {group.items.map((item) => {
                      index += 1;
                      const current = index;
                      const Icon = ICONS[item.kind] ?? FileText;
                      return (
                        <li
                          key={`${item.kind}-${item.id}`}
                          id={optionId(current)}
                          role="option"
                          aria-selected={active === current}
                          onMouseEnter={() => setActive(current)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            go(item);
                          }}
                          className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${active === current ? "bg-primary-50" : "hover:bg-slate-50"}`}
                        >
                          <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
                          <span className="truncate">{item.title}</span>
                          {item.subtitle && <span className="ml-auto shrink-0 text-xs text-slate-600">{item.subtitle}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
          </ul>
          <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-600">↑ ↓ para navegar · Enter para abrir · Esc para fechar</p>
        </div>
      )}
    </div>
  );
}
