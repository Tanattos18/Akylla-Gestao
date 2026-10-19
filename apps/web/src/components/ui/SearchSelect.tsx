"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { api } from "../../lib/api";

export interface SearchSelectItem {
  id: string;
  name: string;
}

/**
 * Seletor com busca por digitação (auditoria bloco 5): consulta a API a cada
 * digitação (`search=`), sem o limite de 100 itens dos <select> antigos.
 * Padrão WAI-ARIA combobox: setas, Enter, Esc.
 */
export function SearchSelect<T extends SearchSelectItem>({
  id,
  endpoint,
  value,
  selectedLabel,
  onChange,
  placeholder = "Digite para buscar…",
  emptyOptionLabel,
  describe,
  invalid,
  className = "",
  disabled,
  labelUrl,
}: {
  id: string;
  /** Rota de listagem, já com filtros (ex.: "/api/clients?status=ACTIVE"). */
  endpoint: string;
  value: string;
  /** Nome do item já escolhido (ex.: ao editar). */
  selectedLabel?: string | null;
  onChange: (id: string, item: T | null) => void;
  placeholder?: string;
  /** Opção "sem seleção" (ex.: "Venda rápida sem cliente"). */
  emptyOptionLabel?: string;
  /** Texto auxiliar de cada item (ex.: telefone). */
  describe?: (item: T) => string | null | undefined;
  invalid?: boolean;
  className?: string;
  disabled?: boolean;
  /** Rota de detalhe para descobrir o nome quando só o id é conhecido. */
  labelUrl?: (id: string) => string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState(selectedLabel ?? "");
  const [items, setItems] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedLabel !== undefined && selectedLabel !== null) setLabel(selectedLabel);
    if (!value) setLabel("");
  }, [selectedLabel, value]);

  useEffect(() => {
    if (!value || label || selectedLabel || !labelUrl) return;
    api<{ name: string }>(labelUrl(value), { redirectOnUnauthorized: false })
      .then((item) => setLabel(item.name))
      .catch(() => undefined);
  }, [value, label, selectedLabel, labelUrl]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      setLoading(true);
      const separator = endpoint.includes("?") ? "&" : "?";
      const search = query.trim() ? `&search=${encodeURIComponent(query.trim())}` : "";
      api<{ items: T[]; total: number }>(`${endpoint}${separator}pageSize=20${search}`)
        .then((data) => {
          setItems(data.items);
          setTotal(data.total);
          setActive(0);
        })
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open, endpoint]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const options: Array<T | null> = emptyOptionLabel ? [null, ...items] : items;

  function choose(item: T | null) {
    onChange(item?.id ?? "", item);
    setLabel(item?.name ?? "");
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const item = options[active];
      if (item !== undefined) choose(item);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-activedescendant={open && options[active] !== undefined ? `${listId}-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={open ? query : label || ""}
        placeholder={label || (emptyOptionLabel ?? placeholder)}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none disabled:opacity-60"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {options.map((item, index) => (
            <li
              key={item?.id ?? "__empty"}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={(item?.id ?? "") === value}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setActive(index)}
              className={`cursor-pointer px-3 py-2 ${index === active ? "bg-primary-50 text-primary-900" : "text-slate-800"}`}
            >
              {item ? (
                <>
                  <span className="font-medium">{item.name}</span>
                  {describe?.(item) ? <span className="ml-2 text-xs text-slate-500">{describe(item)}</span> : null}
                </>
              ) : (
                <span className="text-slate-600">{emptyOptionLabel}</span>
              )}
            </li>
          ))}
          {!loading && items.length === 0 && (
            <li className="px-3 py-2 text-slate-500">{query.trim() ? "Nada encontrado." : "Nenhum cadastro."}</li>
          )}
          {loading && <li className="px-3 py-2 text-slate-500">Buscando…</li>}
          {!loading && total > items.length && (
            <li className="px-3 py-2 text-xs text-slate-500">
              Mostrando {items.length} de {total}. Digite para refinar.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
