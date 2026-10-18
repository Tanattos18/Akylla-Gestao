"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { formatLocalTime, shiftDay, todayLocal } from "../../lib/format";
import { appointmentStatusLabels, type AppointmentDto, type AppointmentStatus, type Paginated } from "../../lib/types";

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MAX_PAGES = 10;

const dotClass: Record<AppointmentStatus, string> = {
  SCHEDULED: "bg-sky-600",
  CONFIRMED: "bg-primary-700",
  COMPLETED: "bg-slate-500",
  CANCELLED: "bg-red-700",
  NO_SHOW: "bg-amber-700",
};

function parts(dayKey: string): [number, number, number] {
  const [y, m, d] = dayKey.split("-").map(Number);
  return [y!, m!, d!];
}

/** Segunda-feira da semana do dia (semana começa na segunda). */
export function weekStart(dayKey: string): string {
  const [y, m, d] = parts(dayKey);
  const weekday = (new Date(y, m - 1, d, 12).getDay() + 6) % 7;
  return shiftDay(dayKey, -weekday);
}

function monthGrid(dayKey: string): { first: string; last: string; cells: string[]; month: number } {
  const [y, m] = parts(dayKey);
  const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
  const start = weekStart(firstOfMonth);
  const cells = Array.from({ length: 42 }, (_, i) => shiftDay(start, i));
  return { first: cells[0]!, last: cells[41]!, cells, month: m };
}

function label(dayKey: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = parts(dayKey);
  return new Date(y, m - 1, d, 12).toLocaleDateString("pt-BR", options);
}

/** Busca todas as páginas do período (máx. 1000 agendamentos). */
async function loadRange(from: string, to: string, status: string, search: string): Promise<AppointmentDto[]> {
  const all: AppointmentDto[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ from, to, page: String(page), pageSize: "100" });
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    const data = await api<Paginated<AppointmentDto>>(`/api/appointments?${params.toString()}`);
    all.push(...data.items);
    if (all.length >= data.total || data.items.length === 0) break;
  }
  return all;
}

/**
 * Visões de semana e mês da agenda (Fase 7 · 7.4), sobre o mesmo
 * `GET /api/appointments` (filtro por período).
 */
export function CalendarView({
  view,
  day,
  status,
  search,
  onPickDay,
}: {
  view: "semana" | "mes";
  day: string;
  status: string;
  search: string;
  onPickDay: (day: string) => void;
}) {
  const [items, setItems] = useState<AppointmentDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "semana") {
      const start = weekStart(day);
      return { from: start, to: shiftDay(start, 6) };
    }
    const grid = monthGrid(day);
    return { from: grid.first, to: grid.last };
  }, [view, day]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    loadRange(range.from, range.to, status, search)
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar a agenda.");
      });
    return () => {
      cancelled = true;
    };
  }, [range, status, search]);

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentDto[]>();
    for (const item of items ?? []) {
      const key = item.startLocal.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startLocal.localeCompare(b.startLocal));
    return map;
  }, [items]);

  const today = todayLocal();

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!items) return <p className="py-8 text-center text-sm text-slate-600">Carregando…</p>;

  if (view === "semana") {
    const days = Array.from({ length: 7 }, (_, i) => shiftDay(range.from, i));
    return (
      <div className="grid gap-3 md:grid-cols-7" aria-label="Agenda da semana">
        {days.map((key, i) => {
          const list = byDay.get(key) ?? [];
          return (
            <section
              key={key}
              aria-label={label(key, { weekday: "long", day: "numeric", month: "long" })}
              className={`min-h-32 rounded-lg border bg-white p-2 shadow-sm ${key === today ? "border-primary-500" : "border-slate-200"}`}
            >
              <button
                type="button"
                onClick={() => onPickDay(key)}
                className="mb-2 flex w-full items-baseline justify-between rounded px-1 text-left hover:bg-slate-50"
              >
                <span className="text-xs font-semibold uppercase text-slate-600">{WEEKDAYS[i]}</span>
                <span className={`text-sm font-semibold ${key === today ? "text-primary-700" : "text-slate-900"}`}>
                  {label(key, { day: "2-digit", month: "2-digit" })}
                </span>
              </button>
              <ul className="space-y-1.5">
                {list.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/agenda/${a.id}`}
                      className={`block rounded-md border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50 ${a.status === "CANCELLED" ? "opacity-60 line-through" : ""}`}
                    >
                      <span className="font-semibold text-slate-900">{formatLocalTime(a.startLocal)}</span>{" "}
                      <span className="text-slate-800">{a.client.name}</span>
                      <span className="block truncate text-slate-600">
                        {a.service.name} · {appointmentStatusLabels[a.status]}
                      </span>
                    </Link>
                  </li>
                ))}
                {list.length === 0 && <li className="px-1 text-xs text-slate-500">Livre</li>}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }

  const grid = monthGrid(day);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-slate-600" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <ul className="grid grid-cols-7 gap-1" aria-label={`Agenda de ${label(day, { month: "long", year: "numeric" })}`}>
        {grid.cells.map((key) => {
          const list = byDay.get(key) ?? [];
          const inMonth = parts(key)[1] === grid.month;
          const active = list.filter((a) => a.status !== "CANCELLED");
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onPickDay(key)}
                aria-label={`${label(key, { day: "numeric", month: "long" })}: ${active.length} agendamento(s)`}
                className={`flex h-16 w-full flex-col items-start rounded-md border p-1 text-left hover:bg-slate-50 sm:h-20 ${
                  key === today ? "border-primary-500" : "border-slate-100"
                } ${inMonth ? "" : "bg-slate-50"}`}
              >
                <span className={`text-xs font-semibold ${inMonth ? "text-slate-900" : "text-slate-500"}`}>{parts(key)[2]}</span>
                {list.length > 0 && (
                  <span className="mt-auto flex w-full flex-wrap items-center gap-0.5">
                    {list.slice(0, 6).map((a) => (
                      <span key={a.id} aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClass[a.status]}`} />
                    ))}
                    <span className="ml-auto text-[10px] font-medium text-slate-700">{active.length}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-600">Clique em um dia para ver os horários.</p>
    </div>
  );
}
