"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
}

/**
 * Abas acessíveis (Fase 5 · 5.1) no padrão WAI-ARIA: setas esquerda/direita,
 * Home/End e só a aba ativa no Tab. Controladas pelo componente pai.
 */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label,
  children,
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Nome acessível do grupo de abas. */
  label: string;
  children: ReactNode;
}) {
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const target = items[next];
    if (!target) return;
    onChange(target.key);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="no-print flex flex-wrap gap-1 border-b border-slate-200">
        {items.map((item, index) => {
          const selected = item.key === value;
          return (
            <button
              key={item.key}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "border-primary-600 text-slate-900"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${value}`} className="pt-4">
        {children}
      </div>
    </div>
  );
}
