import type {
  BillingStatusDto,
  ContractReceivableDto,
  DeliveryStatus,
  DigitalBillingPeriod,
  DigitalProductType,
} from "@petflow/shared";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type RecordStatus = "ACTIVE" | "INACTIVE";
export type ProductUnit =
  | "UNIDADE"
  | "KG"
  | "G"
  | "L"
  | "ML"
  | "CAIXA"
  | "PACOTE"
  | "ROLLO";

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

export type StockMovementType =
  | "IN"
  | "OUT"
  | "ADJUST_POSITIVE"
  | "ADJUST_NEGATIVE";

export const stockMovementTypeLabels: Record<StockMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
  ADJUST_POSITIVE: "Ajuste +",
  ADJUST_NEGATIVE: "Ajuste -",
};

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDto {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  unit: ProductUnit;
  costPrice: string;
  salePrice: string;
  stockQuantity: string;
  minimumStock: string;
  status: RecordStatus;
  categoryId: string | null;
  supplierId: string | null;
  createdAt: string;
  updatedAt: string;
  lowStock: boolean;
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
}

export interface ProductListItemDto extends Omit<ProductDto, "description"> {
  description: string | null;
}

export interface MovementDto {
  id: string;
  type: StockMovementType;
  quantity: string;
  notes: string | null;
  reference: string | null;
  createdAt: string;
  product: { id: string; name: string; unit: ProductUnit };
  createdBy: { id: string; name: string };
}

export interface LowStockDto {
  id: string;
  name: string;
  sku: string | null;
  unit: ProductUnit;
  stockQuantity: string;
  minimumStock: string;
}

export interface StockMovementResult {
  movement: MovementDto;
  stockQuantity: string;
}

export type PaymentMethod = "CASH" | "CARD" | "PIX" | "OTHER" | "CREDIARIO";

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  CARD: "Cartão",
  PIX: "Pix",
  OTHER: "Outro",
  CREDIARIO: "Crediário",
};

export type SaleStatus = "COMPLETED" | "CANCELLED";

export const saleStatusLabels: Record<SaleStatus, string> = {
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export interface SaleItemDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string | null;
  unit: ProductUnit;
  unitPrice: string;
  quantity: string;
  subtotal: string;
}

export interface SaleDto {
  id: string;
  receiptCode: string;
  clientId: string | null;
  status: SaleStatus;
  subtotal: string;
  discount: string;
  total: string;
  paymentMethod: PaymentMethod;
  paymentNote: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: { id: string; name: string };
  cancelledBy: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  /** Fase 2 · 2.1: profissional/vendedor (comissão) */
  professional?: { id: string; name: string } | null;
  items: SaleItemDto[];
}

export type CashSessionStatus = "OPEN" | "CLOSED";

export const cashSessionStatusLabels: Record<CashSessionStatus, string> = {
  OPEN: "Aberto",
  CLOSED: "Fechado",
};

export type CashMovementType = "IN" | "OUT";

export const cashMovementTypeLabels: Record<CashMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
};

export type CashMovementOrigin =
  | "MANUAL"
  | "SALE"
  | "SALE_CANCELMENT"
  | "REVERSAL";

export const cashMovementOriginLabels: Record<CashMovementOrigin, string> = {
  MANUAL: "Manual",
  SALE: "Venda",
  SALE_CANCELMENT: "Cancelamento",
  REVERSAL: "Estorno",
};

export interface CashSessionTotals {
  entriesTotal: string;
  exitsTotal: string;
  salesTotal: string;
  cancelmentsTotal: string;
}

export interface CashSessionDto extends CashSessionTotals {
  id: string;
  status: CashSessionStatus;
  initialAmount: string;
  openingNotes: string | null;
  openedAt: string;
  openedBy: { id: string; name: string };
  closedAt: string | null;
  closedBy: { id: string; name: string } | null;
  closingNotes: string | null;
  countedAmount: string | null;
  expectedAmount: string | null;
  difference: string | null;
  expectedBalance: string;
  differenceBalance?: string | null;
}

