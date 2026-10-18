import { Prisma, type ReleasePolicy } from "@prisma/client";

/**
 * Cálculo de comissão (Fase 2 · 2.1) — função pura, sem banco.
 *
 * Regras estudadas (não copiadas) em OCA/commission e ERPNext, conforme
 * upgrade/REFERENCIAS_GIT.md:
 * - base de cada item = subtotal do item com o desconto da venda rateado
 *   proporcionalmente (a sobra de centavos vai para o último item, então a
 *   soma das bases é exatamente o total da venda);
 * - precedência (mais específica vence): produto (do profissional > geral)
 *   → categoria (do profissional > geral) → regra só do profissional →
 *   `commissionDefault` do profissional → regra geral da empresa;
 * - valor total = soma exata de (base × % / 100), arredondada UMA vez a 2
 *   casas (meio para cima); a sobra de centavos das linhas vai para a
 *   última linha com comissão (soma das linhas = total).
 */

export interface CalculatorLine {
  saleItemId: string;
  productId: string;
  categoryId: string | null;
  productName: string;
  lineSubtotal: Prisma.Decimal;
}

export interface CalculatorRule {
  id: string;
  professionalId: string | null;
  productId: string | null;
  categoryId: string | null;
  percentage: Prisma.Decimal;
  releasePolicy: ReleasePolicy;
}

export interface CalculatorProfessional {
  id: string;
  commissionDefault: Prisma.Decimal | null;
}

export type CommissionSource =
  | "PRODUCT_PROFESSIONAL"
  | "PRODUCT"
  | "CATEGORY_PROFESSIONAL"
  | "CATEGORY"
  | "PROFESSIONAL_RULE"
  | "PROFESSIONAL_DEFAULT"
  | "COMPANY_RULE"
  | "NONE";

export interface CommissionLineResult {
  saleItemId: string;
  productName: string;
  base: string;
  percentage: string;
  amount: string;
  ruleId: string | null;
  source: CommissionSource;
}

export interface CommissionResult {
  baseAmount: Prisma.Decimal;
  amount: Prisma.Decimal;
  /** amount / base × 100 (exibição) */
  percentage: Prisma.Decimal;
  releasePolicy: ReleasePolicy;
  lines: CommissionLineResult[];
}

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);

function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Política mais conservadora vence (libera mais tarde). */
const POLICY_WEIGHT: Record<ReleasePolicy, number> = { ON_SALE: 0, SPLIT_50_50: 1, ON_PAYMENT: 2 };

function pickRule(
  line: CalculatorLine,
  professional: CalculatorProfessional,
  rules: CalculatorRule[],
): { percentage: Prisma.Decimal; rule: CalculatorRule | null; source: CommissionSource } {
  const ofProfessional = (rule: CalculatorRule) => rule.professionalId === professional.id;
  const general = (rule: CalculatorRule) => rule.professionalId === null;
  const forProduct = (rule: CalculatorRule) => rule.productId === line.productId;
  const forCategory = (rule: CalculatorRule) =>
    line.categoryId !== null && rule.productId === null && rule.categoryId === line.categoryId;
  const untargeted = (rule: CalculatorRule) => rule.productId === null && rule.categoryId === null;

  const candidates: Array<[CommissionSource, (rule: CalculatorRule) => boolean]> = [
    ["PRODUCT_PROFESSIONAL", (r) => forProduct(r) && ofProfessional(r)],
    ["PRODUCT", (r) => forProduct(r) && general(r)],
    ["CATEGORY_PROFESSIONAL", (r) => forCategory(r) && ofProfessional(r)],
    ["CATEGORY", (r) => forCategory(r) && general(r)],
    ["PROFESSIONAL_RULE", (r) => untargeted(r) && ofProfessional(r)],
  ];
  for (const [source, match] of candidates) {
    const rule = rules.find(match);
    if (rule) return { percentage: rule.percentage, rule, source };
  }
  if (professional.commissionDefault !== null) {
    return { percentage: professional.commissionDefault, rule: null, source: "PROFESSIONAL_DEFAULT" };
  }
  const companyRule = rules.find((r) => untargeted(r) && general(r));
  if (companyRule) return { percentage: companyRule.percentage, rule: companyRule, source: "COMPANY_RULE" };
  return { percentage: ZERO, rule: null, source: "NONE" };
}

