import { z } from "zod";

export const APP_NAME = "Akylla Gestão";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  error: z.string().optional(),
  timestamp: z.string(),
  path: z.string().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const userRoleSchema = z.enum(["ADMIN", "MEMBER"]);
export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const companyStatusSchema = z.enum(["ACTIVE", "INACTIVE", "PENDING_VERIFICATION"]);

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export const emailFieldSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email inválido");

export const loginSchema = z.object({
  email: emailFieldSchema,
  password: z.string().min(1, "Senha é obrigatória").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const passwordFieldSchema = z
  .string()
  .min(8, "Senha deve ter ao menos 8 caracteres")
  .max(72, "Senha deve ter no máximo 72 caracteres");

export const resetPasswordSchema = z.object({
  email: emailFieldSchema,
  password: passwordFieldSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ---------------------------------------------------------------------------
// N4 — redefinição de senha com token de e-mail (1.5)
// ---------------------------------------------------------------------------

/** Validade do token de redefinição: 1 hora. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const requestPasswordResetSchema = z.object({
  email: emailFieldSchema,
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const confirmPasswordResetSchema = z.object({
  token: z.string().trim().min(16, "Token inválido").max(128, "Token inválido"),
  password: passwordFieldSchema,
});

export type ConfirmPasswordResetInput = z.infer<typeof confirmPasswordResetSchema>;

// ---------------------------------------------------------------------------
// N4 — segundo fator TOTP para ADMIN (1.7)
// ---------------------------------------------------------------------------

export const totpTokenSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Código deve ter 6 dígitos");

export const enableTwoFactorSchema = z.object({
  token: totpTokenSchema,
});

export type EnableTwoFactorInput = z.infer<typeof enableTwoFactorSchema>;

export const verifyTwoFactorSchema = z.object({
  challengeId: z.string().trim().min(8, "Desafio inválido").max(64, "Desafio inválido"),
  token: totpTokenSchema,
});

export type VerifyTwoFactorInput = z.infer<typeof verifyTwoFactorSchema>;

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, "Senha é obrigatória").max(200),
});

export type DisableTwoFactorInput = z.infer<typeof disableTwoFactorSchema>;

/** Auditoria (bloco 6): gerar/trocar o segredo do 2FA exige a senha atual. */
export const setupTwoFactorSchema = z.object({
  password: z.string().min(1, "Senha é obrigatória").max(200),
});
export type SetupTwoFactorInput = z.infer<typeof setupTwoFactorSchema>;

export const twoFactorSetupSchema = z.object({
  secret: z.string(),
  otpauthUrl: z.string(),
});

export type TwoFactorSetupDto = z.infer<typeof twoFactorSetupSchema>;

export const registerSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, "Nome da empresa deve ter ao menos 2 caracteres")
    .max(120),
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120),
  email: emailFieldSchema,
  password: passwordFieldSchema,
  acceptTerms: z
    .boolean()
    .refine((value) => value === true, "É necessário aceitar os Termos de Uso e a Política de Privacidade"),
  termsVersion: z.string().trim().min(1, "Versão dos termos é obrigatória").max(60).default("1.0"),
  // Fase 1 · 1D: token do Cloudflare Turnstile (exigido só quando o servidor
  // tem TURNSTILE_SECRET_KEY)
  captchaToken: z.string().trim().max(4096).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Fase 1 · 1D — verificação de e-mail do cadastro aberto
// ---------------------------------------------------------------------------

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(16, "Token inválido").max(128, "Token inválido"),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: emailFieldSchema,
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

/** Resposta do cadastro: a conta só é ativada após confirmar o e-mail. */
export interface RegisterPendingResponse {
  status: "PENDING_VERIFICATION";
  email: string;
}

/** Código do 403 de login para conta com e-mail ainda não confirmado. */
export const EMAIL_NOT_VERIFIED_CODE = "EMAIL_NOT_VERIFIED";

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120),
  email: emailFieldSchema,
  password: passwordFieldSchema,
  role: userRoleSchema.default("MEMBER"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserStatusSchema = z.object({
  status: userStatusSchema,
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export interface SessionUserDto {
  id: string;
  name: string;
  email: string;
  role: z.infer<typeof userRoleSchema>;
  status: z.infer<typeof userStatusSchema>;
  /** Fase 8: dono da plataforma (acesso a /plataforma) */
  isPlatformAdmin?: boolean;
  /** 2FA ativo (admins) */
  twoFactorEnabled?: boolean;
}

export interface SessionCompanyDto {
  id: string;
  name: string;
  slug: string;
  /** Fase 7: CNPJ/CPF (só dígitos), telefone e endereço para o comprovante */
  document?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface MeResponse {
  user: SessionUserDto;
  company: SessionCompanyDto;
}

// ---------------------------------------------------------------------------
// Etapa 2 — catálogo, estoque e movimentações
// ---------------------------------------------------------------------------

export const recordStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type RecordStatus = z.infer<typeof recordStatusSchema>;

export const productUnitSchema = z.enum([
  "UNIDADE",
  "KG",
  "G",
  "L",
  "ML",
  "CAIXA",
  "PACOTE",
  "ROLLO",
]);
export type ProductUnit = z.infer<typeof productUnitSchema>;

export const stockMovementTypeSchema = z.enum([
  "IN",
  "OUT",
  "ADJUST_POSITIVE",
  "ADJUST_NEGATIVE",
]);
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;

export const productUnitLabels: Record<ProductUnit, string> = {
  UNIDADE: "unidade",
  KG: "kg",
  G: "g",
  L: "l",
  ML: "ml",
  CAIXA: "caixa",
  PACOTE: "pacote",
  ROLLO: "rolo",
};

export const stockMovementTypeLabels: Record<StockMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
  ADJUST_POSITIVE: "Ajuste positivo",
  ADJUST_NEGATIVE: "Ajuste negativo",
};

/**
 * Normaliza número digitado no padrão brasileiro para o formato da API
 * ("1234.56"): aceita "150,00", "1.234,56", "R$ 12,50" e também "150.00".
 * Com vírgula, os pontos são separadores de milhar; sem vírgula, o ponto é
 * o separador decimal (ex.: "1.5" kg).
 */
export function normalizeDecimalInput(value: string | number): string {
  if (typeof value === "number") return String(value);
  let text = value.trim().replace(/^R\$\s*/i, "").replace(/\s+/g, "");
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  return text;
}

/** Valor digitado → número (NaN se inválido). Uso na web. */
export function parseDecimalInput(value: string | number): number {
  const text = normalizeDecimalInput(value);
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
}

function decimalField(places: number, minInclusive: number) {
  return z
    .union([z.number(), z.string()])
    .transform((value) => normalizeDecimalInput(value))
    .refine(
      (value) =>
        new RegExp(`^\\d+(\\.\\d{1,${places}})?$`).test(value) &&
        Number(value) >= minInclusive,
      minInclusive > 0
        ? `Valor deve ser maior que ${minInclusive} (até ${places} decimais)`
        : `Valor inválido ou negativo (até ${places} decimais)`,
    );
}

export const priceFieldSchema = decimalField(2, 0);
export const quantityFieldSchema = decimalField(3, 0);
export const positiveQuantityFieldSchema = decimalField(3, 0).refine(
  (value) => Number(value) > 0,
  "Quantidade deve ser maior que zero",
);

const nameField = z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .nullable();

export const createCategorySchema = z.object({
  name: nameField,
  description: optionalText(500),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const updateRecordStatusSchema = z.object({ status: recordStatusSchema });
export type UpdateRecordStatusInput = z.infer<typeof updateRecordStatusSchema>;

export const createSupplierSchema = z.object({
  name: nameField,
  document: optionalText(20),
  email: emailFieldSchema.optional().nullable(),
  phone: optionalText(30),
  notes: optionalText(500),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const skuFieldSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => value.length === 0 || value.length <= 60, "SKU deve ter no máximo 60 caracteres");

export const createProductSchema = z.object({
  name: nameField,
  description: optionalText(1000),
  sku: skuFieldSchema.optional().nullable(),
  barcode: z
    .string()
    .trim()
    .max(80, "Código de barras deve ter no máximo 80 caracteres")
    .optional()
    .nullable(),
  unit: productUnitSchema.default("UNIDADE"),
  costPrice: priceFieldSchema.default("0"),
  salePrice: priceFieldSchema.default("0"),
  minimumStock: quantityFieldSchema.default("0"),
  categoryId: z.string().trim().min(1).max(60).optional().nullable(),
  supplierId: z.string().trim().min(1).max(60).optional().nullable(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const listProductsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().trim().max(60).optional(),
  supplierId: z.string().trim().max(60).optional(),
  status: recordStatusSchema.optional(),
  lowStock: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => value === true || value === "true")
    .optional(),
  orderBy: z.enum(["name", "createdAt", "stockQuantity"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const listCatalogQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: recordStatusSchema.optional(),
});
export type ListCatalogQuery = z.infer<typeof listCatalogQuerySchema>;

export const createStockMovementSchema = z.object({
  productId: z.string().trim().min(1, "Produto é obrigatório").max(60),
  quantity: positiveQuantityFieldSchema,
  notes: optionalText(500),
  reference: optionalText(120),
});
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

export const createStockAdjustmentSchema = z.object({
  productId: z.string().trim().min(1, "Produto é obrigatório").max(60),
  type: z.enum(["ADJUST_POSITIVE", "ADJUST_NEGATIVE"]),
  quantity: positiveQuantityFieldSchema,
  reason: z
    .string()
    .trim()
    .min(3, "Justificativa é obrigatória para ajustes")
    .max(500, "Justificativa deve ter no máximo 500 caracteres"),
});
export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>;

export const listMovementsQuerySchema = paginationQuerySchema.extend({
  productId: z.string().trim().max(60).optional(),
  type: stockMovementTypeSchema.optional(),
});
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;

// ---------------------------------------------------------------------------
// Etapa 3 — vendas e PDV
// ---------------------------------------------------------------------------

export const paymentMethodSchema = z.enum(["CASH", "CARD", "PIX", "OTHER", "CREDIARIO"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const saleStatusSchema = z.enum(["COMPLETED", "CANCELLED"]);
export type SaleStatus = z.infer<typeof saleStatusSchema>;

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  CARD: "Cartão",
  PIX: "Pix",
  OTHER: "Outro",
  CREDIARIO: "Crediário",
};

export const saleStatusLabels: Record<SaleStatus, string> = {
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

/**
 * Auditoria (bloco 7): unidades vendidas a granel aceitam quantidade
 * fracionada (até 3 casas: 1,250 kg); as demais só quantidade inteira.
 */
export const FRACTIONAL_UNITS = ["KG", "L"] as const;
export function isFractionalUnit(unit: string): boolean {
  return (FRACTIONAL_UNITS as readonly string[]).includes(unit);
}

export const createSaleItemSchema = z.object({
  productId: z.string().trim().min(1, "Produto é obrigatório").max(60),
  quantity: positiveQuantityFieldSchema,
});
export type CreateSaleItemInput = z.infer<typeof createSaleItemSchema>;

/** Fase 2 · 2.2 — limites do parcelamento no crediário. */
export const CREDIT_MAX_INSTALLMENTS = 24;

const isoDateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD");

/**
 * Venda no crediário: o cliente informa SÓ a quantidade de parcelas e o 1º
 * vencimento; valores e datas são calculados pelo servidor (autoridade do
 * servidor — o total nunca vem do cliente).
 */
export const saleCreditSchema = z.object({
  installments: z.coerce
    .number()
    .int("Quantidade de parcelas inválida")
    .min(1, "Mínimo de 1 parcela")
    .max(CREDIT_MAX_INSTALLMENTS, `Máximo de ${CREDIT_MAX_INSTALLMENTS} parcelas`),
  firstDueDate: isoDateField,
});
export type SaleCreditInput = z.infer<typeof saleCreditSchema>;

export const createSaleSchema = z.object({
  items: z
    .array(createSaleItemSchema)
    .min(1, "Informe ao menos um produto")
    .max(100, "Venda pode ter no máximo 100 itens distintos"),
  discount: priceFieldSchema.default("0"),
  paymentMethod: paymentMethodSchema,
  paymentNote: optionalText(300),
  clientId: z.string().trim().min(1, "Cliente inválido").max(60).optional().nullable(),
  // Fase 2 · 2.1: profissional/vendedor da venda (base da comissão)
  professionalId: z.string().trim().min(1, "Profissional inválido").max(60).optional().nullable(),
  // Fase 2 · 2.2: obrigatório com paymentMethod CREDIARIO
  credit: saleCreditSchema.optional().nullable(),
  clientRequestId: z
    .string()
    .trim()
    .min(8, "Identificador de requisição inválido")
    .max(64, "Identificador de requisição inválido")
    .optional(),
}).superRefine((value, ctx) => {
  if (value.paymentMethod === "CREDIARIO") {
    if (!value.clientId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clientId"], message: "Venda no crediário exige cliente" });
    }
    if (!value.credit) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["credit"], message: "Informe as parcelas do crediário" });
    }
  } else if (value.credit) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["credit"], message: "Parcelas só valem para pagamento no crediário" });
  }
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const cancelSaleSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório para cancelamento")
    .max(500, "Motivo deve ter no máximo 500 caracteres"),
});
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;

const dateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD");

export const listSalesQuerySchema = paginationQuerySchema.extend({
  status: saleStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
  from: dateField.optional(),
  to: dateField.optional(),
});
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;

// ---------------------------------------------------------------------------
// Etapa 4 — caixa e financeiro
// ---------------------------------------------------------------------------

export const cashSessionStatusSchema = z.enum(["OPEN", "CLOSED"]);
export type CashSessionStatus = z.infer<typeof cashSessionStatusSchema>;

export const cashMovementTypeSchema = z.enum(["IN", "OUT"]);
export type CashMovementType = z.infer<typeof cashMovementTypeSchema>;

export const cashMovementOriginSchema = z.enum([
  "MANUAL",
  "SALE",
  "SALE_CANCELMENT",
  "REVERSAL",
  "ACCOUNT",
]);
export type CashMovementOrigin = z.infer<typeof cashMovementOriginSchema>;

export const cashSessionStatusLabels: Record<CashSessionStatus, string> = {
  OPEN: "Aberto",
  CLOSED: "Fechado",
};

export const cashMovementTypeLabels: Record<CashMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
};

export const cashMovementOriginLabels: Record<CashMovementOrigin, string> = {
  MANUAL: "Manual",
  SALE: "Venda",
  SALE_CANCELMENT: "Cancelamento",
  REVERSAL: "Estorno",
  ACCOUNT: "Liquidação de título",
};

export const positivePriceFieldSchema = priceFieldSchema.refine(
  (value) => Number(value) > 0,
  "Valor deve ser maior que zero",
);

export const openCashSessionSchema = z.object({
  initialAmount: priceFieldSchema,
  notes: optionalText(500),
});
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;

export const closeCashSessionSchema = z.object({
  countedAmount: priceFieldSchema,
  notes: optionalText(500),
});
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;

// ---------------------------------------------------------------------------
// Financeiro básico — contas a pagar e a receber (Etapa 8)
// ---------------------------------------------------------------------------

export const financialDirectionSchema = z.enum(["PAYABLE", "RECEIVABLE"]);
export type FinancialDirection = z.infer<typeof financialDirectionSchema>;

export const financialStatusSchema = z.enum(["OPEN", "PAID", "CANCELLED"]);
export type FinancialStatus = z.infer<typeof financialStatusSchema>;

export const financialDirectionLabels: Record<FinancialDirection, string> = {
  PAYABLE: "A pagar",
  RECEIVABLE: "A receber",
};

export const financialStatusLabels: Record<FinancialStatus, string> = {
  OPEN: "Em aberto",
  PAID: "Liquidado",
  CANCELLED: "Cancelado",
};

export const createFinancialEntrySchema = z.object({
  direction: financialDirectionSchema,
  description: z
    .string()
    .trim()
    .min(2, "Descrição deve ter ao menos 2 caracteres")
    .max(200, "Descrição deve ter no máximo 200 caracteres"),
  amount: positivePriceFieldSchema,
  dueDate: dateField,
  clientId: z.string().trim().min(1).max(60).optional().nullable(),
  supplierId: z.string().trim().min(1).max(60).optional().nullable(),
  categoryId: z.string().trim().min(1).max(60).optional().nullable(),
  clientRequestId: z.string().trim().min(8, "Identificador de requisição inválido").max(64).optional(),
});
export type CreateFinancialEntryInput = z.infer<typeof createFinancialEntrySchema>;

/**
 * Auditoria (bloco 3): forma da liquidação. Só DINHEIRO mexe na gaveta do
 * caixa (inCash); Pix, cartão, boleto e transferência ficam registrados no
 * caixa, mas fora do saldo esperado da gaveta.
 */
export const settlementMethodSchema = z.enum(["CASH", "PIX", "CARD", "BOLETO", "TRANSFER", "OTHER"]);
export type SettlementMethod = z.infer<typeof settlementMethodSchema>;
export const settlementMethodLabels: Record<SettlementMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CARD: "Cartão",
  BOLETO: "Boleto",
  TRANSFER: "Transferência",
  OTHER: "Outro",
};
export const payFinancialEntrySchema = z
  .object({ paymentMethod: settlementMethodSchema.default("CASH") })
  .default({ paymentMethod: "CASH" });
export type PayFinancialEntryInput = z.infer<typeof payFinancialEntrySchema>;

export const updateFinancialEntrySchema = createFinancialEntrySchema
  .omit({ direction: true, clientRequestId: true })
  .partial();
export type UpdateFinancialEntryInput = z.infer<typeof updateFinancialEntrySchema>;

export const financialReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório")
    .max(500, "Motivo deve ter no máximo 500 caracteres"),
});
export type FinancialReasonInput = z.infer<typeof financialReasonSchema>;

export const listFinancialQuerySchema = paginationQuerySchema.extend({
  direction: financialDirectionSchema.optional(),
  status: financialStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
  from: dateField.optional(),
  to: dateField.optional(),
});
export type ListFinancialQuery = z.infer<typeof listFinancialQuerySchema>;

export const financialSummaryQuerySchema = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
});
export type FinancialSummaryQuery = z.infer<typeof financialSummaryQuerySchema>;