export interface CashMovementDto {
  id: string;
  type: CashMovementType;
  origin: CashMovementOrigin;
  inCash: boolean;
  amount: string;
  description: string;
  justification: string | null;
  saleId: string | null;
  sale: { id: string; receiptCode: string } | null;
  reversalOfId: string | null;
  reversalOf: {
    id: string;
    description: string;
    amount: string;
    type: CashMovementType;
  } | null;
  reversedAt: string | null;
  reversedBy: { id: string; name: string } | null;
  reversalReason: string | null;
  cashSessionId: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
}

export interface CashSummaryDto {
  from: string | null;
  to: string | null;
  sessionId: string | null;
  salesTotal: string;
  manualEntriesTotal: string;
  manualExitsTotal: string;
  cancelmentsTotal: string;
  reversalsInTotal: string;
  reversalsOutTotal: string;
  reversalsNetTotal: string;
  totalIn: string;
  totalOut: string;
  net: string;
}

export interface ClientDto {
  id: string;
  name: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  cpf: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { sales: number };
  /** 2026-10-27: pior situação de cobrança entre os contratos */
  billing?: BillingStatusDto | null;
}

export interface ServiceDto {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number | null;
  price: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Etapa 6 — integração com WhatsApp
// ---------------------------------------------------------------------------

export type WhatsAppConfigStatus =
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "ACTIVE"
  | "ERROR"
  | "DISCONNECTED";

export const whatsappConfigStatusLabels: Record<WhatsAppConfigStatus, string> = {
  NOT_CONFIGURED: "Não configurado",
  CONFIGURED: "Configurado",
  ACTIVE: "Ativo",
  ERROR: "Erro",
  DISCONNECTED: "Desconectado",
};

export interface WhatsAppConfigDto {
  status: WhatsAppConfigStatus;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayName: string | null;
  lastError: string | null;
  lastHealthAt: string | null;
  updatedAt: string | null;
  reminderTemplateId: string | null;
  reminderLeadMinutes: number;
  provider: { provider: "mock" | "meta"; credentialsConfigured: boolean };
  webhook: {
    path: string;
    verifyConfigured: boolean;
    signatureConfigured: boolean;
  };
}

export interface WhatsAppHealthResult {
  ok: boolean;
  status: WhatsAppConfigStatus;
  verifiedName?: string | null;
  displayPhoneNumber?: string | null;
  lastHealthAt?: string | null;
  message?: string;
}

export type WhatsAppTemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";
export type WhatsAppTemplateApproval = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export const whatsappTemplateCategoryLabels: Record<WhatsAppTemplateCategory, string> = {
  UTILITY: "Utilidade",
  MARKETING: "Marketing",
  AUTHENTICATION: "Autenticação",
};

export const whatsappTemplateApprovalLabels: Record<WhatsAppTemplateApproval, string> = {
  PENDING_APPROVAL: "Aguardando aprovação",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

export interface WhatsAppTemplateDto {
  id: string;
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  body: string;
  providerReference: string | null;
  approval: WhatsAppTemplateApproval;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export type WhatsAppConsentStatus = "OPTED_IN" | "OPTED_OUT";
export type WhatsAppConsentSource = "MANUAL" | "REPLY" | "IMPORT";

export const whatsappConsentStatusLabels: Record<WhatsAppConsentStatus, string> = {
  OPTED_IN: "Com consentimento",
  OPTED_OUT: "Descadastrado",
};

export const whatsappConsentSourceLabels: Record<WhatsAppConsentSource, string> = {
  MANUAL: "Registro manual",
  REPLY: "Resposta no WhatsApp",
  IMPORT: "Importação",
};

export interface WhatsAppConsentDto {
  id: string;
  clientId: string;
  status: WhatsAppConsentStatus;
  source: WhatsAppConsentSource;
  phone: string | null;
  notes: string | null;
  changedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    phone: string | null;
    mobile: string | null;
    status: RecordStatus;
  } | null;
}

export type WhatsAppMessageStatus =
  | "PENDING"
  | "PROCESSING"
  | "ACCEPTED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "CANCELLED";

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

export type WhatsAppMessageOrigin = "MANUAL" | "SERVICE_REMINDER";

export const whatsappMessageOriginLabels: Record<WhatsAppMessageOrigin, string> = {
  MANUAL: "Manual",
  SERVICE_REMINDER: "Lembrete de serviço",
};

export interface WhatsAppMessageAttemptDto {
  id: string;
  attemptNumber: number;
  outcome: string;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  httpStatus: number | null;
  startedAt: string;
  finishedAt: string;
}

export interface WhatsAppMessageDto {
  id: string;
  clientId: string;
  templateId: string;
  toPhone: string;
  variables: string[];
  templateNameSnapshot: string;
  templateLanguageSnapshot: string;
  templateBodySnapshot: string;
  status: WhatsAppMessageStatus;
  origin: WhatsAppMessageOrigin;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  providerMessageId: string | null;
  failureReason: string | null;
  failureDetail: string | null;
  idempotencyKey: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string } | null;
  template: { id: string; name: string; approval: WhatsAppTemplateApproval; status: RecordStatus } | null;
  createdBy: { id: string; name: string } | null;
  attemptsLog?: WhatsAppMessageAttemptDto[];
}

// ---------------------------------------------------------------------------
// Etapa 7 — dashboard e relatórios
// ---------------------------------------------------------------------------

export interface ReportPeriod {
  from: string;
  to: string;
  timezone: string;
}

export interface ModuleAvailability {
  available: boolean;
  reason: string | null;
}

/** Contagens de agendamentos por status no período (Etapa 8). */
export interface ServicesCounts {
  scheduled: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface DashboardSummaryDto {
  period: ReportPeriod;
  generatedAt: string;
  sales: {
    completedCount: number;
    gross: string;
    discounts: string;
    net: string;
    cancelledCount: number;
    cancelledTotal: string;
    ticketAverage: string | null;
  };
  salesByDay: Array<{ day: string; count: number; net: string }>;
  salesByPaymentMethod: Array<{
    paymentMethod: PaymentMethod;
    label: string;
    count: number;
    net: string;
  }>;
  cash: {
    openSession: {
      id: string;
      openedAt: string;
      initialAmount: string;
      expectedBalance: string;
    } | null;
    entriesInCash: string;
    exitsInCash: string;
    entriesTotal: string;
    exitsTotal: string;
  };
  stock: { outOfStockCount: number; lowStockCount: number };
  clients: { newClients: number };
  services: ServicesCounts;
  whatsapp: {
    total: number;
    pending: number;
    accepted: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    cancelled: number;
  };
  modules: { servicesRealized: ModuleAvailability };
}

export interface SaleReportItemDto {
  id: string;
  receiptCode: string;
  createdAt: string;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  subtotal: string;
  discount: string;
  total: string;
  client: string | null;
  createdBy: string;
}

export interface SalesReportDto {
  period: ReportPeriod;
  generatedAt: string;
  totals: {
    completed: { count: number; gross: string; discounts: string; net: string };
    cancelled: { count: number; total: string };
  };
  items: SaleReportItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StockAlertItemDto {
  id: string;
  name: string;
  sku: string | null;
  unit: ProductUnit;
  unitLabel: string;
  stockQuantity: string;
  minimumStock: string;
  alert: "OUT_OF_STOCK" | "LOW_STOCK";
}

export interface StockAlertsReportDto {
  generatedAt: string;
  alerts: { total: number; outOfStockCount: number; lowStockCount: number };
  items: StockAlertItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StockMovementReportItemDto {
  id: string;
  createdAt: string;
  type: StockMovementType;
  typeLabel: string;
  quantity: string;
  reference: string | null;
  notes: string | null;
  product: { name: string; sku: string | null };
  createdBy: string;
}

export interface StockMovementsReportDto {
  period: ReportPeriod;
  generatedAt: string;
  totals: {
    count: number;
    byType: Array<{ type: StockMovementType; label: string; count: number; quantity: string }>;
  };
  items: StockMovementReportItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CashReportDto {
  period: ReportPeriod;
  generatedAt: string;
  movements: {
    inCash: { entries: string; exits: string; net: string };
    all: { entries: string; exits: string };
    byOrigin: Array<{
      origin: CashMovementOrigin;
      originLabel: string;
      type: "IN" | "OUT";
      typeLabel: string;
      count: number;
      total: string;
    }>;
    reversals: { count: number; total: string };
  };
  sessions: {
    openedCount: number;
    closedCount: number;
    closedWithDifferenceCount: number;
    totalDifference: string;
    items: Array<{
      id: string;
      status: CashSessionStatus;
      openedAt: string;
      closedAt: string | null;
      initialAmount: string;
      countedAmount: string | null;
      expectedAmount: string | null;
      difference: string | null;
    }>;
  };
}

export interface ClientsReportDto {
  period: ReportPeriod;
  generatedAt: string;
  newClients: number;
  services: ServicesCounts;
}

export interface WhatsAppReportDto {
  period: ReportPeriod;
  generatedAt: string;
  total: number;
  byStatus: Array<{ status: WhatsAppMessageStatus; label: string; count: number }>;
  states: {
    pending: number;
    accepted: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    cancelled: number;
  };
  failed: { count: number; byReason: Array<{ reason: string; count: number }> };
}

// ---------------------------------------------------------------------------
// Etapa 8 — agendamentos
// ---------------------------------------------------------------------------

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

/** Transições aceitas em PATCH /api/appointments/:id/status. */
export type AppointmentActionStatus = "CONFIRMED" | "COMPLETED" | "NO_SHOW";

export interface AppointmentDto {
  id: string;
  companyId: string;
  clientId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  startLocal: string;
  durationMinutes: number;
  status: AppointmentStatus;
  notes: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; phone: string | null; mobile: string | null; status: RecordStatus };
  service: { id: string; name: string; price: string; status: RecordStatus };
  createdBy: { id: string; name: string };
  cancelledBy: { id: string; name: string } | null;
}

// ---------------------------------------------------------------------------
// Etapa 9 — assinaturas e gestão comercial
// ---------------------------------------------------------------------------

export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export interface SubscriptionPlanDto {
  id: string;
  name: string;
  description: string | null;
  price: string;
  durationDays: number;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPaymentDto {
  id: string;
  amount: string;
  description: string;
  cashSessionId: string;
  createdAt: string;
}

export interface SubscriptionDto {
  id: string;
  clientId: string;
  planId: string;
  startAt: string;
  endAt: string;
  status: SubscriptionStatus;
  cancelReason: string | null;
  cancelledAt: string | null;
  renewalCount: number;
  lastPaymentAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; phone: string | null; mobile: string | null };
  /** Transformação 2026-10-23: entrega coberta pelo contrato */
  delivery: { id: string; name: string; type: DigitalProductType; neverPause: boolean; status: DeliveryStatus } | null;
  /** 2026-10-27: prazo combinado e situação de cobrança */
  graceUntil?: string | null;
  graceNote?: string | null;
  billing?: BillingStatusDto | null;
  plan: {
    id: string;
    name: string;
    price: string;
    durationDays: number;
    status: RecordStatus;
  };
  payments?: SubscriptionPaymentDto[];
  /** 2026-10-24: títulos da cobrança automática */
  receivables?: ContractReceivableDto[];
}

export interface TenantPlanDto {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  /** Fase 8: preço anual (2 meses grátis) */
  priceYearly: string | null;
  durationDays: number;
  userLimit: number | null;
  clientLimit: number | null;
  productLimit: number | null;
  active: boolean;
  /** Kits (Fase 8b): módulos incluídos no kit */
  includedModules: BusinessModule[];
  sortOrder: number;
}

export type TenantSubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

export const tenantSubscriptionStatusLabels: Record<TenantSubscriptionStatus, string> = {
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

export interface TenantSubscriptionDto {
  id: string;
  companyId: string;
  planId: string;
  status: TenantSubscriptionStatus;
  billingCycle: "MONTHLY" | "YEARLY";
  /** Kits (Fase 8b): módulos avulsos além do kit */
  extraModules: BusinessModule[];
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelReason: string | null;
  cancelledAt: string | null;
  changedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  plan: TenantPlanDto;
}

export interface PlanUsageDto {
  subscription: TenantSubscriptionDto | null;
  usage: {
    users: number;
    clients: number;
    products: number;
  };
}

export type FinancialDirection = "PAYABLE" | "RECEIVABLE";
export type FinancialStatus = "OPEN" | "PAID" | "CANCELLED";

export interface FinancialEntryDto {
  id: string;
  direction: FinancialDirection;
  description: string;
  amount: string;
  dueDate: string;
  status: FinancialStatus;
  paidAt: string | null;
  cancelReason: string | null;
  clientId: string | null;
  supplierId: string | null;
  categoryId: string | null;
  origin: "MANUAL" | "SALE" | "SUBSCRIPTION";
  originId: string | null;
  cashMovementId: string | null;
  clientRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
}

export interface FinancialListResponse {
  items: FinancialEntryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FinancialSummaryDto {
  openPayablesTotal: string;
  openPayablesCount: number;
  openReceivablesTotal: string;
  openReceivablesCount: number;
  overduePayablesTotal: string;
  overduePayablesCount: number;
  overdueReceivablesTotal: string;
  overdueReceivablesCount: number;
  paidOutTotal: string;
  paidOutCount: number;
  paidInTotal: string;
  paidInCount: number;
  cancelledCount: number;
}

export type BusinessModule =
  | "APPOINTMENTS"
  | "SERVICES"
  | "WHATSAPP"
  | "SUBSCRIPTIONS"
  | "COMMISSIONS"
  | "CREDIT"
  | "SERVICE_ORDERS"
  | "FISCAL"
  | "ADS";

export type CompanyModuleStatus = "ACTIVE" | "DISABLED";

export type OnboardingSegment = "COMERCIO" | "SERVICOS" | "HIBRIDO" | "PERSONALIZADO";

export interface OnboardingPresetDto {
  slug: OnboardingSegment;
  name: string;
  description: string;
  defaultModules: BusinessModule[];
  defaultFiscalEnabled: boolean;
}

export interface OnboardingStatusDto {
  segment: OnboardingSegment | null;
  completed: boolean;
  completedAt: string | null;
}

export interface CompanyModuleDto {
  module: BusinessModule;
  status: CompanyModuleStatus;
  label: string;
  /** Kits (Fase 8b): contratado (no teste/isenta, todos) */
  entitled: boolean;
}

export type ImportType = "CATEGORY" | "SUPPLIER" | "PRODUCT" | "CLIENT" | "SERVICE";

export const importTypeLabels: Record<ImportType, string> = {
  CATEGORY: "Categorias",
  SUPPLIER: "Fornecedores",
  PRODUCT: "Produtos",
  CLIENT: "Clientes",
  SERVICE: "Serviços",
};

export interface ImportErrorDetail {
  row: number;
  message: string;
}

export interface ImportReport {
  dryRun: boolean;
  batchId: string | null;
  type: ImportType;
  filename: string;
  totalRows: number;
  created: number;
  skipped: number;
  errors: number;
  errorDetails: ImportErrorDetail[];
}

export interface ImportBatchDto {
  id: string;
  type: ImportType;
  status: "COMPLETED" | "FAILED";
  filename: string;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  createdByName: string;
  createdAt: string;
}

// Fase 2 · 2.1 — Comissões

export interface ProfessionalDto {
  id: string;
  name: string;
  document: string | null;
  commissionDefault: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export type ReleasePolicy = "ON_SALE" | "ON_PAYMENT" | "SPLIT_50_50";
export type CommissionStatus = "PENDING" | "RELEASED" | "PAID" | "CANCELLED";

export interface CommissionRuleDto {
  id: string;
  percentage: string;
  releasePolicy: ReleasePolicy;
  active: boolean;
  createdAt: string;
  professional: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

export interface CommissionLineDto {
  saleItemId: string;
  productName: string;
  base: string;
  percentage: string;
  amount: string;
  ruleId: string | null;
  source: string;
}

export interface CommissionDto {
  id: string;
  baseAmount: string;
  percentage: string;
  amount: string;
  releasePolicy: ReleasePolicy;
  status: CommissionStatus;
  lines: CommissionLineDto[];
  releasedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  professional: { id: string; name: string };
  sale: { id: string; receiptCode: string; total: string; createdAt: string } | null;
}

export interface CommissionListDto extends Paginated<CommissionDto> {
  totals: { amount: string; baseAmount: string };
}

export interface CommissionSummaryDto {
  items: Array<{
    professionalId: string;
    name: string;
    pending: string;
    released: string;
    paid: string;
    cancelled: string;
    toPay: string;
    count: number;
  }>;
  totals: { pending: string; released: string; paid: string; cancelled: string };
}

// Fase 2 · 2.2 — Crediário

export type CreditInstallmentStatus = "OPEN" | "PAID" | "OVERDUE" | "CANCELLED" | "REFUNDED";

export interface CreditInstallmentDto {
  id: string;
  number: number;
  totalInstallments: number;
  dueDate: string;
  amount: string;
  status: CreditInstallmentStatus;
  paidAt: string | null;
  cancelledAt: string | null;
  sale: { id: string; receiptCode: string };
  client: { id: string; name: string };
}

export interface CreditAccountDto {
  id: string;
  creditLimit: string;
  balance: string;
  available: string;
  overdue: string;
  status: "ACTIVE" | "BLOCKED";
  client: { id: string; name: string; phone: string | null };
}

export interface CreditAccountListDto extends Paginated<CreditAccountDto> {
  totals: { receivable: string; overdue: string; overdueCount: number };
}

export interface CreditAccountDetailDto extends CreditAccountDto {
  installments: CreditInstallmentDto[];
}

// Fase 2 · 2.3 — Ordem de serviço

export type ServiceOrderStatus = "DRAFT" | "QUOTE" | "APPROVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const serviceOrderStatusLabels: Record<ServiceOrderStatus, string> = {
  DRAFT: "Rascunho",
  QUOTE: "Orçamento",
  APPROVED: "Aprovada",
  IN_PROGRESS: "Em execução",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export interface ServiceOrderItemDto {
  id: string;
  serviceId: string | null;
  productId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
}

export interface ServiceOrderAttachmentDto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface ServiceOrderDto {
  id: string;
  number: number;
  code: string;
  status: ServiceOrderStatus;
  title: string;
  notes: string | null;
  subtotal: string;
  discount: string;
  total: string;
  openedAt: string;
  quotedAt: string | null;
  approvedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  financialEntryId: string | null;
  client: { id: string; name: string; phone: string | null; mobile: string | null };
  professional: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  items: ServiceOrderItemDto[];
  attachments: ServiceOrderAttachmentDto[];
}

export interface ServiceOrderListDto extends Paginated<ServiceOrderDto> {
  countsByStatus: Partial<Record<ServiceOrderStatus, number>>;
}

// Fase 3 — Fiscal

export type FiscalDocumentType = "NFE" | "NFCE" | "NFSE";
export type FiscalDocumentStatus = "PENDING" | "AUTHORIZED" | "REJECTED" | "CANCELLED";

export const fiscalTypeLabels: Record<FiscalDocumentType, string> = { NFE: "NF-e", NFCE: "NFC-e", NFSE: "NFS-e" };
export const fiscalStatusLabels: Record<FiscalDocumentStatus, string> = {
  PENDING: "Processando",
  AUTHORIZED: "Autorizada",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
};

export interface FiscalDocumentDto {
  id: string;
  type: FiscalDocumentType;
  status: FiscalDocumentStatus;
  environment: "HOMOLOGATION" | "PRODUCTION";
  number: number;
  series: number;
  amount: string;
  accessKey: string | null;
  protocol: string | null;
  danfeUrl: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  rejectionReason: string | null;
  createdAt: string;
  hasXml?: boolean;
  sale: { id: string; receiptCode: string } | null;
  serviceOrder: { id: string; number: number } | null;
  requestedBy: { id: string; name: string };
}

export interface FiscalStatusDto {
  active: boolean;
  environment: "HOMOLOGATION" | "PRODUCTION";
  simulated: boolean;
}

export interface FiscalConfigDto extends FiscalStatusDto {
  provider: string;
  cnpj: string | null;
  nfceSeries: number;
  nfeSeries: number;
  hasApiToken: boolean;
  certificate: { uploaded: boolean; subject: string | null; validTo: string | null };
}

// ---------------------------------------------------------------------------
// Transformação 2026-10-23 — clientes e produtos digitais
// ---------------------------------------------------------------------------

export type {
  BillingActionDto,
  BillingSettingsDto,
  BillingState,
  BillingStatusDto,
  BillingTextKey,
  ClientHistoryItemDto,
  ContractReceivableDto,
  CredentialAccessLogDto,
  DigitalReportsDto,
  DeliveryCredentialDto,
  DeliveryStatus,
  DigitalBillingPeriod,
  DigitalOverviewDto,
  DigitalProductType,
  OverduePolicyDto,
  SiteCheckDto,
  SiteStatus,
} from "@petflow/shared";
export {
  BILLING_TEXT_VARIABLES,
  billingActionLabels,
  billingStateLabels,
  DEFAULT_BILLING_TEXTS,
  renderBillingText,
  credentialActionLabels,
  deliveryStatusLabels,
  digitalBillingPeriodLabels,
  digitalProductTypeLabels,
} from "@petflow/shared";

export interface DigitalProductDto {
  id: string;
  name: string;
  type: DigitalProductType;
  description: string | null;
  defaultPrice: string;
  billingPeriod: DigitalBillingPeriod;
  status: RecordStatus;
  deliveriesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryDto {
  id: string;
  clientId: string;
  productId: string | null;
  name: string;
  type: DigitalProductType;
  siteUrl: string | null;
  adminUrl: string | null;
  repositoryUrl: string | null;
  domain: string | null;
  domainRenewalAt: string | null;
  hostingProvider: string | null;
  hostingRenewalAt: string | null;
  notes: string | null;
  status: DeliveryStatus;
  neverPause: boolean;
  monitorEnabled: boolean;
  monitorStatus: "UP" | "DOWN" | null;
  monitorHttpStatus: number | null;
  monitorResponseMs: number | null;
  monitorCheckedAt: string | null;
  monitorDownSince: string | null;
  /** 2026-10-27: controle de pausa */
  showWarningBanner: boolean;
  pausedForDebt: boolean;
  statusChangedAt: string | null;
  hasInstallCode: boolean;
  billing: BillingStatusDto | null;
  contractsCount: number;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
  product: { id: string; name: string } | null;
}

// 2026-10-29 — gestão de anúncios (fases A1 e A2)
export type {
  AdAccountDto,
  AdCampaignDetailDto,
  AdCampaignDto,
  AdCampaignListItemDto,
  AdCampaignLogDto,
  AdCampaignStatus,
  AdClientSummaryDto,
  AdImportReportDto,
  AdIndicatorsDto,
  AdLinkDto,
  AdLogAction,
  AdMetricDayDto,
  AdMetricSource,
  AdObjective,
  AdOverviewDto,
  AdPlatform,
} from "@petflow/shared";
export {
  adCampaignStatusLabels,
  adLogActionLabels,
  adMetricSourceLabels,
  adObjectiveLabels,
  adObjectiveResultLabels,
  adPlatformLabels,
} from "@petflow/shared";