export function calculateCommission(input: {
  lines: CalculatorLine[];
  saleSubtotal: Prisma.Decimal;
  saleTotal: Prisma.Decimal;
  professional: CalculatorProfessional;
  rules: CalculatorRule[];
}): CommissionResult {
  const { lines, saleSubtotal, saleTotal, professional, rules } = input;

  // Rateio do desconto: base proporcional; resto de centavos no último item
  const bases: Prisma.Decimal[] = [];
  let allocated = ZERO;
  lines.forEach((line, index) => {
    if (index === lines.length - 1) {
      bases.push(saleTotal.minus(allocated));
      return;
    }
    const base = saleSubtotal.isZero() ? ZERO : round2(line.lineSubtotal.times(saleTotal).dividedBy(saleSubtotal));
    bases.push(base);
    allocated = allocated.plus(base);
  });

  // Valor: total arredondado UMA vez (sobre a soma exata das linhas); as
  // linhas são arredondadas e a sobra de centavos vai para a última com
  // comissão — a soma das linhas é sempre igual ao total (auditável).
  const picks = lines.map((line) => pickRule(line, professional, rules));
  const exact = picks.map((picked, index) => (bases[index] ?? ZERO).times(picked.percentage).dividedBy(HUNDRED));
  const amount = round2(exact.reduce((acc, value) => acc.plus(value), ZERO));
  const lastWithCommission = exact.map((value) => value.gt(0)).lastIndexOf(true);
  let distributed = ZERO;
  const lineAmounts = exact.map((value, index) => {
    if (index === lastWithCommission) return ZERO; // definido abaixo
    const rounded = round2(value);
    distributed = distributed.plus(rounded);
    return rounded;
  });
  if (lastWithCommission >= 0) lineAmounts[lastWithCommission] = amount.minus(distributed);

  let baseAmount = ZERO;
  let releasePolicy: ReleasePolicy = "ON_SALE";
  const results: CommissionLineResult[] = lines.map((line, index) => {
    const base = bases[index] ?? ZERO;
    const picked = picks[index] as ReturnType<typeof pickRule>;
    const lineAmount = lineAmounts[index] ?? ZERO;
    baseAmount = baseAmount.plus(base);
    if (picked.rule && lineAmount.gt(0) && POLICY_WEIGHT[picked.rule.releasePolicy] > POLICY_WEIGHT[releasePolicy]) {
      releasePolicy = picked.rule.releasePolicy;
    }
    return {
      saleItemId: line.saleItemId,
      productName: line.productName,
      base: base.toFixed(2),
      percentage: picked.percentage.toFixed(2),
      amount: lineAmount.toFixed(2),
      ruleId: picked.rule?.id ?? null,
      source: picked.source,
    };
  });

  const percentage = baseAmount.isZero() ? ZERO : round2(amount.times(HUNDRED).dividedBy(baseAmount));
  return { baseAmount, amount, percentage, releasePolicy, lines: results };
}

/**
 * A venda já está paga? Hoje todas as formas de pagamento do PDV liquidam na
 * hora; o crediário (Fase 2 · 2.2) trará vendas a prazo.
 * - ON_SALE: libera na venda.
 * - ON_PAYMENT / SPLIT_50_50: com a venda paga na hora, libera tudo agora.
 */
export function releasesOnSale(policy: ReleasePolicy, salePaidNow: boolean): boolean {
  return policy === "ON_SALE" || salePaidNow;
}
