import type { ServiceOrderStatus } from "../../lib/types";

/** Cores dos selos de situação da OS (texto em stop 700+, contraste AA). */
export const serviceOrderStatusClass: Record<ServiceOrderStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  QUOTE: "bg-amber-50 text-amber-800",
  APPROVED: "bg-sky-50 text-sky-800",
  IN_PROGRESS: "bg-indigo-50 text-indigo-800",
  COMPLETED: "bg-emerald-50 text-emerald-800",
  CANCELLED: "bg-red-50 text-red-800",
};