export const createCashMovementSchema = z
  .object({
    type: cashMovementTypeSchema,
    amount: positivePriceFieldSchema,
    description: z
      .string()
      .trim()
      .min(2, "Descrição deve ter ao menos 2 caracteres")
      .max(300, "Descrição deve ter no máximo 300 caracteres"),
    justification: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.type === "OUT" && !value.justification) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["justification"],
        message: "Justificativa é obrigatória para saídas",
      });
    }
  });
export type CreateCashMovementInput = z.infer<typeof createCashMovementSchema>;

export const reversalCashMovementSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório para estorno")
    .max(500, "Motivo deve ter no máximo 500 caracteres"),
});
export type ReversalCashMovementInput = z.infer<typeof reversalCashMovementSchema>;

export const listCashMovementsQuerySchema = paginationQuerySchema.extend({
  from: dateField.optional(),
  to: dateField.optional(),
  sessionId: z.string().trim().max(60).optional(),
  type: cashMovementTypeSchema.optional(),
  origin: cashMovementOriginSchema.optional(),
});
export type ListCashMovementsQuery = z.infer<typeof listCashMovementsQuerySchema>;

export const cashSummaryQuerySchema = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
  sessionId: z.string().trim().max(60).optional(),
});
export type CashSummaryQuery = z.infer<typeof cashSummaryQuerySchema>;

// ---------------------------------------------------------------------------
// Etapa 5 — clientes e serviços
// ---------------------------------------------------------------------------

export function normalizePhone(value: string): string {
  return value.replace(/\D+/g, "");
}

const phoneField = z
  .string()
  .trim()
  .max(30, "Telefone deve ter no máximo 30 caracteres")
  .transform((value) => normalizePhone(value))
  .refine(
    (value) => value.length === 0 || (value.length >= 8 && value.length <= 15),
    "Telefone deve ter de 8 a 15 dígitos",
  );

const cpfField = z
  .string()
  .trim()
  .max(20, "CPF deve ter no máximo 20 caracteres")
  .transform((value) => value.replace(/\D+/g, ""))
  .refine((value) => value.length === 0 || value.length === 11, "CPF deve ter 11 dígitos");

