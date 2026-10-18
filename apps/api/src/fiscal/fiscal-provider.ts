import { createHash } from "node:crypto";

/**
 * Provedor fiscal (Fase 3) — a emissão é feita por INTEGRADORA autorizada
 * (NFE.io, Focus NFe, Spedy…), nunca por emissor próprio (regra do roteiro).
 * Cada integradora real implementa esta interface; a escolha é do
 * proprietário e exige conta + homologação (docs/akylla/FISCAL.md).
 */

export type FiscalType = "NFE" | "NFCE" | "NFSE";

export interface EmitInput {
  documentId: string;
  type: FiscalType;
  environment: "HOMOLOGATION" | "PRODUCTION";
  number: number;
  series: number;
  issuerCnpj: string;
  amount: string;
  issuedAt: Date;
  customer: { name: string | null; cpf: string | null } | null;
  items: Array<{ description: string; quantity: string; unitPrice: string; total: string }>;
}

export interface EmitResult {
  status: "AUTHORIZED" | "PENDING" | "REJECTED";
  gatewayDocumentId: string;
  accessKey?: string;
  protocol?: string;
  xml?: string;
  danfeUrl?: string;
  rejectionReason?: string;
}

export interface CancelResult {
  status: "CANCELLED" | "REJECTED";
  protocol?: string;
  rejectionReason?: string;
}

export interface FiscalProvider {
  readonly name: string;
  emit(input: EmitInput): Promise<EmitResult>;
  cancel(gatewayDocumentId: string, reason: string): Promise<CancelResult>;
}

// ---------------------------------------------------------------- simulado

/** Dígito verificador módulo 11 da chave de acesso (pesos 2..9 da direita). */
export function accessKeyCheckDigit(key43: string): number {
  let weight = 2;
  let sum = 0;
  for (let i = key43.length - 1; i >= 0; i -= 1) {
    sum += Number(key43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/**
 * Chave de 44 dígitos no layout oficial: cUF(2) AAMM(4) CNPJ(14) modelo(2)
 * série(3) número(9) tpEmis(1) código(8) DV(1). cUF fixo 35 (SP) no simulado.
 */
export function buildAccessKey(input: EmitInput): string {
  const yymm = `${String(input.issuedAt.getUTCFullYear()).slice(2)}${String(input.issuedAt.getUTCMonth() + 1).padStart(2, "0")}`;
  const model = input.type === "NFCE" ? "65" : "55";
  const code = String(parseInt(createHash("sha256").update(input.documentId).digest("hex").slice(0, 8), 16) % 1e8).padStart(8, "0");
  const key43 = `35${yymm}${input.issuerCnpj}${model}${String(input.series).padStart(3, "0")}${String(input.number).padStart(9, "0")}1${code}`;
  return `${key43}${accessKeyCheckDigit(key43)}`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function simulatedXml(input: EmitInput, accessKey: string | undefined, protocol: string): string {
  const items = input.items
    .map((i, n) => `    <det nItem="${n + 1}"><xProd>${escapeXml(i.description)}</xProd><qCom>${i.quantity}</qCom><vUnCom>${i.unitPrice}</vUnCom><vProd>${i.total}</vProd></det>`)
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- DOCUMENTO SIMULADO (provedor mock) — SEM VALOR FISCAL -->`,
    `<documentoSimulado tipo="${input.type}" ambiente="${input.environment}">`,
    accessKey ? `  <chave>${accessKey}</chave>` : `  <codigoVerificacao>${protocol.slice(-8)}</codigoVerificacao>`,
    `  <numero>${input.number}</numero><serie>${input.series}</serie>`,
    `  <emitente><CNPJ>${input.issuerCnpj}</CNPJ></emitente>`,
    input.customer ? `  <destinatario><xNome>${escapeXml(input.customer.name ?? "")}</xNome>${input.customer.cpf ? `<CPF>${input.customer.cpf}</CPF>` : ""}</destinatario>` : "",
    items,
    `  <total><vNF>${input.amount}</vNF></total>`,
    `  <protocolo>${protocol}</protocolo>`,
    `</documentoSimulado>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Emissora simulada, determinística (testes, demonstração e treino):
 * - `authorize` → autoriza na hora (chave + XML simulado);
 * - `async` → fica PENDING até o webhook (fluxo das integradoras reais);
 * - `reject` → rejeita (testar o tratamento de rejeição).
 */
export class MockFiscalProvider implements FiscalProvider {
  constructor(
    readonly name: string,
    private readonly mode: "authorize" | "async" | "reject",
  ) {}

  async emit(input: EmitInput): Promise<EmitResult> {
    const gatewayDocumentId = `mock_${input.documentId}`;
    if (this.mode === "reject") {
      return { status: "REJECTED", gatewayDocumentId, rejectionReason: "Rejeição simulada: 999 - Ambiente de testes (mock-reject)" };
    }
    if (this.mode === "async") return { status: "PENDING", gatewayDocumentId };
    const protocol = `1${String(input.number).padStart(14, "0")}`;
    const accessKey = input.type === "NFSE" ? undefined : buildAccessKey(input);
    return { status: "AUTHORIZED", gatewayDocumentId, accessKey, protocol, xml: simulatedXml(input, accessKey, protocol) };
  }

  async cancel(): Promise<CancelResult> {
    if (this.mode === "reject") return { status: "REJECTED", rejectionReason: "Cancelamento rejeitado (mock-reject)" };
    return { status: "CANCELLED", protocol: `2${Date.now()}` };
  }
}

/** Integradora configurada mas ainda não implementada → erro explícito. */
export class UnavailableFiscalProvider implements FiscalProvider {
  constructor(readonly name: string) {}

  async emit(): Promise<EmitResult> {
    throw new Error(`Integradora "${this.name}" ainda não está integrada. Use "mock" para testes ou contrate a integração.`);
  }

  async cancel(): Promise<CancelResult> {
    throw new Error(`Integradora "${this.name}" ainda não está integrada.`);
  }
}

export function createFiscalProvider(name: string): FiscalProvider {
  switch (name) {
    case "mock":
      return new MockFiscalProvider(name, "authorize");
    case "mock-async":
      return new MockFiscalProvider(name, "async");
    case "mock-reject":
      return new MockFiscalProvider(name, "reject");
    default:
      return new UnavailableFiscalProvider(name);
  }
}

export function isSimulatedProvider(name: string): boolean {
  return name === "mock" || name === "mock-async" || name === "mock-reject";
}
