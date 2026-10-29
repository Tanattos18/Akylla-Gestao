import { Prisma } from "@prisma/client";
import { AD_METRIC_SOURCE_PRIORITY, type AdIndicatorsDto, type AdMetricDayDto, type AdMetricSource } from "@petflow/shared";

/**
 * Indicadores dos anúncios (upgrade/PLANO_ANUNCIOS.md §4.3), sempre no
 * servidor. Regras em docs/akylla/DICIONARIO_INDICADORES.md:
 * - no mesmo dia vale uma única origem, a de maior precedência
 *   (API > CSV > MANUAL); as outras ficam gravadas, mas fora da soma;
 * - divisão por zero → null (a tela mostra "—").
 */

export interface MetricRow {
  campaignId: string;
  date: Date;
  source: AdMetricSource;
  impressions: number;
  reach: number;
  clicks: number;
  spend: Prisma.Decimal;
  results: number;
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Uma linha por (campanha, dia): a de maior precedência. */
export function effectiveMetrics<T extends MetricRow>(rows: T[]): Array<T & { overridden: AdMetricSource[] }> {
  const byKey = new Map<string, { best: T; others: AdMetricSource[] }>();
  for (const row of rows) {
    const key = `${row.campaignId}|${dayKey(row.date)}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, { best: row, others: [] });
    } else if (AD_METRIC_SOURCE_PRIORITY[row.source] > AD_METRIC_SOURCE_PRIORITY[current.best.source]) {
      current.others.push(current.best.source);
      current.best = row;
    } else {
      current.others.push(row.source);
    }
  }
  return [...byKey.values()]
    .map(({ best, others }) => ({ ...best, overridden: others }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Divisão em Decimal com 2 casas; divisor zero → null. */
function money(numerator: Prisma.Decimal, divisor: number): string | null {
  if (divisor === 0) return null;
  return numerator.div(divisor).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

/** Soma as linhas JÁ efetivas (use `effectiveMetrics` antes). */
export function computeIndicators(rows: Array<Pick<MetricRow, "impressions" | "reach" | "clicks" | "spend" | "results">>): AdIndicatorsDto {
  let impressions = 0;
  let reach = 0;
  let clicks = 0;
  let results = 0;
  let spend = new Prisma.Decimal(0);
  for (const row of rows) {
    impressions += row.impressions;
    reach += row.reach;
    clicks += row.clicks;
    results += row.results;
    spend = spend.add(row.spend);
  }
  return {
    impressions,
    reach,
    clicks,
    spend: spend.toFixed(2),
    results,
    ctr: impressions === 0 ? null : Math.round((clicks / impressions) * 10000) / 100,
    cpc: money(spend, clicks),
    costPerResult: money(spend, results),
    days: rows.length,
  };
}

export function toMetricDayDto(row: MetricRow & { overridden: AdMetricSource[] }): AdMetricDayDto {
  return {
    date: dayKey(row.date),
    source: row.source,
    impressions: row.impressions,
    reach: row.reach,
    clicks: row.clicks,
    spend: row.spend.toFixed(2),
    results: row.results,
    overridden: row.overridden,
  };
}