export const createClientSchema = z.object({
  name: nameField,
  phone: phoneField.optional().nullable(),
  mobile: phoneField.optional().nullable(),
  email: emailFieldSchema.optional().nullable(),
  cpf: cpfField.optional().nullable(),
  street: optionalText(120),
  number: optionalText(20),
  complement: optionalText(80),
  district: optionalText(80),
  city: optionalText(80),
  state: optionalText(40),
  zip: optionalText(12),
  notes: optionalText(500),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial();
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

/** 2026-10-27: situação de cobrança (detalhes mais abaixo). */
export const billingStateSchema = z.enum(["EM_DIA", "VENCE_EM", "VENCIDO", "EM_DEBITO", "EM_ACORDO", "PAUSADO", "INATIVO"]);
export type BillingState = z.infer<typeof billingStateSchema>;

export const listClientsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: recordStatusSchema.optional(),
  /** 2026-10-27: filtra pela situação de cobrança (pior contrato do cliente) */
  billingState: billingStateSchema.optional(),
  orderBy: z.enum(["name", "createdAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;

export const createServiceSchema = z.object({
  name: nameField,
  description: optionalText(1000),
  durationMinutes: z.coerce
    .number()
    .int("Duração deve ser um número inteiro de minutos")
    .min(1, "Duração mínima de 1 minuto")
    .max(1440, "Duração máxima de 1440 minutos (24h)")
    .optional()
    .nullable(),
  price: priceFieldSchema,
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const listServicesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: recordStatusSchema.optional(),
  orderBy: z.enum(["name", "price", "createdAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;

// ---------------------------------------------------------------------------
// Etapa 6 — integração com WhatsApp
// ---------------------------------------------------------------------------

export const whatsappConfigStatusSchema = z.enum([
  "NOT_CONFIGURED",
  "CONFIGURED",
  "ACTIVE",
  "ERROR",
  "DISCONNECTED",
]);
export type WhatsAppConfigStatus = z.infer<typeof whatsappConfigStatusSchema>;

export const whatsappConfigStatusLabels: Record<WhatsAppConfigStatus, string> = {
  NOT_CONFIGURED: "Não configurado",
  CONFIGURED: "Configurado",
  ACTIVE: "Ativo",
  ERROR: "Erro",
  DISCONNECTED: "Desconectado",
};

export const updateWhatsAppConfigSchema = z.object({
  phoneNumberId: z.string().trim().max(60).optional().nullable(),
  wabaId: z.string().trim().max(60).optional().nullable(),
  displayName: optionalText(120),
  reminderTemplateId: z.string().trim().max(60).optional().nullable(),
  reminderLeadMinutes: z.coerce
    .number()
    .int("Antecedência deve ser um número inteiro de minutos")
    .min(5, "Antecedência mínima de 5 minutos")
    .max(40320, "Antecedência máxima de 28 dias (40320 minutos)")
    .optional(),
});
export type UpdateWhatsAppConfigInput = z.infer<typeof updateWhatsAppConfigSchema>;

export const updateWhatsAppConfigStatusSchema = z.object({
  status: z.enum(["CONFIGURED", "DISCONNECTED"]),
});
export type UpdateWhatsAppConfigStatusInput = z.infer<
  typeof updateWhatsAppConfigStatusSchema
>;

export const whatsappTemplateCategorySchema = z.enum([
  "UTILITY",
  "MARKETING",
  "AUTHENTICATION",
]);
export type WhatsAppTemplateCategory = z.infer<typeof whatsappTemplateCategorySchema>;

export const whatsappTemplateApprovalSchema = z.enum([
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
]);
export type WhatsAppTemplateApproval = z.infer<typeof whatsappTemplateApprovalSchema>;

export const whatsappTemplateApprovalLabels: Record<WhatsAppTemplateApproval, string> = {
  PENDING_APPROVAL: "Aguardando aprovação",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

export const whatsappTemplateCategoryLabels: Record<WhatsAppTemplateCategory, string> = {
  UTILITY: "Utilidade",
  MARKETING: "Marketing",
  AUTHENTICATION: "Autenticação",
};

const whatsappTemplateNameSchema = z
  .string()
  .trim()
  .min(3, "Nome do template deve ter ao menos 3 caracteres")
  .max(64, "Nome do template deve ter no máximo 64 caracteres")
  .regex(
    /^[a-z0-9_]+$/,
    "Nome do template deve conter apenas minúsculas, números e sublinhado",
  );

const whatsappLanguageSchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2}([_-][A-Z]{2})?$/, "Idioma inválido (ex.: pt_BR, en_US)");

/** Conta as variáveis {{1}}, {{2}}... exigidas pelo corpo do template. */
export function templateVariableCount(body: string): number {
  const matches = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));
  if (matches.length === 0) return 0;
  return Math.max(...matches);
}

function checkTemplateBody(body: string, ctx: z.RefinementCtx) {
  const numbers = [...body.matchAll(/\{\{(\d+)\}\}/g)]
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
  const unique = [...new Set(numbers)];
  const contiguous = unique.every((value, index) => value === index + 1);
  if (!contiguous) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["body"],
      message: "Variáveis devem ser {{1}}, {{2}}... sequenciais",
    });
  }
}

const whatsappTemplateBodySchema = z
  .string()
  .trim()
  .min(1, "Corpo do template é obrigatório")
  .max(1024, "Corpo do template deve ter no máximo 1024 caracteres")
  .superRefine(checkTemplateBody);

export const createWhatsAppTemplateSchema = z.object({
  name: whatsappTemplateNameSchema,
  language: whatsappLanguageSchema.default("pt_BR"),
  category: whatsappTemplateCategorySchema.default("UTILITY"),
  body: whatsappTemplateBodySchema,
  providerReference: optionalText(120),
});
export type CreateWhatsAppTemplateInput = z.infer<typeof createWhatsAppTemplateSchema>;

export const updateWhatsAppTemplateSchema = createWhatsAppTemplateSchema
  .partial()
  .extend({
    approval: whatsappTemplateApprovalSchema.optional(),
    status: recordStatusSchema.optional(),
  });
export type UpdateWhatsAppTemplateInput = z.infer<typeof updateWhatsAppTemplateSchema>;

export const listWhatsAppTemplatesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: recordStatusSchema.optional(),
  approval: whatsappTemplateApprovalSchema.optional(),
  orderBy: z.enum(["name", "createdAt"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
export type ListWhatsAppTemplatesQuery = z.infer<typeof listWhatsAppTemplatesQuerySchema>;

export const whatsappConsentStatusSchema = z.enum(["OPTED_IN", "OPTED_OUT"]);
export type WhatsAppConsentStatus = z.infer<typeof whatsappConsentStatusSchema>;

export const whatsappConsentSourceSchema = z.enum(["MANUAL", "REPLY", "IMPORT"]);
export type WhatsAppConsentSource = z.infer<typeof whatsappConsentSourceSchema>;

export const whatsappConsentStatusLabels: Record<WhatsAppConsentStatus, string> = {
  OPTED_IN: "Com consentimento",
  OPTED_OUT: "Descadastrado",
};

export const whatsappConsentSourceLabels: Record<WhatsAppConsentSource, string> = {
  MANUAL: "Registro manual",
  REPLY: "Resposta no WhatsApp",
  IMPORT: "Importação",
};

export const upsertWhatsAppConsentSchema = z.object({
  status: whatsappConsentStatusSchema,
  source: whatsappConsentSourceSchema.default("MANUAL"),
  notes: optionalText(500),
});
export type UpsertWhatsAppConsentInput = z.infer<typeof upsertWhatsAppConsentSchema>;

export const listWhatsAppConsentsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: whatsappConsentStatusSchema.optional(),
  clientId: z.string().trim().max(60).optional(),
});
export type ListWhatsAppConsentsQuery = z.infer<typeof listWhatsAppConsentsQuerySchema>;

export const whatsappMessageStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "ACCEPTED",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "CANCELLED",
]);
export type WhatsAppMessageStatus = z.infer<typeof whatsappMessageStatusSchema>;

export const whatsappMessageStatusLabels: Record<WhatsAppMessageStatus, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  ACCEPTED: "Aceita pelo provedor",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Lida",
  FAILED: "Falha",
  CANCELLED: "Cancelada",
};

export const whatsappMessageOriginSchema = z.enum(["MANUAL", "SERVICE_REMINDER", "SERVICE_ORDER"]);
export type WhatsAppMessageOrigin = z.infer<typeof whatsappMessageOriginSchema>;

export const createWhatsAppMessageSchema = z.object({
  clientId: z.string().trim().min(1, "Cliente é obrigatório").max(60),
  templateId: z.string().trim().min(1, "Template é obrigatório").max(60),
  variables: z
    .array(z.string().trim().max(1024, "Variável deve ter no máximo 1024 caracteres"))
    .max(10, "Máximo de 10 variáveis")
    .default([]),
  idempotencyKey: z.string().trim().min(6).max(64).optional(),
  // Fase 2 · 2.3: vincula a mensagem a uma OS do mesmo cliente (histórico)
  serviceOrderId: z.string().trim().min(1).max(60).optional(),
});
export type CreateWhatsAppMessageInput = z.infer<typeof createWhatsAppMessageSchema>;

export const listWhatsAppMessagesQuerySchema = paginationQuerySchema.extend({
  from: dateField.optional(),
  to: dateField.optional(),
  status: whatsappMessageStatusSchema.optional(),
  origin: whatsappMessageOriginSchema.optional(),
  clientId: z.string().trim().max(60).optional(),
  templateId: z.string().trim().max(60).optional(),
  search: z.string().trim().max(40).optional(),
});
export type ListWhatsAppMessagesQuery = z.infer<typeof listWhatsAppMessagesQuerySchema>;

export const cancelWhatsAppMessageSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório para cancelamento")
    .max(300, "Motivo deve ter no máximo 300 caracteres"),
});
export type CancelWhatsAppMessageInput = z.infer<typeof cancelWhatsAppMessageSchema>;

// ---------------------------------------------------------------------------
// Etapa 7 — dashboard e relatórios
// ---------------------------------------------------------------------------

export const REPORT_TIMEZONE = "UTC" as const;
export const REPORT_MAX_RANGE_DAYS = 366;
export const REPORT_DEFAULT_RANGE_DAYS = 30;
export const REPORT_CSV_MAX_ROWS = 5000;

export const reportDateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD")
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
    "Data inválida",
  );

