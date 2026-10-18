import { Prisma } from "@prisma/client";

/**
 * Plano de parcelas do crediário (Fase 2 · 2.2) — função pura.
 *
 * Regras estudadas (não copiadas) em OCA/account-payment
 * (`account_payment_term_extension`) e no ERPNext (*Payment Schedule*),
 * conforme upgrade/REFERENCIAS_GIT.md:
 * - parcelas iguais arredondadas para baixo a 2 casas; a sobra de centavos
 *   vai para a ÚLTIMA parcela (soma das parcelas = total, sempre);
 * - vencimentos mensais a partir do 1º vencimento, no mesmo dia do mês; em
 *   meses mais curtos usa o último dia (31/01 → 28/02 → 31/03).
 */

export interface PlannedInstallment {
  number: number;
  dueDate: Date;
  amount: Prisma.Decimal;
}

function parseDay(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return { year, month: month - 1, day };
}

function monthlyDate(first: { year: number; month: number; day: number }, offset: number): Date {
  const monthIndex = first.month + offset;
  const year = first.year + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Meio-dia UTC: o vencimento é uma DATA; evita virar o dia em qualquer fuso
  return new Date(Date.UTC(year, month, Math.min(first.day, lastDay), 12, 0, 0));
}

export function buildInstallmentPlan(total: Prisma.Decimal, count: number, firstDueDate: string): PlannedInstallment[] {
  if (!Number.isInteger(count) || count < 1) throw new Error("Quantidade de parcelas inválida");
  const base = total.dividedBy(count).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  const first = parseDay(firstDueDate);
  const plan: PlannedInstallment[] = [];
  let allocated = new Prisma.Decimal(0);
  for (let i = 0; i < count; i += 1) {
    const isLast = i === count - 1;
    const amount = isLast ? total.minus(allocated) : base;
    allocated = allocated.plus(amount);
    plan.push({ number: i + 1, dueDate: monthlyDate(first, i), amount });
  }
  return plan;
}

/** Início do dia de hoje (UTC) — parcela vence quando `dueDate < hoje`. */
export function startOfTodayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
