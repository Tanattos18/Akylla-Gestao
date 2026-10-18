"use client";

import { useEffect, useState } from "react";
import type { AuthOptionsDto } from "@petflow/shared";
import { api } from "./api";

/** WhatsApp de suporte/vendas (só dígitos, com DDI). */
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SALES_WHATSAPP || "5562981517002";

export function whatsappLink(text: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

/**
 * O que está disponível nesta instalação (cadastro aberto, e-mail). Enquanto
 * carrega, devolve null: as telas não mostram links que podem estar quebrados.
 */
export function useAuthOptions(): AuthOptionsDto | null {
  const [options, setOptions] = useState<AuthOptionsDto | null>(null);
  useEffect(() => {
    api<AuthOptionsDto>("/api/auth/options", { redirectOnUnauthorized: false })
      .then(setOptions)
      .catch(() => setOptions({ registrationEnabled: false, emailEnabled: false }));
  }, []);
  return options;
}
