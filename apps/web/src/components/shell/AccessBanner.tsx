"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AccessSummaryDto } from "@petflow/shared";
import { api } from "@/lib/api";

/**
 * Aviso de assinatura no topo (Fase 8): fim do teste chegando, vencida
 * (tolerância) ou somente leitura. Some quando está tudo em dia.
 */
export function AccessBanner({ pathname }: { pathname: string }) {
  const [access, setAccess] = useState<AccessSummaryDto | null>(null);

  useEffect(() => {
    api<AccessSummaryDto>("/api/billing/access", { redirectOnUnauthorized: false })
      .then(setAccess)
      .catch(() => setAccess(null));
  }, [pathname]);

  if (!access) return null;
  const days = access.daysLeft ?? 0;
  let tone = "";
  let text = "";
  if (access.status === "TRIAL" && days <= 7) {
    tone = "border-sky-200 bg-sky-50 text-sky-900";
    text = days <= 1 ? "Seu teste grátis termina hoje." : `Seu teste grátis termina em ${days} dias.`;
  } else if (access.status === "ACTIVE" && days <= 5) {
    tone = "border-amber-200 bg-amber-50 text-amber-900";
    text = `Sua assinatura vence em ${days} dia(s).`;
  } else if (access.status === "GRACE") {
    tone = "border-amber-300 bg-amber-50 text-amber-900";
    text = `Sua assinatura venceu. Em ${days} dia(s) o sistema fica somente para consulta.`;
  } else if (access.status === "READ_ONLY") {
    tone = "border-red-300 bg-red-50 text-red-900";
    text = "Modo somente leitura: a assinatura venceu. Você consulta tudo, mas não registra vendas nem cadastros. Nenhum dado foi apagado.";
  } else {
    return null;
  }

  return (
    <div role="status" className={`no-print border-b px-4 py-2 text-sm md:px-6 ${tone}`}>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2">
        <span>{text}</span>
        <Link href="/faturamento" className="font-semibold underline">
          {access.status === "TRIAL" ? "Ver planos" : "Regularizar"}
        </Link>
      </div>
    </div>
  );
}
