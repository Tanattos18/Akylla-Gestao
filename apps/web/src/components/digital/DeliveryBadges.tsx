import { deliveryStatusLabels, type DeliveryStatus } from "../../lib/types";

const statusClass: Record<DeliveryStatus, string> = {
  IN_PROGRESS: "bg-sky-50 text-sky-700",
  ACTIVE: "bg-primary-50 text-primary-700",
  PAUSED: "bg-amber-50 text-amber-800",
  CANCELLED: "bg-slate-100 text-slate-700",
};

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[status]}`}>{deliveryStatusLabels[status]}</span>;
}

export function NeverPauseBadge() {
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800" title="Nunca pausar por atraso">
      Nunca pausar
    </span>
  );
}

/** Link externo que abre em nova aba, sem repassar a origem. */
export function ExternalLink({ href, label }: { href: string | null; label?: string }) {
  if (!href) return <span className="text-slate-400">—</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-primary-700 hover:underline">
      {label ?? href.replace(/^https?:\/\//, "").replace(/\/$/, "")}
    </a>
  );
}

/** Status do monitor do site: no ar, fora do ar ou ainda não checado. */
export function SiteStatusBadge({ status, enabled = true }: { status: "UP" | "DOWN" | null; enabled?: boolean }) {
  if (!enabled) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Sem monitor</span>;
  if (status === "UP") return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">● No ar</span>;
  if (status === "DOWN") return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">● Fora do ar</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Aguardando checagem</span>;
}
