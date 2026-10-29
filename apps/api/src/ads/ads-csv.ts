import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { parse } from "csv-parse/sync";
import type { AdImportColumn } from "@petflow/shared";
import { CSV_ROW_LIMIT } from "../common/utils/csv";

/**
 * Leitura do CSV exportado do Gerenciador de Anúncios da Meta e do Google
 * Ads (fase A2 do upgrade/PLANO_ANUNCIOS.md). Função pura, sem banco:
 * - texto UTF-8 (com ou sem BOM) ou UTF-16 (o "CSV para Excel" do Google);
 * - separador vírgula, ponto e vírgula ou tabulação;
 * - linhas de título antes do cabeçalho e linhas "Total" no fim (Google);
 * - cabeçalhos em pt-BR e en;
 * - números no formato brasileiro ("1.234,56") ou internacional ("1,234.56").
 */

export interface AdCsvRow {
  /** Linha no arquivo (1 = primeira linha) */
  line: number;
  campaign: string | null;
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: Prisma.Decimal;
  results: number;
}

export interface ParsedAdCsv {
  format: "META" | "GOOGLE" | "GENERIC";
  columns: Partial<Record<AdImportColumn, string>>;
  campaignNames: string[];
  rows: AdCsvRow[];
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Nomes aceitos por campo (normalizados), em ordem de preferência. */
const ALIASES: Record<AdImportColumn, string[]> = {
  date: ["dia", "day", "data", "date", "iniciodosrelatorios", "iniciodorelatorio", "reportingstarts"],
  endDate: ["terminodosrelatorios", "terminodorelatorio", "reportingends"],
  campaign: ["nomedacampanha", "campaignname", "campanha", "campaign"],
  impressions: ["impressoes", "impressions", "impr"],
  reach: ["alcance", "reach"],
  clicks: ["cliquesnolink", "linkclicks", "cliques", "clicks", "cliquestodos", "clicksall"],
  spend: ["valorusadobrl", "valorusado", "amountspentbrl", "amountspent", "custo", "cost", "investimento", "gasto", "spend"],
  results: ["resultados", "results", "conversoes", "conversions", "leads"],
};

/** "Valor usado (BRL)", "Amount spent (USD)": prefixo + moeda. */
const SPEND_PREFIXES = ["valorusado", "amountspent"];

function mapColumns(headers: string[]): Partial<Record<AdImportColumn, number>> {
  const normalized = headers.map(normalizeHeader);
  const result: Partial<Record<AdImportColumn, number>> = {};
  for (const field of Object.keys(ALIASES) as AdImportColumn[]) {
    for (const alias of ALIASES[field]) {
      const index = normalized.indexOf(alias);
      if (index >= 0) {
        result[field] = index;
        break;
      }
    }
  }
  if (result.spend === undefined) {
    const index = normalized.findIndex((h) => SPEND_PREFIXES.some((prefix) => h.startsWith(prefix)));
    if (index >= 0) result.spend = index;
  }
  return result;
}

function detectFormat(headers: string[]): ParsedAdCsv["format"] {
  const normalized = headers.map(normalizeHeader);
  if (normalized.some((h) => SPEND_PREFIXES.some((p) => h.startsWith(p)) || h === "iniciodosrelatorios" || h === "reportingstarts" || h === "nomedacampanha" || h === "campaignname")) {
    return "META";
  }
  if (normalized.some((h) => h === "impr" || h === "custo" || h === "cost" || h === "conversoes" || h === "conversions")) {
    return "GOOGLE";
  }
  return "GENERIC";
}

function decode(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.subarray(2));
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  const text = buffer.toString("utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function delimiterOf(line: string): string {
  const counts: Array<[string, number]> = [
    ["\t", (line.match(/\t/g) ?? []).length],
    [";", (line.match(/;/g) ?? []).length],
    [",", (line.match(/,/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ",";
}

const PT_MONTHS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};
const EN_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isoDay(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** "2026-10-01", "01/10/2026", "1 de out. de 2026", "Oct 1, 2026" → "2026-10-01". */
export function parseAdDate(value: string): string | null {
  const text = value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (m) return isoDay(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(text);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    // Padrão brasileiro (dia/mês); só inverte quando o "mês" passa de 12
    return b > 12 && a <= 12 ? isoDay(Number(m[3]), a, b) : isoDay(Number(m[3]), b, a);
  }
  m = /^(\d{1,2}) de ([a-z]+)\.? de (\d{4})$/.exec(text);
  if (m) {
    const month = PT_MONTHS[m[2]!.slice(0, 3)];
    return month ? isoDay(Number(m[3]), month, Number(m[1])) : null;
  }
  m = /^(?:[a-z]+, )?([a-z]+)\.? (\d{1,2}), (\d{4})$/.exec(text);
  if (m) {
    const month = EN_MONTHS[m[1]!.slice(0, 3)];
    return month ? isoDay(Number(m[3]), month, Number(m[2])) : null;
  }
  return null;
}

/**
 * Número da planilha → texto decimal ("1234.56"); null se inválido.
 * Vazio, "--" e "—" valem 0 (a plataforma usa para "sem dados").
 */
export function parseAdNumber(value: string | undefined, kind: "int" | "money"): string | null {
  let text = (value ?? "").trim().replace(/\s/g, "").replace(/^(R\$|BRL|US\$|\$)/i, "").replace(/%$/, "");
  if (text === "" || text === "--" || text === "-" || text === "—") return "0";
  if (!/^\d[\d.,]*$/.test(text)) return null;
  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma && hasDot) {
    const decimal = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    text = text.split(thousands).join("");
    if (text.split(decimal).length > 2) return null;
    text = text.replace(decimal, ".");
  } else if (hasComma) {
    if (/^\d{1,3}(,\d{3})+$/.test(text) && kind === "int") text = text.replace(/,/g, "");
    else if (text.split(",").length === 2) text = text.replace(",", ".");
    else return null;
  } else if (hasDot) {
    // "1.234" (milhar brasileiro) — valores com 3 casas não existem aqui
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
    else if (text.split(".").length > 2) return null;
  }
  return /^\d+(\.\d+)?$/.test(text) ? text : null;
}

function issue(line: number, message: string) {
  return { row: line, message: `Linha ${line}: ${message}` };
}

export function parseAdCsv(buffer: Buffer): ParsedAdCsv {
  const content = decode(buffer);
  const lines = content.split(/\r?\n/);

  // Cabeçalho: primeira das 15 linhas iniciais com data + investimento/impressões
  let headerIndex = -1;
  let delimiter = ",";
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    const d = delimiterOf(line);
    let cells: string[];
    try {
      cells = (parse(line, { delimiter: d, relax_quotes: true, relax_column_count: true }) as string[][])[0] ?? [];
    } catch {
      continue;
    }
    const mapped = mapColumns(cells);
    if (mapped.date !== undefined && (mapped.spend !== undefined || mapped.impressions !== undefined)) {
      headerIndex = i;
      delimiter = d;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new BadRequestException(
      'Cabeçalho não reconhecido: a planilha precisa de uma coluna de data ("Dia", "Início dos relatórios" ou "Day") e de investimento ("Valor usado (BRL)", "Custo", "Amount spent" ou "Cost"). Na Meta, exporte com Detalhamento > Por tempo > Dia.',
    );
  }

  let records: string[][];
  try {
    records = parse(lines.slice(headerIndex).join("\n"), {
      delimiter,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BadRequestException(`CSV inválido: ${message}`);
  }

  const headers = records[0] ?? [];
  const map = mapColumns(headers);
  if (map.spend === undefined) {
    throw new BadRequestException('Coluna de investimento não encontrada ("Valor usado (BRL)", "Custo", "Amount spent" ou "Cost").');
  }
  const body = records.slice(1);
  if (body.length > CSV_ROW_LIMIT) {
    throw new BadRequestException(`Planilha com ${body.length} linhas (máximo ${CSV_ROW_LIMIT})`);
  }

  // Só "Início/Término dos relatórios" sem coluna "Dia": cada linha precisa ser de um dia só
  const byReportingStart = ["iniciodosrelatorios", "iniciodorelatorio", "reportingstarts"].includes(normalizeHeader(headers[map.date!] ?? ""));
  if (!byReportingStart) delete map.endDate;

  const columns: ParsedAdCsv["columns"] = {};
  for (const [field, index] of Object.entries(map) as Array<[AdImportColumn, number]>) {
    columns[field] = headers[index]!;
  }

  const rows: AdCsvRow[] = [];
  const errors: ParsedAdCsv["errors"] = [];
  const names = new Set<string>();
  let skipped = 0;

  body.forEach((cells, offset) => {
    const line = headerIndex + offset + 2;
    if (cells.every((cell) => !cell?.trim())) return;
    const cell = (field: AdImportColumn) => (map[field] === undefined ? undefined : (cells[map[field]!] ?? "").trim());
    const rawDate = cell("date") ?? "";
    const campaign = cell("campaign") || null;
    // Totais do Google ("Total: Campanhas") e linhas sem data
    if (/^total/i.test(normalizeHeader(rawDate)) || (campaign && /^total/i.test(normalizeHeader(campaign))) || rawDate === "" || rawDate === "--") {
      skipped++;
      return;
    }
    const date = parseAdDate(rawDate);
    if (!date) {
      errors.push(issue(line, `data inválida "${rawDate}"`));
      return;
    }
    const rawEnd = cell("endDate");
    if (rawEnd) {
      const end = parseAdDate(rawEnd);
      if (end && end !== date) {
        errors.push(issue(line, `a linha soma vários dias (${date} a ${end}). Exporte com Detalhamento > Por tempo > Dia`));
        return;
      }
    }
    const values: Record<"impressions" | "reach" | "clicks" | "results", number> = { impressions: 0, reach: 0, clicks: 0, results: 0 };
    for (const field of ["impressions", "reach", "clicks", "results"] as const) {
      const parsed = parseAdNumber(cell(field), "int");
      if (parsed === null) {
        errors.push(issue(line, `${field} inválido "${cell(field)}"`));
        return;
      }
      // Conversões do Google podem ser fracionadas: arredonda
      values[field] = Math.round(Number(parsed));
    }
    const spendText = parseAdNumber(cell("spend"), "money");
    if (spendText === null) {
      errors.push(issue(line, `investimento inválido "${cell("spend")}"`));
      return;
    }
    if (campaign) names.add(campaign);
    rows.push({
      line,
      campaign,
      date,
      ...values,
      spend: new Prisma.Decimal(spendText).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    });
  });

  return {
    format: detectFormat(headers),
    columns,
    campaignNames: [...names].sort((a, b) => a.localeCompare(b, "pt-BR")),
    rows,
    skipped,
    errors,
  };
}