function checkReportPeriod(
  value: { from?: string; to?: string },
  ctx: z.RefinementCtx,
): void {
  if (!value.from || !value.to) return;
  const fromMs = Date.parse(`${value.from}T00:00:00.000Z`);
  const toMs = Date.parse(`${value.to}T00:00:00.000Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return;
  if (fromMs > toMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["from"],
      message: "Data inicial não pode ser posterior à final",
    });
    return;
  }
  const days = Math.round((toMs - fromMs) / 86_400_000) + 1;
  if (days > REPORT_MAX_RANGE_DAYS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["from"],
      message: `Intervalo máximo é de ${REPORT_MAX_RANGE_DAYS} dias`,
    });
  }
}

const reportPeriodBase = z.object({
  from: reportDateField.optional(),
  to: reportDateField.optional(),
});

export const dashboardSummaryQuerySchema = reportPeriodBase.superRefine(checkReportPeriod);
export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;

export const reportFormatSchema = z.enum(["json", "csv"]).default("json");
export type ReportFormat = z.infer<typeof reportFormatSchema>;

export const salesReportQuerySchema = reportPeriodBase
  .extend(paginationQuerySchema.shape)
  .extend({
    status: saleStatusSchema.optional(),
    paymentMethod: paymentMethodSchema.optional(),
    format: reportFormatSchema,
  })
  .superRefine(checkReportPeriod);
export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;

export const stockAlertsReportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  format: reportFormatSchema,
});
export type StockAlertsReportQuery = z.infer<typeof stockAlertsReportQuerySchema>;

export const stockMovementsReportQuerySchema = reportPeriodBase
  .extend(paginationQuerySchema.shape)
  .extend({
    productId: z.string().trim().max(60).optional(),
    type: stockMovementTypeSchema.optional(),
    format: reportFormatSchema,
  })
  .superRefine(checkReportPeriod);
export type StockMovementsReportQuery = z.infer<typeof stockMovementsReportQuerySchema>;

export const cashReportQuerySchema = reportPeriodBase.superRefine(checkReportPeriod);
export type CashReportQuery = z.infer<typeof cashReportQuerySchema>;

export const clientsReportQuerySchema = reportPeriodBase.superRefine(checkReportPeriod);
export type ClientsReportQuery = z.infer<typeof clientsReportQuerySchema>;

export const whatsappReportQuerySchema = reportPeriodBase.superRefine(checkReportPeriod);
export type WhatsAppReportQuery = z.infer<typeof whatsappReportQuerySchema>;

// ---------------------------------------------------------------------------
// Etapa 8 — agendamentos
// ---------------------------------------------------------------------------

export const appointmentStatusSchema = z.enum([
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

/** Status que ocupam horário (bloqueiam conflito na empresa inteira). */
export const APPOINTMENT_BLOCKING_STATUSES: readonly AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
];

/** Status finais — nenhuma transição posterior é aceita. */
export const APPOINTMENT_TERMINAL_STATUSES: readonly AppointmentStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

/** Lembrete de agendamento exige template com exatamente 3 variáveis. */
export const APPOINTMENT_REMINDER_VARIABLE_COUNT = 3;
export const APPOINTMENT_REMINDER_LEAD_MIN = 5;
export const APPOINTMENT_REMINDER_LEAD_MAX = 40320;
export const APPOINTMENT_REMINDER_LEAD_DEFAULT = 1440;

const localDateTimeField = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    "Data e hora devem estar no formato YYYY-MM-DDTHH:mm",
  )
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(`${value}:00.000Z`)) &&
      new Date(`${value}:00.000Z`).toISOString().slice(0, 16) === value,
    "Data e hora inválidas",
  );

export const createAppointmentSchema = z.object({
  clientId: z.string().trim().min(1, "Cliente é obrigatório").max(60),
  serviceId: z.string().trim().min(1, "Serviço é obrigatório").max(60),
  startLocal: localDateTimeField,
  utcOffsetMinutes: z.coerce
    .number()
    .int("Fuso horário deve ser um número inteiro de minutos")
    .min(-840, "Fuso horário inválido (mínimo −14h)")
    .max(840, "Fuso horário inválido (máximo +14h)"),
  durationMinutes: z.coerce
    .number()
    .int("Duração deve ser um número inteiro de minutos")
    .min(1, "Duração mínima de 1 minuto")
    .max(1440, "Duração máxima de 1440 minutos (24h)"),
  notes: optionalText(1000),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = createAppointmentSchema.partial();
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW"]),
});
export type UpdateAppointmentStatusInput = z.infer<
  typeof updateAppointmentStatusSchema
>;

export const cancelAppointmentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório para cancelamento")
    .max(500, "Motivo deve ter no máximo 500 caracteres"),
});
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const listAppointmentsQuerySchema = paginationQuerySchema
  .extend({
    from: reportDateField.optional(),
    to: reportDateField.optional(),
    status: appointmentStatusSchema.optional(),
    clientId: z.string().trim().max(60).optional(),
    serviceId: z.string().trim().max(60).optional(),
    search: z.string().trim().max(120).optional(),
  })
  .superRefine(checkReportPeriod);
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;

// ---------------------------------------------------------------------------
// Etapa 9 — assinaturas e gestão comercial
// ---------------------------------------------------------------------------

export const subscriptionStatusSchema = z.enum(["ACTIVE", "EXPIRED", "CANCELLED"]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export const tenantSubscriptionStatusSchema = z.enum([
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
]);
export type TenantSubscriptionStatus = z.infer<
  typeof tenantSubscriptionStatusSchema
>;

export const tenantSubscriptionStatusLabels: Record<
  TenantSubscriptionStatus,
  string
> = {
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export const SUBSCRIPTION_MIN_DURATION_DAYS = 1;
export const SUBSCRIPTION_MAX_DURATION_DAYS = 3650;
export const TENANT_PLAN_DEFAULT_DURATION_DAYS = 30;

export const createSubscriptionPlanSchema = z.object({
  name: nameField,
  description: optionalText(1000),
  price: priceFieldSchema,
  durationDays: z.coerce
    .number()
    .int("Duração deve ser um número inteiro de dias")
    .min(SUBSCRIPTION_MIN_DURATION_DAYS, "Duração mínima de 1 dia")
    .max(SUBSCRIPTION_MAX_DURATION_DAYS, "Duração máxima de 3650 dias (10 anos)"),
});
export type CreateSubscriptionPlanInput = z.infer<
  typeof createSubscriptionPlanSchema
>;

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial();
export type UpdateSubscriptionPlanInput = z.infer<
  typeof updateSubscriptionPlanSchema
>;

export const listSubscriptionPlansQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: recordStatusSchema.optional(),
  orderBy: z.enum(["name", "price", "createdAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListSubscriptionPlansQuery = z.infer<
  typeof listSubscriptionPlansQuerySchema
>;

export const createSubscriptionSchema = z.object({
  clientId: z.string().trim().min(1, "Cliente é obrigatório").max(60),
  planId: z.string().trim().min(1, "Plano é obrigatório").max(60),
  startAt: z.string().trim().datetime({ offset: true }).optional(),
  registerPayment: z.boolean().optional(),
  /** Transformação 2026-10-23: entrega do mesmo cliente coberta pelo contrato */
  deliveryId: z.string().trim().min(1).max(60).optional(),
});
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const cancelSubscriptionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório para cancelamento")
    .max(500, "Motivo deve ter no máximo 500 caracteres"),
});
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;

export const listSubscriptionsQuerySchema = paginationQuerySchema.extend({
  status: subscriptionStatusSchema.optional(),
  clientId: z.string().trim().max(60).optional(),
  deliveryId: z.string().trim().max(60).optional(),
  search: z.string().trim().max(120).optional(),
  orderBy: z.enum(["endAt", "createdAt"]).default("endAt"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListSubscriptionsQuery = z.infer<typeof listSubscriptionsQuerySchema>;

export const updateTenantSubscriptionSchema = z.object({
  planId: z.string().trim().min(1, "Plano é obrigatório").max(60),
});
export type UpdateTenantSubscriptionInput = z.infer<
  typeof updateTenantSubscriptionSchema
>;

export const cancelTenantSubscriptionSchema = z.object({
  reason: optionalText(500),
});
export type CancelTenantSubscriptionInput = z.infer<
  typeof cancelTenantSubscriptionSchema
>;

export const createCheckoutSchema = z.object({
  planId: z.string().trim().min(1, "Plano é obrigatório").max(60),
  payerEmail: z
    .string()
    .trim()
    .min(1, "Email do pagador é obrigatório")
    .max(190)
    .email("Email do pagador inválido"),
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

// ---------------------------------------------------------------------------
// Etapa 10 — módulos por empresa (CompanyModule, decisão D3 — opção B)
// ---------------------------------------------------------------------------

/**
 * Módulos de negócio desativáveis por empresa. O núcleo (clientes,
 * produtos, vendas, caixa, financeiro, relatórios, billing) não consta:
 * nunca é desativável. (O antigo módulo PETS foi retirado do produto em
 * 2026-10-19 — migration `20261019180000_remove_pets_module`.)
 */
export const businessModuleSchema = z.enum([
  "APPOINTMENTS",
  "SERVICES",
  "WHATSAPP",
  "SUBSCRIPTIONS",
  "COMMISSIONS",
  "CREDIT",
  "SERVICE_ORDERS",
  "FISCAL",
]);
export type BusinessModule = z.infer<typeof businessModuleSchema>;

export const BUSINESS_MODULES: readonly BusinessModule[] = [
  "APPOINTMENTS",
  "SERVICES",
  "WHATSAPP",
  "SUBSCRIPTIONS",
  "COMMISSIONS",
  "CREDIT",
  "SERVICE_ORDERS",
  "FISCAL",
];

/** Valores literais para uso como identificadores (ex.: decorators). */
export const BusinessModules = {
  APPOINTMENTS: "APPOINTMENTS",
  SERVICES: "SERVICES",
  WHATSAPP: "WHATSAPP",
  SUBSCRIPTIONS: "SUBSCRIPTIONS",
  COMMISSIONS: "COMMISSIONS",
  CREDIT: "CREDIT",
  SERVICE_ORDERS: "SERVICE_ORDERS",
  FISCAL: "FISCAL",
} as const satisfies Record<BusinessModule, BusinessModule>;

export const businessModuleLabels: Record<BusinessModule, string> = {
  APPOINTMENTS: "Agendamentos",
  SERVICES: "Serviços",
  WHATSAPP: "Automação WhatsApp",
  SUBSCRIPTIONS: "Assinaturas de clientes",
  COMMISSIONS: "Comissões",
  CREDIT: "Crediário",
  SERVICE_ORDERS: "Ordens de serviço",
  FISCAL: "Nota fiscal",
};

export const companyModuleStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
export type CompanyModuleStatus = z.infer<typeof companyModuleStatusSchema>;

/** Ausência de linha = módulo ativo (padrão); linha grava o estado explícito. */
export const upsertCompanyModuleSchema = z.object({
  module: businessModuleSchema,
  status: companyModuleStatusSchema,
});
export type UpsertCompanyModuleInput = z.infer<typeof upsertCompanyModuleSchema>;

// ---------------------------------------------------------------------------
// Dados da empresa (Fase 7 · 7.1)
// ---------------------------------------------------------------------------

/** CNPJ (14) ou CPF (11): aceita máscara, grava só os dígitos. */
export const companyDocumentSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length === 11 || value.length === 14, "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)");

const optionalNullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));

export const updateCompanySchema = z
  .object({
    name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(120),
    document: z.union([companyDocumentSchema, z.literal("").transform(() => null), z.null()]),
    phone: optionalNullableText(30),
    address: optionalNullableText(200),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nada para alterar");
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const updateCompanySlugSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Use ao menos 3 caracteres")
    .max(60, "Use no máximo 60 caracteres")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use só letras minúsculas, números e hífens (sem hífen no início ou fim)"),
});
export type UpdateCompanySlugInput = z.infer<typeof updateCompanySlugSchema>;

export interface CompanyProfileDto {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  phone: string | null;
  address: string | null;
  segment: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Cobrança do SaaS e painel do dono (Fase 8)
// ---------------------------------------------------------------------------

/**
 * Situação de acesso da empresa:
 * - EXEMPT: isenta (empresa do dono, parceiros ou anterior à Fase 8)
 * - TRIAL: teste grátis
 * - ACTIVE: assinatura paga em dia
 * - GRACE: venceu há até 5 dias (aviso, tudo liberado)
 * - READ_ONLY: venceu há mais de 5 dias (consulta liberada, alterações bloqueadas)
 * - SUSPENDED: suspensa pelo dono (login bloqueado)
 */
export const accessStatusSchema = z.enum(["EXEMPT", "TRIAL", "ACTIVE", "GRACE", "READ_ONLY", "SUSPENDED"]);
export type AccessStatus = z.infer<typeof accessStatusSchema>;

export const accessStatusLabels: Record<AccessStatus, string> = {
  EXEMPT: "Isenta",
  TRIAL: "Em teste",
  ACTIVE: "Ativa",
  GRACE: "Vencida (tolerância)",
  READ_ONLY: "Somente leitura",
  SUSPENDED: "Suspensa",
};

export const billingCycleSchema = z.enum(["MONTHLY", "YEARLY"]);
export type BillingCycle = z.infer<typeof billingCycleSchema>;

export const platformPaymentMethodSchema = z.enum(["PIX", "BOLETO", "CARD", "MERCADO_PAGO", "OTHER"]);
export type PlatformPaymentMethod = z.infer<typeof platformPaymentMethodSchema>;

export const platformPaymentMethodLabels: Record<PlatformPaymentMethod, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CARD: "Cartão",
  MERCADO_PAGO: "Mercado Pago",
  OTHER: "Outro",
};

export interface AccessSummaryDto {
  status: AccessStatus;
  /** Fim do teste grátis (ISO) */
  trialEndsAt: string | null;
  /** Até quando está pago (ISO) */
  paidUntil: string | null;
  /** Fim da tolerância: depois disso vira somente leitura (ISO) */
  graceEndsAt: string | null;
  /** Dias até o fim do acesso atual (teste, pagamento ou tolerância); null se isenta */
  daysLeft: number | null;
  readOnly: boolean;
  planName: string | null;
  cycle: BillingCycle | null;
  /** Kits (Fase 8b): módulos opcionais liberados; null = todos (teste/isenta) */
  modules: BusinessModule[] | null;
}

export const platformCompaniesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: accessStatusSchema.optional(),
});
export type PlatformCompaniesQuery = z.infer<typeof platformCompaniesQuerySchema>;

/** GET /api/auth/options (público) */
export interface AuthOptionsDto {
  registrationEnabled: boolean;
  emailEnabled: boolean;
}

/** Trocar a própria senha (qualquer usuário logado). */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual").max(200),
  newPassword: passwordFieldSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

const moduleListSchema = z
  .array(businessModuleSchema)
  .max(20)
  .default([])
  .transform((list) => [...new Set(list)]);

export const platformActivateSchema = z.object({
  planId: z.string().trim().min(1, "Plano é obrigatório").max(60),
  cycle: billingCycleSchema.default("MONTHLY"),
  /** Kits (Fase 8b): módulos avulsos além do kit */
  extraModules: moduleListSchema,
  method: platformPaymentMethodSchema,
  /** Valor recebido; padrão = preço do plano no ciclo */
  amount: z
    .string()
    .transform((value) => normalizeDecimalInput(value))
    .pipe(z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Valor inválido (ex.: 99,90)"))
    .optional(),
  note: z.string().trim().max(500).optional(),
});
export type PlatformActivateInput = z.infer<typeof platformActivateSchema>;

/** Kits (Fase 8b): trocar kit e módulos avulsos sem registrar pagamento. */
export const platformModulesSchema = z.object({
  planId: z.string().trim().min(1, "Kit é obrigatório").max(60),
  extraModules: moduleListSchema,
});
export type PlatformModulesInput = z.infer<typeof platformModulesSchema>;

const moneyString = z
  .string()
  .transform((value) => normalizeDecimalInput(value))
  .pipe(z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Valor inválido (ex.: 99,90)"));
const limitField = z.number().int().min(1).max(1_000_000).nullable();

/** Kits (Fase 8b): o dono edita preço, módulos e limites de cada kit. */
export const platformUpdatePlanSchema = z.object({
  description: z.string().trim().max(500).optional(),
  priceMonthly: moneyString,
  priceYearly: moneyString.nullable(),
  includedModules: moduleListSchema,
  userLimit: limitField,
  clientLimit: limitField,
  productLimit: limitField,
});
export type PlatformUpdatePlanInput = z.infer<typeof platformUpdatePlanSchema>;

export const platformUpdateModuleOfferSchema = z.object({
  description: z.string().trim().min(3).max(300).optional(),
  priceMonthly: moneyString.optional(),
  active: z.boolean().optional(),
});
export type PlatformUpdateModuleOfferInput = z.infer<typeof platformUpdateModuleOfferSchema>;

export interface ModuleOfferDto {
  module: BusinessModule;
  label: string;
  description: string;
  priceMonthly: string;
  active: boolean;
  sortOrder: number;
}

/**
 * Preço de um combo (Fase 8b), em centavos para não errar arredondamento:
 * mensal = kit + avulsos; anual = kit anual (ou 12× o mensal) + 10× cada
 * avulso (2 meses grátis). Módulos já incluídos no kit não são cobrados.
 */
export function computeComboPrice(params: {
  kit: { priceMonthly: string; priceYearly: string | null; includedModules: readonly BusinessModule[] };
  extraModules: readonly BusinessModule[];
  offers: ReadonlyArray<{ module: BusinessModule; priceMonthly: string }>;
  cycle: BillingCycle;
}): string {
  const cents = (value: string) => Math.round(Number(value) * 100);
  const included = new Set(params.kit.includedModules);
  const extrasMonthly = [...new Set(params.extraModules)]
    .filter((module) => !included.has(module))
    .reduce((sum, module) => sum + cents(params.offers.find((o) => o.module === module)?.priceMonthly ?? "0"), 0);
  const total =
    params.cycle === "YEARLY"
      ? (params.kit.priceYearly ? cents(params.kit.priceYearly) : cents(params.kit.priceMonthly) * 12) + extrasMonthly * 10
      : cents(params.kit.priceMonthly) + extrasMonthly;
  return (total / 100).toFixed(2);
}

export const platformTrialSchema = z.object({
  days: z.coerce.number().int().min(1, "Mínimo 1 dia").max(90, "Máximo 90 dias"),
});
export type PlatformTrialInput = z.infer<typeof platformTrialSchema>;

export const platformExemptSchema = z.object({ exempt: z.boolean() });
export type PlatformExemptInput = z.infer<typeof platformExemptSchema>;

export const platformSuspendSchema = z.object({
  reason: z.string().trim().min(3, "Informe o motivo").max(500),
});
export type PlatformSuspendInput = z.infer<typeof platformSuspendSchema>;

export interface PlatformCompanyDto {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  segment: string | null;
  createdAt: string;
  adminName: string | null;
  adminEmail: string | null;
  lastLoginAt: string | null;
  usage: { users: number; clients: number; products: number; sales30d: number };
  billingExempt: boolean;
  suspendedReason: string | null;
  access: AccessSummaryDto;
  /** Kits (Fase 8b): kit e avulsos contratados (null = sem assinatura) */
  contract: { planId: string; planName: string; extraModules: BusinessModule[] } | null;
}

/** Nova empresa cliente criada pelo dono (Fase 8): admin com senha provisória. */
export const platformCreateCompanySchema = z.object({
  companyName: z.string().trim().min(2, "Nome da empresa deve ter ao menos 2 caracteres").max(120),
  adminName: z.string().trim().min(2, "Nome do responsável deve ter ao menos 2 caracteres").max(120),
  adminEmail: emailFieldSchema,
  /** Dias de teste grátis (0 = sem teste; ative um plano em seguida) */
  trialDays: z.coerce.number().int().min(0).max(90).default(14),
});
export type PlatformCreateCompanyInput = z.infer<typeof platformCreateCompanySchema>;

export interface PlatformCreateCompanyResult {
  company: PlatformCompanyDto;
  /** Mostrada uma única vez: envie ao cliente e peça para trocar no 1º acesso */
  temporaryPassword: string;
}

export interface PlatformPaymentDto {
  id: string;
  planName: string;
  extraModules: BusinessModule[];
  cycle: BillingCycle;
  amount: string;
  method: PlatformPaymentMethod;
  periodStart: string;
  periodEnd: string;
  note: string | null;
  recordedBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Busca global (Fase 7 · 7.3)
// ---------------------------------------------------------------------------

export const globalSearchQuerySchema = z.object({
  q: z.string().trim().min(2, "Digite ao menos 2 caracteres").max(80),
});
export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;

export type GlobalSearchKind = "client" | "product" | "sale" | "serviceOrder" | "service";

export interface GlobalSearchItem {
  kind: GlobalSearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface GlobalSearchResult {
  query: string;
  groups: Array<{ kind: GlobalSearchKind; label: string; items: GlobalSearchItem[] }>;
}

// ---------------------------------------------------------------------------
// Onboarding por perfil (Fase 4)
// ---------------------------------------------------------------------------

export const onboardingSegmentSchema = z.enum([
  "COMERCIO",
  "SERVICOS",
  "HIBRIDO",
  "PERSONALIZADO",
]);
export type OnboardingSegment = z.infer<typeof onboardingSegmentSchema>;

export const applyOnboardingSchema = z.object({
  slug: onboardingSegmentSchema,
});
export type ApplyOnboardingInput = z.infer<typeof applyOnboardingSchema>;

// ---------------------------------------------------------------------------
// Importação de planilhas (CSV) — PLANO_IMPORTACAO.md
// ---------------------------------------------------------------------------

export const importTypeSchema = z.enum([
  "CATEGORY",
  "SUPPLIER",
  "PRODUCT",
  "CLIENT",
  "SERVICE",
]);
export type ImportType = z.infer<typeof importTypeSchema>;

export const IMPORT_TYPES: readonly ImportType[] = [
  "CATEGORY",
  "SUPPLIER",
  "PRODUCT",
  "CLIENT",
  "SERVICE",
];

export const importTypeLabels: Record<ImportType, string> = {
  CATEGORY: "Categorias",
  SUPPLIER: "Fornecedores",
  PRODUCT: "Produtos",
  CLIENT: "Clientes",
  SERVICE: "Serviços",
};

export const importTemplateQuerySchema = z.object({
  type: importTypeSchema,
});
export type ImportTemplateQuery = z.infer<typeof importTemplateQuerySchema>;

/** Campos do multipart de POST /api/imports (valores chegam como string). */
export const importUploadFormSchema = z.object({
  type: importTypeSchema,
  dryRun: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => value === true || value === "true")
    .default(false),
});
export type ImportUploadForm = z.infer<typeof importUploadFormSchema>;

export const importErrorDetailSchema = z.object({
  row: z.number().int().min(1),
  message: z.string(),
});
export type ImportErrorDetail = z.infer<typeof importErrorDetailSchema>;

/** Relatório de um upload (real ou dryRun) — mesmo formato nos dois casos. */
export const importReportSchema = z.object({
  dryRun: z.boolean(),
  batchId: z.string().nullable(),
  type: importTypeSchema,
  filename: z.string(),
  totalRows: z.number().int().min(0),
  created: z.number().int().min(0),
  skipped: z.number().int().min(0),
  errors: z.number().int().min(0),
  errorDetails: z.array(importErrorDetailSchema),
});
export type ImportReport = z.infer<typeof importReportSchema>;

export const importBatchStatusSchema = z.enum(["COMPLETED", "FAILED"]);
export type ImportBatchStatus = z.infer<typeof importBatchStatusSchema>;

export const importBatchSchema = z.object({
  id: z.string(),
  type: importTypeSchema,
  status: importBatchStatusSchema,
  filename: z.string(),
  createdCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  createdByName: z.string(),
  createdAt: z.string(),
});
export type ImportBatchDto = z.infer<typeof importBatchSchema>;

export const listImportsQuerySchema = paginationQuerySchema;
export type ListImportsQuery = z.infer<typeof listImportsQuerySchema>;

// ---------------------------------------------------------------------------
// LGPD — consentimento e direitos do titular (N1)
// ---------------------------------------------------------------------------

export const lgpdConsentRoleSchema = z.enum(["USER", "CLIENT"]);
export type LgpdConsentRole = z.infer<typeof lgpdConsentRoleSchema>;

export const lgpdConsentTypeSchema = z.enum([
  "TERMS",
  "PRIVACY",
  "DATA_PROCESSING",
]);
export type LgpdConsentType = z.infer<typeof lgpdConsentTypeSchema>;

export const lgpdConsentTypeLabels: Record<LgpdConsentType, string> = {
  TERMS: "Termos de uso",
  PRIVACY: "Política de privacidade",
  DATA_PROCESSING: "Tratamento de dados",
};

export const lgpdConsentVersionSchema = z
  .string()
  .trim()
  .min(1, "Versão é obrigatória")
  .max(60, "Versão deve ter no máximo 60 caracteres");

/** Registro de aceite de um documento legal (termos/privacidade/tratamento). */
export const createLegalConsentSchema = z.object({
  type: lgpdConsentTypeSchema,
  version: lgpdConsentVersionSchema,
  role: lgpdConsentRoleSchema.default("USER"),
  clientId: z.string().trim().max(60).optional().nullable(),
});
export type CreateLegalConsentInput = z.infer<typeof createLegalConsentSchema>;

export const lgpdConsentSchema = z.object({
  id: z.string(),
  type: lgpdConsentTypeSchema,
  role: lgpdConsentRoleSchema,
  version: z.string(),
  acceptedAt: z.string(),
});
export type LgpdConsentDto = z.infer<typeof lgpdConsentSchema>;

export const lgpdDataExportSchema = z.object({
  client: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      phone: z.string().nullable(),
      mobile: z.string().nullable(),
      email: z.string().nullable(),
      cpf: z.string().nullable(),
      street: z.string().nullable(),
      number: z.string().nullable(),
      complement: z.string().nullable(),
      district: z.string().nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      zip: z.string().nullable(),
      notes: z.string().nullable(),
      createdAt: z.string(),
    })
    .nullable(),
  sales: z.array(z.unknown()),
  financialEntries: z.array(z.unknown()),
  subscriptions: z.array(z.unknown()),
  /** Transformação 2026-10-23: entregas (sites, sistemas, domínios) do cliente */
  deliveries: z.array(z.unknown()),
  consents: z.array(lgpdConsentSchema),
});
export type LgpdDataExportDto = z.infer<typeof lgpdDataExportSchema>;

/** Resposta de anonimização — retorna apenas o que foi feito. */
export const lgpdAnonymizeSchema = z.object({
  clientId: z.string(),
  anonymizedAt: z.string(),
  retained: z.object({
    sales: z.number().int().min(0),
    financialEntries: z.number().int().min(0),
    subscriptions: z.number().int().min(0),
  }),
});
export type LgpdAnonymizeDto = z.infer<typeof lgpdAnonymizeSchema>;

// ---------------------------------------------------------------------------
// Fase 2 · 2.1 — Comissões
// ---------------------------------------------------------------------------

/** Percentual 0–100 com até 2 decimais (string no wire, como dinheiro). */
export const percentageFieldSchema = decimalField(2, 0).refine(
  (value) => Number(value) <= 100,
  "Percentual deve estar entre 0 e 100",
);

export const createProfessionalSchema = z.object({
  name: nameField,
  document: optionalText(30),
  commissionDefault: percentageFieldSchema.optional().nullable(),
});
export type CreateProfessionalInput = z.infer<typeof createProfessionalSchema>;

export const updateProfessionalSchema = createProfessionalSchema.partial();
export type UpdateProfessionalInput = z.infer<typeof updateProfessionalSchema>;

export const listProfessionalsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: recordStatusSchema.optional(),
});
export type ListProfessionalsQuery = z.infer<typeof listProfessionalsQuerySchema>;

export const releasePolicySchema = z.enum(["ON_SALE", "ON_PAYMENT", "SPLIT_50_50"]);
export type ReleasePolicy = z.infer<typeof releasePolicySchema>;

export const releasePolicyLabels: Record<ReleasePolicy, string> = {
  ON_SALE: "Na venda",
  ON_PAYMENT: "No pagamento",
  SPLIT_50_50: "50% na venda / 50% no pagamento",
};

const optionalId = z.string().trim().min(1).max(60).optional().nullable();

const commissionRuleFields = z.object({
  professionalId: optionalId,
  productId: optionalId,
  categoryId: optionalId,
  percentage: percentageFieldSchema,
  releasePolicy: releasePolicySchema.default("ON_SALE"),
  active: z.boolean().default(true),
});

export const createCommissionRuleSchema = commissionRuleFields.refine(
  (value) => !(value.productId && value.categoryId),
  { message: "Informe produto OU categoria, não os dois", path: ["categoryId"] },
);
export type CreateCommissionRuleInput = z.infer<typeof createCommissionRuleSchema>;

export const updateCommissionRuleSchema = commissionRuleFields
  .partial()
  .refine((value) => !(value.productId && value.categoryId), {
    message: "Informe produto OU categoria, não os dois",
    path: ["categoryId"],
  });
export type UpdateCommissionRuleInput = z.infer<typeof updateCommissionRuleSchema>;

export const listCommissionRulesQuerySchema = paginationQuerySchema.extend({
  professionalId: z.string().trim().max(60).optional(),
  active: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
export type ListCommissionRulesQuery = z.infer<typeof listCommissionRulesQuerySchema>;

export const commissionStatusSchema = z.enum(["PENDING", "RELEASED", "PAID", "CANCELLED"]);
export type CommissionStatus = z.infer<typeof commissionStatusSchema>;

export const commissionStatusLabels: Record<CommissionStatus, string> = {
  PENDING: "Pendente",
  RELEASED: "Liberada",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

export const listCommissionsQuerySchema = paginationQuerySchema.extend({
  professionalId: z.string().trim().max(60).optional(),
  status: commissionStatusSchema.optional(),
  from: dateField.optional(),
  to: dateField.optional(),
});
export type ListCommissionsQuery = z.infer<typeof listCommissionsQuerySchema>;

export const commissionSummaryQuerySchema = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
});
export type CommissionSummaryQuery = z.infer<typeof commissionSummaryQuerySchema>;

// ---------------------------------------------------------------------------
// Fase 2 · 2.2 — Crediário
// ---------------------------------------------------------------------------

export const creditAccountStatusSchema = z.enum(["ACTIVE", "BLOCKED"]);
export type CreditAccountStatus = z.infer<typeof creditAccountStatusSchema>;

export const creditInstallmentStatusSchema = z.enum(["OPEN", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"]);
export type CreditInstallmentStatus = z.infer<typeof creditInstallmentStatusSchema>;

export const creditInstallmentStatusLabels: Record<CreditInstallmentStatus, string> = {
  OPEN: "Em aberto",
  PAID: "Paga",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
  REFUNDED: "Devolvida (venda cancelada)",
};

/** ADMIN aprova/ajusta o crediário do cliente (cria se não existir). */
export const updateCreditAccountSchema = z
  .object({
    creditLimit: priceFieldSchema.optional(),
    status: creditAccountStatusSchema.optional(),
  })
  .refine((value) => value.creditLimit !== undefined || value.status !== undefined, {
    message: "Informe o limite e/ou o status",
  });
export type UpdateCreditAccountInput = z.infer<typeof updateCreditAccountSchema>;

export const listCreditAccountsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: creditAccountStatusSchema.optional(),
});
export type ListCreditAccountsQuery = z.infer<typeof listCreditAccountsQuerySchema>;

export const listCreditInstallmentsQuerySchema = paginationQuerySchema.extend({
  status: creditInstallmentStatusSchema.optional(),
  clientId: z.string().trim().max(60).optional(),
  from: isoDateField.optional(),
  to: isoDateField.optional(),
});
export type ListCreditInstallmentsQuery = z.infer<typeof listCreditInstallmentsQuerySchema>;

// ---------------------------------------------------------------------------
// Fase 2 · 2.3 — Ordem de serviço
// ---------------------------------------------------------------------------

export const serviceOrderStatusSchema = z.enum([
  "DRAFT",
  "QUOTE",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
export type ServiceOrderStatus = z.infer<typeof serviceOrderStatusSchema>;

export const serviceOrderStatusLabels: Record<ServiceOrderStatus, string> = {
  DRAFT: "Rascunho",
  QUOTE: "Orçamento",
  APPROVED: "Aprovada",
  IN_PROGRESS: "Em execução",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

/** Próximo estado válido (pular etapa → 400). Cancelamento é rota própria. */
export const SERVICE_ORDER_NEXT_STATUS: Partial<Record<ServiceOrderStatus, ServiceOrderStatus>> = {
  DRAFT: "QUOTE",
  QUOTE: "APPROVED",
  APPROVED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

export const SERVICE_ORDER_MAX_ITEMS = 100;

/**
 * Item da OS. Serviço ou produto do catálogo → o PREÇO vem do catálogo
 * (unitPrice ignorado). Item livre (sem serviço/produto) → descrição e
 * unitPrice obrigatórios (ex.: mão de obra, peça avulsa).
 */
export const serviceOrderItemInputSchema = z
  .object({
    serviceId: z.string().trim().min(1).max(60).optional().nullable(),
    productId: z.string().trim().min(1).max(60).optional().nullable(),
    description: z.string().trim().max(300).optional().nullable(),
    quantity: positiveQuantityFieldSchema,
    unitPrice: priceFieldSchema.optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.serviceId && value.productId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["productId"], message: "Informe serviço OU produto" });
    }
    if (!value.serviceId && !value.productId) {
      if (!value.description || value.description.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["description"], message: "Item livre exige descrição" });
      }
      if (value.unitPrice == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["unitPrice"], message: "Item livre exige valor unitário" });
      }
    }
  });
export type ServiceOrderItemInput = z.infer<typeof serviceOrderItemInputSchema>;

const serviceOrderItemsField = z
  .array(serviceOrderItemInputSchema)
  .max(SERVICE_ORDER_MAX_ITEMS, `Máximo de ${SERVICE_ORDER_MAX_ITEMS} itens`);

export const createServiceOrderSchema = z.object({
  clientId: z.string().trim().min(1, "Cliente é obrigatório").max(60),
  professionalId: z.string().trim().min(1).max(60).optional().nullable(),
  title: z.string().trim().min(3, "Descreva o serviço/equipamento (mín. 3 caracteres)").max(200),
  notes: optionalText(2000),
  discount: priceFieldSchema.default("0"),
  items: serviceOrderItemsField.default([]),
});
export type CreateServiceOrderInput = z.infer<typeof createServiceOrderSchema>;

export const updateServiceOrderSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  notes: optionalText(2000),
  professionalId: z.string().trim().min(1).max(60).optional().nullable(),
  discount: priceFieldSchema.optional(),
});
export type UpdateServiceOrderInput = z.infer<typeof updateServiceOrderSchema>;

export const replaceServiceOrderItemsSchema = z.object({ items: serviceOrderItemsField });
export type ReplaceServiceOrderItemsInput = z.infer<typeof replaceServiceOrderItemsSchema>;

export const transitionServiceOrderSchema = z.object({
  status: z.enum(["QUOTE", "APPROVED", "IN_PROGRESS", "COMPLETED"]),
});
export type TransitionServiceOrderInput = z.infer<typeof transitionServiceOrderSchema>;

export const cancelServiceOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Motivo é obrigatório para cancelamento")
    .max(500, "Motivo deve ter no máximo 500 caracteres"),
});
export type CancelServiceOrderInput = z.infer<typeof cancelServiceOrderSchema>;

export const listServiceOrdersQuerySchema = paginationQuerySchema.extend({
  status: serviceOrderStatusSchema.optional(),
  clientId: z.string().trim().max(60).optional(),
  search: z.string().trim().max(120).optional(),
  from: isoDateField.optional(),
  to: isoDateField.optional(),
});
export type ListServiceOrdersQuery = z.infer<typeof listServiceOrdersQuerySchema>;

/** Anexos da OS (Fase 2 · 2.3). */
export const SERVICE_ORDER_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const SERVICE_ORDER_MAX_ATTACHMENTS = 20;

// ---------------------------------------------------------------------------
// Fase 3 — Fiscal por integração (NFC-e / NF-e / NFS-e)
// ---------------------------------------------------------------------------

export const fiscalEnvironmentSchema = z.enum(["HOMOLOGATION", "PRODUCTION"]);
export type FiscalEnvironment = z.infer<typeof fiscalEnvironmentSchema>;

export const fiscalDocumentTypeSchema = z.enum(["NFE", "NFCE", "NFSE"]);
export type FiscalDocumentType = z.infer<typeof fiscalDocumentTypeSchema>;

export const fiscalDocumentStatusSchema = z.enum(["PENDING", "AUTHORIZED", "REJECTED", "CANCELLED"]);
export type FiscalDocumentStatus = z.infer<typeof fiscalDocumentStatusSchema>;

export const fiscalDocumentTypeLabels: Record<FiscalDocumentType, string> = {
  NFE: "NF-e",
  NFCE: "NFC-e",
  NFSE: "NFS-e",
};

export const fiscalDocumentStatusLabels: Record<FiscalDocumentStatus, string> = {
  PENDING: "Processando",
  AUTHORIZED: "Autorizada",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
};

/** Só dígitos; aceita CNPJ com máscara. */
export const cnpjFieldSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length === 14, "CNPJ deve ter 14 dígitos");

export const updateFiscalConfigSchema = z.object({
  provider: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,40}$/, "Provedor inválido")
    .optional(),
  environment: fiscalEnvironmentSchema.optional(),
  active: z.boolean().optional(),
  cnpj: cnpjFieldSchema.optional().nullable(),
  /** string → grava (cifrado); "" ou null → remove */
  apiToken: z.string().trim().max(500).optional().nullable(),
  nfceSeries: z.coerce.number().int().min(1).max(999).optional(),
  nfeSeries: z.coerce.number().int().min(1).max(999).optional(),
});
export type UpdateFiscalConfigInput = z.infer<typeof updateFiscalConfigSchema>;

export const fiscalCertificateFormSchema = z.object({
  password: z.string().min(1, "Informe a senha do certificado").max(200),
});
export type FiscalCertificateForm = z.infer<typeof fiscalCertificateFormSchema>;

export const emitFiscalDocumentSchema = z
  .object({
    saleId: z.string().trim().min(1).max(60).optional(),
    serviceOrderId: z.string().trim().min(1).max(60).optional(),
    type: fiscalDocumentTypeSchema,
  })
  .refine((value) => Boolean(value.saleId) !== Boolean(value.serviceOrderId), {
    message: "Informe a venda OU a ordem de serviço",
  });
export type EmitFiscalDocumentInput = z.infer<typeof emitFiscalDocumentSchema>;

export const cancelFiscalDocumentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(15, "Justificativa deve ter ao menos 15 caracteres (exigência da SEFAZ)")
    .max(255, "Justificativa deve ter no máximo 255 caracteres"),
});
export type CancelFiscalDocumentInput = z.infer<typeof cancelFiscalDocumentSchema>;

export const listFiscalDocumentsQuerySchema = paginationQuerySchema.extend({
  type: fiscalDocumentTypeSchema.optional(),
  status: fiscalDocumentStatusSchema.optional(),
  saleId: z.string().trim().max(60).optional(),
  serviceOrderId: z.string().trim().max(60).optional(),
  from: isoDateField.optional(),
  to: isoDateField.optional(),
});
export type ListFiscalDocumentsQuery = z.infer<typeof listFiscalDocumentsQuerySchema>;

// ---------------------------------------------------------------------------
// Transformação 2026-10-23 — clientes e produtos digitais
// ---------------------------------------------------------------------------

export const digitalProductTypeSchema = z.enum([
  "SITE",
  "PROFESSIONAL_PROFILE",
  "SYSTEM",
  "ONLINE_STORE",
  "HOSTING",
  "DOMAIN",
  "MAINTENANCE",
]);
export type DigitalProductType = z.infer<typeof digitalProductTypeSchema>;

export const digitalProductTypeLabels: Record<DigitalProductType, string> = {
  SITE: "Site",
  PROFESSIONAL_PROFILE: "Perfil profissional",
  SYSTEM: "Sistema",
  ONLINE_STORE: "Loja virtual",
  HOSTING: "Hospedagem",
  DOMAIN: "Domínio",
  MAINTENANCE: "Manutenção",
};

export const digitalBillingPeriodSchema = z.enum(["MONTHLY", "YEARLY"]);
export type DigitalBillingPeriod = z.infer<typeof digitalBillingPeriodSchema>;

export const digitalBillingPeriodLabels: Record<DigitalBillingPeriod, string> = {
  MONTHLY: "Mensal",
  YEARLY: "Anual",
};

export const deliveryStatusSchema = z.enum(["IN_PROGRESS", "ACTIVE", "PAUSED", "CANCELLED"]);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  IN_PROGRESS: "Em produção",
  ACTIVE: "No ar",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
};

export const createDigitalProductSchema = z.object({
  name: nameField,
  type: digitalProductTypeSchema,
  description: optionalText(1000),
  defaultPrice: priceFieldSchema,
  billingPeriod: digitalBillingPeriodSchema.default("MONTHLY"),
});
export type CreateDigitalProductInput = z.infer<typeof createDigitalProductSchema>;

export const updateDigitalProductSchema = createDigitalProductSchema
  .omit({ billingPeriod: true })
  .extend({ billingPeriod: digitalBillingPeriodSchema })
  .partial();
export type UpdateDigitalProductInput = z.infer<typeof updateDigitalProductSchema>;

export const listDigitalProductsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  type: digitalProductTypeSchema.optional(),
  status: recordStatusSchema.optional(),
  orderBy: z.enum(["name", "defaultPrice", "createdAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListDigitalProductsQuery = z.infer<typeof listDigitalProductsQuerySchema>;

/** URL http(s) opcional (site, painel, repositório). */
const optionalUrl = z
  .string()
  .trim()
  .max(500, "Máximo de 500 caracteres")
  .url("URL inválida (use https://...)")
  .refine((value) => /^https?:\/\//i.test(value), "URL deve começar com http:// ou https://")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

/** Data (AAAA-MM-DD) opcional de renovação. */
const optionalDay = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)")
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

const deliveryFields = {
  name: nameField,
  type: digitalProductTypeSchema,
  productId: z.string().trim().min(1).max(60).optional().nullable(),
  siteUrl: optionalUrl,
  adminUrl: optionalUrl,
  repositoryUrl: optionalUrl,
  domain: optionalText(253),
  domainRenewalAt: optionalDay,
  hostingProvider: optionalText(120),
  hostingRenewalAt: optionalDay,
  notes: optionalText(2000),
  status: deliveryStatusSchema.optional(),
  neverPause: z.boolean().optional(),
  /** Monitor de site (GET/HEAD só leitura a cada 5 min); padrão ligado. */
  monitorEnabled: z.boolean().optional(),
  /** 2026-10-27: faixa de pendência no site do cliente quando vencido */
  showWarningBanner: z.boolean().optional(),
};

export const createDeliverySchema = z.object({
  clientId: z.string().trim().min(1, "Cliente é obrigatório").max(60),
  ...deliveryFields,
});
export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;

export const updateDeliverySchema = z.object(deliveryFields).partial();
export type UpdateDeliveryInput = z.infer<typeof updateDeliverySchema>;

export const listDeliveriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  clientId: z.string().trim().max(60).optional(),
  type: digitalProductTypeSchema.optional(),
  status: deliveryStatusSchema.optional(),
  /** 2026-10-27: filtra pela situação de cobrança (ex.: EM_DEBITO) */
  billingState: billingStateSchema.optional(),
  orderBy: z.enum(["name", "createdAt", "domainRenewalAt", "hostingRenewalAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;

/**
 * Atraso de contrato: aviso no dia N e pausa da entrega no dia M (padrão 1 e
 * 10). Por ora é só configuração — nenhuma pausa automática é executada.
 */
export const OVERDUE_WARN_DAYS_DEFAULT = 1;
export const OVERDUE_PAUSE_DAYS_DEFAULT = 10;

export const updateOverduePolicySchema = z
  .object({
    warnDays: z.coerce.number().int("Use um número inteiro de dias").min(0).max(365),
    pauseDays: z.coerce.number().int("Use um número inteiro de dias").min(1).max(365),
    /** Chave Pix das mensagens de cobrança; "" apaga, ausente mantém. */
    pixKey: z.string().trim().max(140, "Máximo de 140 caracteres").optional().nullable(),
  })
  .refine((value) => value.pauseDays > value.warnDays, {
    message: "A pausa deve vir depois do aviso",
    path: ["pauseDays"],
  });
export type UpdateOverduePolicyInput = z.infer<typeof updateOverduePolicySchema>;

export interface OverduePolicyDto {
  warnDays: number;
  pauseDays: number;
  /** Sempre false nesta etapa: a pausa automática ainda não existe. */
  autoPauseEnabled: false;
  pixKey: string | null;
}

// ---------------------------------------------------------------------------
// 2026-10-24 — cobrança automática dos contratos
// ---------------------------------------------------------------------------

/**
 * Título a receber de um contrato (FinancialEntry origin SUBSCRIPTION):
 * `originId = <subscriptionId>:<inicio|renovacao>:<AAAA-MM-DD>`. "inicio" é o
 * primeiro período sem pagamento; "renovacao" é o período que começa no fim
 * do contrato. O worker gera; pagar o título de renovação renova o contrato.
 * (O worker repete este formato em apps/worker/src/billing.)
 */
export type ContractReceivableKind = "inicio" | "renovacao";

export function contractReceivableOriginId(subscriptionId: string, kind: ContractReceivableKind, due: Date): string {
  return `${subscriptionId}:${kind}:${due.toISOString().slice(0, 10)}`;
}

export function parseContractReceivableOriginId(
  originId: string,
): { subscriptionId: string; kind: ContractReceivableKind; day: string } | null {
  const match = /^([^:]+):(inicio|renovacao):(\d{4}-\d{2}-\d{2})$/.exec(originId);
  if (!match) return null;
  return { subscriptionId: match[1]!, kind: match[2] as ContractReceivableKind, day: match[3]! };
}

/** Dias antes do fim do contrato em que o título de renovação é gerado. */
export const CONTRACT_BILLING_LEAD_DAYS = 30;

/** Modelos de WhatsApp da cobrança (nome do template na Meta). */
export const CONTRACT_BILLING_TEMPLATES = {
  BEFORE: "cobranca_lembrete",
  DUE: "cobranca_vencimento",
  OVERDUE: "cobranca_atraso",
} as const;

export interface ContractReceivableDto {
  id: string;
  kind: ContractReceivableKind;
  description: string;
  amount: string;
  dueDate: string;
  status: "OPEN" | "PAID" | "CANCELLED";
  paidAt: string | null;
}

/** Texto da cobrança para enviar manualmente (botão "Copiar mensagem"). */
export function contractBillingMessage(params: {
  clientName: string;
  contract: string;
  amount: string;
  dueDate: string;
  pixKey: string | null;
  overdue: boolean;
}): string {
  const first = params.clientName.split(" ")[0] || params.clientName;
  const head = params.overdue
    ? `Olá, ${first}! Consta em aberto o pagamento de ${params.contract}, no valor de ${params.amount}, vencido em ${params.dueDate}.`
    : `Olá, ${first}! O pagamento de ${params.contract}, no valor de ${params.amount}, vence em ${params.dueDate}.`;
  const pix = params.pixKey ? ` Você pode pagar pelo Pix: ${params.pixKey}.` : "";
  const tail = params.overdue ? " Se já pagou, por favor desconsidere esta mensagem." : " Qualquer dúvida, estou à disposição.";
  return `${head}${pix}${tail}`;
}

export const clientHistoryKindSchema = z.enum([
  "CLIENT_CREATED",
  "DELIVERY_CREATED",
  "CONTRACT_STARTED",
  "CONTRACT_CANCELLED",
  "FINANCIAL_ENTRY",
  "APPOINTMENT",
  "SERVICE_ORDER",
  "BILLING_ACTION",
]);
export type ClientHistoryKind = z.infer<typeof clientHistoryKindSchema>;

export interface ClientHistoryItemDto {
  kind: ClientHistoryKind;
  at: string;
  title: string;
  detail: string | null;
  /** Rota da web para abrir o registro, quando houver tela. */
  href: string | null;
}

// ---------------------------------------------------------------------------
// Transformação 2026-10-23 — logins das entregas (cifrados) e monitor
// ---------------------------------------------------------------------------

export const createCredentialSchema = z.object({
  label: z.string().trim().min(2, "Descreva o login (ex.: Painel admin)").max(120),
  username: optionalText(190),
  /** Senha em claro só na ida; o servidor grava cifrada. */
  secret: z.string().max(500, "Máximo de 500 caracteres").optional().nullable(),
  url: z
    .string()
    .trim()
    .max(500)
    .url("URL inválida (use https://...)")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  notes: optionalText(1000),
});
export type CreateCredentialInput = z.infer<typeof createCredentialSchema>;

/** Na edição, `secret` ausente mantém a senha; "" apaga. */
export const updateCredentialSchema = createCredentialSchema.partial();
export type UpdateCredentialInput = z.infer<typeof updateCredentialSchema>;

export type CredentialAction = "CREATE" | "UPDATE" | "REVEAL" | "ARCHIVE";

export const credentialActionLabels: Record<CredentialAction, string> = {
  CREATE: "Criou",
  UPDATE: "Alterou",
  REVEAL: "Mostrou a senha",
  ARCHIVE: "Arquivou",
};

export interface DeliveryCredentialDto {
  id: string;
  deliveryId: string;
  label: string;
  username: string | null;
  url: string | null;
  notes: string | null;
  /** Nunca a senha: só se existe uma gravada. */
  hasSecret: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialAccessLogDto {
  id: string;
  action: CredentialAction;
  userName: string;
  createdAt: string;
}

export type SiteStatus = "UP" | "DOWN";

export interface SiteCheckDto {
  id: string;
  url: string;
  ok: boolean;
  httpStatus: number | null;
  responseMs: number | null;
  error: string | null;
  checkedAt: string;
}

/** Monitor: intervalo entre checagens e limite de resposta. */
export const SITE_MONITOR_INTERVAL_MS = 5 * 60 * 1000;
export const SITE_MONITOR_TIMEOUT_MS = 10_000;
export const SITE_CHECK_RETENTION_DAYS = 30;

export interface DigitalOverviewDto {
  /** Receita mensal recorrente dos contratos ativos (preço × 30 / duração). */
  monthlyRecurringRevenue: string;
  activeContracts: number;
  receivableNext30: { total: string; count: number };
  overdueReceivables: { total: string; count: number };
  upcoming: Array<{
    kind: "CONTRACT" | "DOMAIN" | "HOSTING";
    date: string;
    /** Dias até o vencimento (0 = hoje). Avisos em 30, 7 e 1 dia. */
    daysLeft: number;
    title: string;
    clientName: string;
    href: string;
  }>;
  sitesDown: Array<{
    deliveryId: string;
    name: string;
    clientName: string;
    url: string;
    since: string | null;
    httpStatus: number | null;
    neverPause: boolean;
  }>;
  monitoredSites: number;
  /** 2026-10-27: contratos vencidos, em débito, em acordo ou pausados. */
  debtors: Array<{
    subscriptionId: string;
    clientId: string;
    clientName: string;
    contract: string;
    deliveryId: string | null;
    deliveryName: string | null;
    neverPause: boolean;
    state: BillingState;
    amount: string | null;
    dueDate: string | null;
    daysOverdue: number;
    graceUntil: string | null;
    agreementBroken: boolean;
  }>;
}

/** Faixas de aviso de renovação de domínio/hospedagem: 30, 7 e 1 dia antes. */
export const RENEWAL_ALERT_DAYS = [30, 7, 1] as const;

export interface DigitalReportsDto {
  months: Array<{ month: string; monthlyRecurringRevenue: string; received: string; activeContracts: number }>;
  revenueByProduct: Array<{ product: string; received: string; monthlyRecurringRevenue: string; contracts: number }>;
  delinquency: {
    overdueTotal: string;
    overdueCount: number;
    /** Atrasado ÷ tudo que venceu nos últimos 90 dias (0..1). */
    rate: number;
    topClients: Array<{ clientId: string; name: string; total: string; count: number; oldestDueDate: string }>;
  };
  clientsByStatus: {
    active: number;
    inactive: number;
    withActiveContract: number;
    withOverdue: number;
    withoutContract: number;
  };
}

// ---------------------------------------------------------------------------
// 2026-10-27 — pausa dos sites vendidos, prazo combinado e estados de cobrança
// ---------------------------------------------------------------------------

/**
 * Situação de cobrança de um contrato/entrega, calculada no servidor:
 * em dia → vence em N dias → vencido (alerta) → em débito (após N dias) ou
 * em acordo (prazo dado); pausado/inativo vêm do status da entrega.
 */

export const billingStateLabels: Record<BillingState, string> = {
  EM_DIA: "Em dia",
  VENCE_EM: "Vence em breve",
  VENCIDO: "Vencido",
  EM_DEBITO: "Em débito",
  EM_ACORDO: "Em acordo",
  PAUSADO: "Pausado",
  INATIVO: "Inativo",
};

/** Ordem de gravidade (maior = pior) para resumir vários contratos. */
export const billingStateSeverity: Record<BillingState, number> = {
  EM_DIA: 0,
  INATIVO: 1,
  VENCE_EM: 2,
  EM_ACORDO: 3,
  VENCIDO: 4,
  PAUSADO: 5,
  EM_DEBITO: 6,
};

/** "Vence em breve" a partir de N dias antes do vencimento. */
export const BILLING_DUE_SOON_DAYS = 7;

export interface BillingStatusDto {
  state: BillingState;
  /** Dias até o vencimento (negativo = dias de atraso); null sem título. */
  daysToDue: number | null;
  dueDate: string | null;
  amount: string | null;
  graceUntil: string | null;
  /** Prazo combinado venceu sem pagamento. */
  agreementBroken: boolean;
}

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, "Informe o motivo (mínimo 3 caracteres)").max(500),
});
export type ReasonInput = z.infer<typeof reasonSchema>;

export const optionalReasonSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type OptionalReasonInput = z.infer<typeof optionalReasonSchema>;

export const grantGraceSchema = z.object({
  until: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)"),
  note: z.string().trim().min(3, "Descreva o acordo (mínimo 3 caracteres)").max(500),
});
export type GrantGraceInput = z.infer<typeof grantGraceSchema>;

export const billingActionLabels: Record<
  "ACTIVATE" | "PAUSE" | "DEACTIVATE" | "REACTIVATE" | "AUTO_PAUSE" | "AUTO_RESUME" | "GRACE",
  string
> = {
  ACTIVATE: "Ativou",
  PAUSE: "Pausou até pagar",
  DEACTIVATE: "Inativou (cliente desistiu)",
  REACTIVATE: "Reativou",
  AUTO_PAUSE: "Pausa automática",
  AUTO_RESUME: "Voltou ao ar (pagamento)",
  GRACE: "Deu prazo",
};

export interface BillingActionDto {
  id: string;
  action: keyof typeof billingActionLabels;
  fromStatus: DeliveryStatus | null;
  toStatus: DeliveryStatus | null;
  reason: string | null;
  graceUntil: string | null;
  userName: string | null;
  createdAt: string;
}

/** Textos editáveis (Configurações › Contratos). Variáveis entre chaves. */
export const BILLING_TEXT_VARIABLES = ["{cliente}", "{contrato}", "{valor}", "{vencimento}", "{dias}", "{pix}", "{prazo}"] as const;

export const DEFAULT_BILLING_TEXTS = {
  billingTextBefore:
    "Olá, {cliente}! Seu plano {contrato} vence em {dias} dia(s), em {vencimento}, no valor de {valor}. Pix: {pix}. Qualquer dúvida, estou à disposição.",
  billingTextOverdue:
    "Olá, {cliente}. Seu plano {contrato}, no valor de {valor}, venceu em {vencimento}. Renove sua conta pelo Pix: {pix}. Se já pagou, por favor desconsidere.",
  billingTextAgreement:
    "Olá, {cliente}! Conforme combinado, o pagamento de {contrato} ({valor}) fica para até {prazo}. Pix: {pix}. Obrigado!",
  siteWarningText: "Pagamento do plano deste site pendente. Regularize para evitar a suspensão.",
  siteSuspendedText: "Este site está temporariamente suspenso. Entre em contato com o responsável.",
} as const;
export type BillingTextKey = keyof typeof DEFAULT_BILLING_TEXTS;

const billingTextField = z.string().trim().max(1000, "Máximo de 1000 caracteres").optional().nullable();

export const updateBillingSettingsSchema = z.object({
  autoPauseEnabled: z.boolean().optional(),
  autoPauseDays: z.coerce.number().int().min(1).max(365).optional(),
  billingTextBefore: billingTextField,
  billingTextOverdue: billingTextField,
  billingTextAgreement: billingTextField,
  siteWarningText: billingTextField,
  siteSuspendedText: billingTextField,
});
export type UpdateBillingSettingsInput = z.infer<typeof updateBillingSettingsSchema>;

export interface BillingSettingsDto {
  autoPauseEnabled: boolean;
  autoPauseDays: number;
  /** Textos efetivos (o padrão quando a empresa não editou). */
  texts: Record<BillingTextKey, string>;
  customized: Record<BillingTextKey, boolean>;
}

/** Troca {variavel} pelo valor; variável sem valor vira "—". */
export function renderBillingText(template: string, values: Partial<Record<string, string | number | null>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in values)) return match;
    const value = values[key];
    return value === null || value === undefined || value === "" ? "—" : String(value);
  });
}

/** Resposta do endpoint público do script no site do cliente (sem dados pessoais). */
export type PublicSiteStatus = "ativo" | "aviso" | "pausado" | "inativo";
export interface PublicSiteStatusDto {
  status: PublicSiteStatus;
  message: string | null;
}

