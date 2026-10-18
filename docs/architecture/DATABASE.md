# Banco de dados — diretrizes e modelo atual

## Modelos implementados (Fase 2 · 2.2 — Crediário)

Migration: `20261018170000_credit` (aditiva + RLS nas 2 tabelas novas).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `CreditAccount` | `companyId`, `clientId` (**único**: um crediário por cliente), `creditLimit`, `balance` (saldo em aberto, mantido na transação), `status` (`ACTIVE`/`BLOCKED`) | índice `[companyId, status]` |
| `CreditInstallment` | `companyId`, `creditAccountId`, `saleId`, `number`, `totalInstallments`, `dueDate`, `amount`, `status` (`OPEN`/`PAID`/`OVERDUE`/`CANCELLED`), `paidAt?`, `cancelledAt?`, `financialEntryId?` (único) | único `[saleId, number]`; índices `[companyId, status, dueDate]`, `[creditAccountId, status]` |

Alterações aditivas: `PaymentMethod` ganha `CREDIARIO`, `FinancialOrigin`
ganha `CREDIT_SALE` e `BusinessModule` ganha `CREDIT`. Todas as FKs são
`Restrict`; nada é apagado (parcela cancelada fica com histórico).

## Modelos implementados (Fase 2 · 2.1 — Comissões)

Migration: `20261018150000_commissions` (aditiva + RLS nas 3 tabelas novas).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `Professional` | `companyId`, `name`, `nameKey`, `document?`, `commissionDefault Decimal(5,2)?`, `status RecordStatus` | único `[companyId, nameKey]`; índice `[companyId, status]` |
| `CommissionRule` | `companyId`, `professionalId?`, `productId?`, `categoryId?`, `percentage Decimal(5,2)`, `releasePolicy`, `active` | índices `[companyId, active]`, `[companyId, professionalId]` |
| `Commission` | `companyId`, `saleId?`, `professionalId`, `baseAmount`, `percentage Decimal(5,2)` (efetivo), `amount`, `releasePolicy`, `status`, `lines Json`, `releasedAt?`, `paidAt?`, `cancelledAt?`, `cancelReason?`, `financialEntryId?` (único), `reversalEntryId?` (único) | único `[saleId, professionalId]`; índices `[companyId, status, createdAt]`, `[companyId, professionalId, createdAt]` |

Todas as FKs são `Restrict`. Profissional, regra e comissão nunca são
apagados (status/`active`/cancelamento).

Alterações aditivas:

| Modelo/enum | Alteração |
|---|---|
| `Sale` | `professionalId?` (FK `Restrict`) + índice `[companyId, professionalId]` |
| `FinancialOrigin` | `COMMISSION`, `COMMISSION_REVERSAL` |
| `BusinessModule` | `COMMISSIONS` |
| enums novos | `ReleasePolicy` (`ON_SALE`, `ON_PAYMENT`, `SPLIT_50_50`), `CommissionStatus` (`PENDING`, `RELEASED`, `PAID`, `CANCELLED`) |

## Row-Level Security (Fase 1 · 1E)

Migration: `20261018120000_row_level_security`. Detalhes e limites em
[`ADR-0001`](ADR-0001-tenant-defense.md).

- **Tabelas:** as 24 com `companyId` e mais `Company` (por `id`), todas com
  `ENABLE` + `FORCE ROW LEVEL SECURITY` e a política `tenant_isolation`.
- **Visível/gravável** quando `app.company_id` = `companyId` da linha ou
  `app.rls_bypass = 'on'`, definidos por transação (`set_config(..., true)`).
  Sem nenhum dos dois, a conexão não vê nada.
- **API:** `PrismaService` (extensões `tenantGuardExtension` +
  `rlsExtension` + `withRlsTransactions`). **Sistema:** `systemDatabaseUrl()`
  (worker, CLI) e `PGOPTIONS` no backup (`pg_dump --enable-row-security`).
- **Regras para mudanças futuras:**
  1. Tabela nova com `companyId` recebe a política na mesma migration.
  2. Migration com DML começa com `SET LOCAL app.rls_bypass = 'on';`,
     senão o `UPDATE` afeta 0 linhas sem dar erro.
  3. Nunca rode a aplicação com role superusuário ou `BYPASSRLS`, porque
     isso desliga a RLS sem aviso.

## Modelos implementados (Fase 1 · 1D — verificação de e-mail)

Migration: `database/prisma/migrations/20261018090000_email_verification`
(aditiva: 1 valor de enum, 1 coluna opcional, 1 tabela nova).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `EmailVerificationToken` | `userId` (FK `Cascade`), `tokenHash` (SHA-256 do token; o bruto nunca é gravado), `expiresAt`, `usedAt?`, `createdAt` | `tokenHash` único; índices `[userId]`, `[expiresAt]` |

Alterações aditivas em modelos existentes:

| Modelo | Alteração | Observação |
|---|---|---|
| `CompanyStatus` (enum) | novo valor `PENDING_VERIFICATION` | empresa do cadastro aberto até o e-mail ser confirmado. Login e `AuthGuard` exigem `ACTIVE`, então nada fica acessível antes |
| `User` | `emailVerifiedAt DateTime?` | a migration preenche com `createdAt` os usuários existentes (criados por bootstrap/admin) |

Regras derivadas:

- Token de uso único, consumido com `updateMany` condicional (`usedAt IS
  NULL`), o que evita ativação dupla em cliques simultâneos.
- Reenviar o link marca os tokens anteriores como usados (só o último vale).
- Mesmo padrão já usado em `PasswordResetToken` (N4).

## Modelos de segurança e LGPD (N1–N4, 2026-10-15) — registro

| Modelo/campo | Migration | Função |
|---|---|---|
| `LegalConsent` | `20261015120000_lgpd_consent` | aceite de termos/privacidade (usuário e cliente) com versão e data |
| `PasswordResetToken` | `20261015140000_password_reset_token` | redefinição de senha por token de e-mail (hash SHA-256, 1 h, uso único) |
| `User.twoFactorSecret`, `User.twoFactorEnabled` | `20261015160000_two_factor` | 2FA TOTP para ADMIN |

## Modelos implementados (Importação de planilhas — Akylla Gestão)

Migration: `database/prisma/migrations/20261014114855_import_batch`
(aditiva — 2 enums novos e 1 tabela nova; não altera nem remove dados
existentes). Decisões D1–D8 de `docs/akylla/PLANO_IMPORTACAO.md`
aprovadas pelo proprietário.

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `ImportBatch` | `companyId` (FK `Restrict`), `type` (enum `ImportType`), `status` (enum `ImportStatus`, default `COMPLETED`), `filename`, `createdCount`/`skippedCount`/`errorCount` (default 0), `errors Json?` (até 100 `errorDetails`), `createdByUserId` (FK `Restrict`), `createdAt` | índice `[companyId, createdAt]` |

Enums novos:

- `ImportType`: `CATEGORY`, `SUPPLIER`, `PRODUCT`, `CLIENT`, `SERVICE`
  — as 5 entidades da decisão D1.
- `ImportStatus`: `COMPLETED`, `FAILED`.

Alterações aditivas em modelos existentes:

| Modelo | Alteração | Observação |
|---|---|---|
| `Company`, `User` | relações `importBatches` | autor da importação não pode ser apagado (`Restrict`) |
| `tests/helpers/app.ts` | `resetDatabase` apaga `ImportBatch` antes de `user` | FK `Restrict` em `createdByUserId` |

Regras derivadas:

- Um lote inteiro roda numa transação: falha → rollback e nenhum dado
  entra; a linha `FAILED` é gravada **fora** da transação.
- `dryRun` (query/`?dryRun=`) valida e reporta sem persistir nada —
  inclusive sem criar `ImportBatch`.
- Duplicidade por tipo (skip com aviso): `CATEGORY` por `nameKey`
  (minúsculas), `SUPPLIER` por nome normalizado, `PRODUCT` por SKU ou
  código de barras (nome não bloqueia — consistente com o sistema),
  `CLIENT` por `nameKey`, `SERVICE` por `nameKey`.
- Estoque inicial (`saldoinicial > 0`) cria/ajusta o produto e grava
  `StockMovement` `IN` (notes "Estoque inicial (importação)").

## Modelos implementados (Etapa 10 — Akylla Gestão: módulos por empresa)

Migration: `database/prisma/migrations/20261012154010_company_module`
(aditiva — 2 enums novos e 1 tabela nova; não altera nem remove dados
existentes). Decisão D3 do roteiro Akylla (opção B aprovada pelo
proprietário).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `CompanyModule` | `companyId` (FK → `Company`, `Cascade`), `module` (enum `BusinessModule`), `status` (enum `CompanyModuleStatus`, default `ACTIVE`), timestamps | `@@unique([companyId, module])`, índice `[companyId]` |

Enums novos:

- `BusinessModule`: `PETS`, `APPOINTMENTS`, `SERVICES`, `WHATSAPP`,
  `SUBSCRIPTIONS` — apenas módulos desativáveis; o núcleo (clientes,
  produtos, vendas, caixa, financeiro, relatórios, billing) não consta e
  nunca é desativável.
- `CompanyModuleStatus`: `ACTIVE`, `DISABLED`.

**Semântica:** ausência de linha = módulo **ativo** (padrão — todas as
empresas existentes seguem funcionando sem seed). Linha gravada registra
o estado explícito; `DISABLED` bloqueia as rotas do módulo no servidor
(`ModuleGuard`, `apps/api/src/common/guards/module.guard.ts`).
`tests/helpers/app.ts` apaga `companyModule` antes de `company`.

## Modelos implementados (Etapa 8 — Akylla Gestão: financeiro básico)

Migration: `database/prisma/migrations/20261012164040_financial_entry`
(aditiva — 3 enums novos, tabela nova e valor novo em enum existente;
não altera nem remove dados existentes).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `FinancialEntry` | `companyId` (FK `Restrict`), `direction` (enum `FinancialDirection`), `description`, `amount Decimal @db.Decimal(12, 2)`, `dueDate DateTime`, `status` (enum `FinancialStatus`, default `OPEN`), `paidAt?`, `cancelReason?`, `clientId?`/`supplierId?`/`categoryId?` (FK `SetNull`), `origin` (enum `FinancialOrigin`, default `MANUAL`) + `originId?`, `cashMovementId?` (FK → `CashMovement`, `SetNull`), `clientRequestId?`, `createdByUserId` (FK `Restrict`), timestamps | `@@unique([companyId, origin, originId])`, `@@unique([companyId, clientRequestId])` (idempotência); índices `[companyId, status, dueDate]`, `[companyId, direction, status, dueDate]`, `[companyId, clientId]`, `[companyId, supplierId]` |

Enums novos:

- `FinancialDirection`: `PAYABLE` (a pagar), `RECEIVABLE` (a receber) —
  **decisão D1**: um único modelo com `direction` em vez de dois.
- `FinancialStatus`: `OPEN`, `PAID`, `CANCELLED` (transições só no
  servidor; `OVERDUE` é derivado de `dueDate < now` e nunca armazenado).
- `FinancialOrigin`: `MANUAL`, `SALE`, `SUBSCRIPTION` (vendas viram
  título liquidado ao criar — **decisão D2** —, assinaturas manuais
  quando não pagas na hora).

Alterações aditivas em modelos existentes:

| Modelo | Alteração | Observação |
|---|---|---|
| `CashMovementOrigin` | ganha o valor `ACCOUNT` (**decisão D3**) | liquidação de título cria movimento de caixa `IN`/`OUT` com `origin: "ACCOUNT"`, `inCash: true` |
| `cashMovementOriginSchema` (`@petflow/shared`) | enum Zod e labels ganham `ACCOUNT` ("Liquidação de título") | usado pelos filtros da UI e pelos relatórios (`byOrigin`) |
| `Company`, `Category`, `Supplier`, `Client`, `CashMovement` | relações `financialEntries` (`SetNull` nas contrapartes) | contraparte excluída não apaga o histórico financeiro |
| `User` | relação `financialEntriesCreated` (`Restrict`) | autor do título não pode ser apagado |
| `tests/helpers/app.ts` | `resetDatabase` apaga `FinancialEntry` antes de `user` | FK `Restrict` em `createdByUserId` |

Regras derivadas:

- `amount` é calculado/validado no servidor (Zod `positivePriceFieldSchema`,
  2 casas, `> 0`); DTOs sempre retornam `toFixed(2)`.
- `clientRequestId` + `@@unique([companyId, clientRequestId])` dão
  idempotência de criação (colisão `P2002` → HTTP 409).
- `pay` (transação): `OPEN → PAID` + `lockOpenCashSession` + cria
  `CashMovement` (`ACCOUNT`, `IN` se `RECEIVABLE`/`OUT` se `PAYABLE`) +
  grava `cashMovementId` no título.
- `reverse` (admin): `PAID → OPEN`, marca o movimento original com
  `reversedAt`/`reversalReason` e cria movimento `REVERSAL`
  compensatório na mesma sessão de caixa; a sessão precisa estar aberta.
- `cancel` (admin): `OPEN → CANCELLED` com motivo obrigatório; não
  altera caixa (nunca houve liquidação).

## Modelos implementados (Etapa 9)

Migration: `database/prisma/migrations/20261010131027_etapa9_subscriptions`
(aditiva — cria enums/tabelas e uma coluna com FK `SetNull`; não
altera nem remove dados existentes; inclui seed dos `TenantPlan`
iniciais).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `SubscriptionPlan` | `companyId` (FK `Restrict`), `name`, `nameKey`, `description?`, `price Decimal`, `durationDays Int` (1..3650), `status` (`RecordStatus`), `createdByUserId` (FK `Restrict`), timestamps | `@@unique([companyId, nameKey])` (nome único por empresa, case-insensitive) |
| `Subscription` | `companyId` (FK `Restrict`), `clientId` (FK `Restrict`), `planId` (FK `Restrict`), `startAt`, `endAt`, `status` (enum `SubscriptionStatus`, default `ACTIVE`), `cancelReason?`, `cancelledAt?`, `cancelledByUserId?` (FK `SetNull`), `renewalCount Int @default(0)`, `lastPaymentAt?`, `createdByUserId` (FK `Restrict`), timestamps | índices `[companyId, status]`, `[companyId, endAt]`, `[clientId]`; sem unique — assinaturas ativas múltiplas por cliente são permitidas |
| `TenantPlan` | `name`, `description?`, `priceMonthly Decimal`, `durationDays Int`, `userLimit Int?`, `clientLimit Int?`, `productLimit Int?`, `active Boolean`, timestamps (**global — sem `companyId`**) | `name @unique`; seed na própria migration (ids fixos `tenantplan_essencial`/`_profissional`/`_completo`); limites `NULL` = ilimitado (Etapa 11, decisão D2) |
| `TenantSubscription` | `companyId` **@unique** (FK `Restrict`), `planId` (FK `Restrict`), `status` (enum `TenantSubscriptionStatus`, default `ACTIVE`), `currentPeriodStart`, `currentPeriodEnd`, `cancelReason?`, `cancelledAt?`, `changedByUserId?` (FK `SetNull`), `gateway?`, `gatewaySubscriptionId? @unique`, timestamps | **global — exceção documentável** à regra "todo modelo tem companyId": catálogo é da plataforma, uma assinatura por empresa; campos `gateway`/`gatewaySubscriptionId` ligam ao Mercado Pago (Etapa 11, decisão D4) |

Enums novos:

- `SubscriptionStatus` / `TenantSubscriptionStatus`: `ACTIVE`,
  `EXPIRED`, `CANCELLED` (expiração aplicada com *lazy update* nas
  leituras, não por job).

Alterações aditivas em modelos existentes:

| Modelo | Campo adicionado | Observação |
|---|---|---|
| `CashMovement` | `subscriptionId String?` (FK → `Subscription`, `SetNull`) | Vincula pagamento/renovação de assinatura ao caixa; índice `[companyId, subscriptionId]` |

Regras derivadas:

- Pagamentos/renovações sempre criam `CashMovement` `IN` com
  `inCash: true` e origem `MANUAL` dentro da mesma transação que
  grava a assinatura, após o lock da sessão de caixa (`SetNull` no
  FK porque cancelar apagando o vínculo não pode quebrar o caixa).
- `TenantPlan`/`TenantSubscription` não têm `companyId` (decisão
  registrada): o catálogo é global e a assinatura do tenant é única
  por empresa via `companyId @unique`.
- Relações novas em `Company` (`tenantSubscriptions`), `Client`
  (`subscriptions`), `User` (`subscriptionPlansCreated`,
  `subscriptionsCreated/cancelled`, `tenantSubscriptionsChanged`).

## Modelos implementados (Etapa 8)

Migration: `database/prisma/migrations/20261010115308_etapa8_appointments`
(aditiva — cria enum/tabela e adiciona colunas; não altera nem remove
dados existentes).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `Appointment` | `companyId` (FK `Restrict`), `clientId` (FK `Restrict`), `petId?` (FK `Restrict`, **opcional**), `serviceId` (FK `Restrict`), `startAt` `DateTime`, `endAt` `DateTime`, `startLocal` `String` (hora de parede `YYYY-MM-DDTHH:mm`), `durationMinutes` `Int`, `status` (enum `AppointmentStatus`, default `SCHEDULED`), `notes?`, `cancelReason?`, `cancelledAt?`, `cancelledByUserId?` (FK `SetNull`), `createdByUserId` (FK `Restrict`), timestamps | índices `[companyId, startLocal]` (visão por dia), `[companyId, status, startAt]` (conflito/relatórios), `[clientId]`, `[petId]`; sem unique de conflito — checagem em transação com `FOR UPDATE` na `Company` |

Enums novos:

- `AppointmentStatus`: `SCHEDULED`, `CONFIRMED`, `COMPLETED`,
  `CANCELLED`, `NO_SHOW`.
- `WhatsAppMessageOrigin` ganha `SERVICE_REMINDER` (lembrete de
  agendamento; `MANUAL`/`AUTOMATED` permanecem).

Alterações aditivas em modelos existentes:

| Modelo | Campo adicionado | Observação |
|---|---|---|
| `WhatsAppConfig` | `reminderTemplateId String?` (FK → `WhatsAppTemplate`, `SetNull`) | Template usado nos lembretes; `reminderConfigs` no template |
| `WhatsAppConfig` | `reminderLeadMinutes Int @default(1440)` | Antecedência em minutos (5..40320 validados no Zod) |

Regras derivadas:

- `startAt`/`endAt` são **derivados no servidor** de `startLocal` +
  `utcOffsetMinutes` (leste-positivo) + `durationMinutes` do serviço;
  `startLocal` fica gravado para a visão de dia sem depender de fuso.
- Conflito de horário da empresa inteira é garantido em transação
  (trava na `Company`), não por unique — fim-início exato é válido e
  status terminal/cancelado não bloqueia.
- `cancelledByUserId`/`cancelledBy` usam `SetNull` (cancelamento não
  depende do usuário permanecer ativo); `createdByUserId` é
  obrigatório (`Restrict`).

## Modelos implementados (Etapa 7)

Migration: `database/prisma/migrations/20261010002727_etapa7_report_indexes`
(aditiva — apenas índices; não altera nem remove dados existentes).

A Etapa 7 (dashboard/relatórios) **não cria modelos novos**: ela agrega
dados já existentes das Etapas 1–6. A mudança de schema foi limitada
aos índices que sustentam as consultas por período:

| Modelo | Índice adicionado | Justificativa |
|---|---|---|
| `Client` | `@@index([companyId, createdAt])` | Relatórios de clientes novos por período (`WHERE companyId = ? AND createdAt BETWEEN from AND to`). |
| `Pet` | `@@index([companyId, createdAt])` | Contagem de pets novos por período no resumo e no relatório de clientes. |

- Demais agregações (vendas, movimentos de estoque e caixa,
  mensagens WhatsApp) usam índices `(companyId, createdAt)` ou de
  filtro já existentes desde as Etapas 2–6 — nenhuma duplicação foi
  criada.
- Consultas de alta frequência com agregação (`SUM`/`COUNT` por dia,
  por tipo e por status) rodam em SQL puro no servidor, sempre com
  `companyId` no `WHERE`; tabelas são referenciadas com aspas no
  padrão PascalCase do Prisma (`"Sale"`, `"Product"`).

## Modelos implementados (Etapa 6)

Migration: `database/prisma/migrations/20261009232055_etapa6_whatsapp_integration`
(aditiva — não altera nem remove dados existentes).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `WhatsAppConfig` | `companyId` (FK `Restrict`, **única por empresa**), `provider` (default `meta`), `phoneNumberId?`, `wabaId?`, `displayName?`, `accessToken?`, `verifyToken?`, `appSecret?`, `apiVersion` (default `v21.0`), `countryCode` (default `55`), `status` (enum `WhatsAppConfigStatus`), timestamps | `(companyId)` único; credenciais somente servidor (nunca retornadas pela API); status `DISCONNECTED` bloqueia envios |
| `WhatsAppTemplate` | `companyId` (FK `Restrict`), `name`, `category` (enum `WhatsAppTemplateCategory`), `body`, `language` (`pt_BR`, `en_US`…), `variablesCount` `Int`, `status` (enum `WhatsAppTemplateStatus`), `createdByUserId` (FK `Restrict`), timestamps | `(companyId, name)` único; `variablesCount` derivado do corpo (`{{n}}`) no servidor; envio exige `APPROVED` |
| `WhatsAppConsent` | `companyId` (FK `Restrict`), `clientId` (FK `Restrict`), `phone` (E.164), `status` (enum `WhatsAppConsentStatus`), `source` (enum `WhatsAppConsentSource`), `changedByUserId?` (FK `SetNull`), timestamps | único `(companyId, clientId)`; máquina de estados auditável (`OPTED_IN`/`OPTED_OUT`); origem `REPLY` vem do webhook |
| `WhatsAppMessage` | `companyId` (FK `Restrict`), `clientId` (FK `Restrict`), `templateId` (FK `Restrict`), `phone`, `variables` `Json?`, `status` (enum `WhatsAppMessageStatus`), `origin` (enum `WhatsAppMessageOrigin`), `clientRequestId?`, `wamid?`, `providerMessageId?`, `failureReason?`, `failureCode?`, `maxAttempts` (default 3), `attemptCount`, `nextAttemptAt?`, `lastAttemptAt?`, `sentAt?`, `deliveredAt?`, `readAt?`, `failedAt?`, `cancelledAt?`, `cancelledByUserId?` (FK `SetNull`), `createdByUserId?` (FK `Restrict`), timestamps | únicos `(companyId, clientRequestId)` e `(companyId, wamid)` (NULLs não conflitam); índices `(companyId, status, nextAttemptAt)` (fila), `(companyId, createdAt)`, `(clientId)`; fila = `PENDING`/`RETRY` com `nextAttemptAt <= now` |
| `WhatsAppSendAttempt` | `companyId` (FK `Restrict`), `messageId` (FK `Restrict`), `attemptNumber` `Int`, `status` (enum `WhatsAppMessageStatus`), `result` (enum `WhatsAppAttemptResult`), `httpStatus?`, `providerMessageId?`, `error?`, `startedAt`, `finishedAt?` | único `(messageId, attemptNumber)`; histórico imutável de cada tentativa (backoff auditável) |
| `WhatsAppWebhookEvent` | `companyId` (FK `Restrict`), `wamid` (FK `Restrict` → `WhatsAppMessage`), `type` (enum `WhatsAppWebhookEventType`), `payload` `Json`, `processedAt` | único `(wamid, type)` — **idempotência** do webhook (reentrega da Meta nunca duplica efeito) |

Enums novos:

- `WhatsAppConfigStatus`: `PENDING`, `ACTIVE`, `DISCONNECTED`.
- `WhatsAppTemplateStatus`: `PENDING`, `APPROVED`, `REJECTED`, `DISABLED`.
- `WhatsAppTemplateCategory`: `MARKETING`, `UTILITY`, `AUTHENTICATION`.
- `WhatsAppConsentStatus`: `OPTED_IN`, `OPTED_OUT`.
- `WhatsAppConsentSource`: `MANUAL`, `IMPORT`, `WEBHOOK`, `REPLY`.
- `WhatsAppMessageStatus`: `PENDING`, `SENDING`, `ACCEPTED`, `SENT`,
  `DELIVERED`, `READ`, `RETRY`, `FAILED`, `CANCELLED`.
- `WhatsAppMessageOrigin`: `MANUAL`, `AUTOMATED`.
- `WhatsAppAttemptResult`: `SUCCESS`, `TRANSIENT_ERROR`,
  `PERMANENT_ERROR`.
- `WhatsAppWebhookEventType`: `SENT`, `DELIVERED`, `READ`, `FAILED`,
  `REPLY`.

Regras derivadas:

- **Envio nunca começa no banco do usuário**: enfileirar grava
  `PENDING` + `nextAttemptAt`; o worker (`apps/worker`) faz claim
  atômico (`updateMany` `PENDING/RETRY → SENDING`), envia via
  provedor e grava `WhatsAppSendAttempt` + transição de status na mesma
  transação.
- Backoff exponencial: `nextAttemptAt = now + 5s · 2^attempt` (cap
  300s); `attemptCount >= maxAttempts` → `FAILED` (nunca reprograma).
- Sem consentimento `OPTED_IN` ou config `DISCONNECTED` → mensagem vira
  `CANCELLED` (motivo registrado), sem chamada ao provedor.
- Webhook idempotente por `(wamid, type)`; payloads brutos ficam em
  `WhatsAppWebhookEvent.payload` para auditoria.
- Histórico imutável: tentativas e eventos nunca são editados;
  cancelamento é transição própria (`CANCELLED` + motivo/autor).

## Modelos implementados (Etapa 5)

Migration: `database/prisma/migrations/20261009222638_etapa5_clients_pets_services`
(aditiva — não altera nem remove dados existentes).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `Client` | `companyId` (FK `Restrict`), `name`, `nameKey`, `phone?`, `mobile?`, `email?`, `cpf?`, endereço (`street?`, `number?`, `complement?`, `district?`, `city?`, `state?`, `zip?`), `notes?`, `status` (enum `RecordStatus`), timestamps, `pets`, `sales` | índices `(companyId, nameKey)`, `(companyId, status)`, `(companyId, name)`, `(companyId, phone)`, `(companyId, mobile)`, `(companyId, email)`; **sem unique** em `nameKey` — duplicidade é checada na aplicação (mesmo nome + contato igual com ativo → 409) |
| `Pet` | `companyId` (FK `Restrict`), `clientId` (FK `Restrict`), `name`, `species` (enum `PetSpecies`), `breed?`, `sex` (enum `PetSex`, default `UNKNOWN`), `birthDate?`, `weight?` `Decimal(6,2)`, `color?`, `notes?`, `status`, timestamps | índices `(companyId, status)`, `(companyId, name)`, `(clientId)`; responsável sempre da mesma empresa (validado na API) |
| `Service` | `companyId` (FK `Restrict`), `name`, `nameKey`, `description?`, `durationMinutes?` (`Int`), `price` `Decimal(12,2)`, `status`, timestamps | único `(companyId, nameKey)` (nome de catálogo único por empresa, case-insensitive); índices `(companyId, status)`, `(companyId, name)` |

Enums novos:

- `PetSpecies`: `DOG`, `CAT`, `BIRD`, `RODENT`, `REPTILE`, `FISH`, `OTHER`.
- `PetSex`: `MALE`, `FEMALE`, `UNKNOWN`.

Alteração em modelo existente:

- `Sale.clientId` (`String?`, FK → `Client`, `SetNull`, índice
  `(companyId, clientId)`): vínculo opcional da venda com o cliente;
  inativar/apagar cliente nunca quebra vendas antigas (snapshot dos itens
  permanece).

Regras derivadas:

- **Anti-duplicidade de cliente** (suave, documentado em
  `ClientsService`): `nameKey` = `nome.trim().toLowerCase()` com espaços
  colapsados; telefone armazenado só com dígitos, email em minúsculas
  (normalização feita no Zod compartilhado); o bloqueio 409 ocorre quando
  o `nameKey` coincide **e** algum contato (phone/mobile/email) também
  coincide com cliente `ACTIVE` — homônimos sem contato e famílias com
  mesmo telefone nunca bloqueiam; janela de corrida aceita (sem unique
  duro no banco).
- Nome de serviço é único por empresa via `nameKey` (mesmo padrão das
  categorias); preços `Decimal(12,2)` não negativos.
- Cliente/Pet com `status = INACTIVE` permanecem para histórico; pet de
  cliente inativo não pode ser criado (400), mas os existentes são
  preservados.

## Modelos implementados (Etapa 4)

Migration: `database/prisma/migrations/20261009212628_etapa4_cash_finance`.

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `CashSession` | `companyId` (FK `Restrict`), `status` (enum `CashSessionStatus`), `initialAmount` `Decimal(12,2)`, `openingNotes?`, `openedByUserId` (FK `Restrict`), `openedAt`, `closedAt?`, `closedByUserId?` (FK `SetNull`), `closingNotes?`, `countedAmount?`, `expectedAmount?`, `difference?` (`Decimal(12,2)`), `movements`, `sales` | índices `(companyId, status)` e `(companyId, openedAt)`; sem `updatedAt` — a sessão muda apenas na abertura/fechamento |
| `CashMovement` | `companyId` (FK `Restrict`), `cashSessionId` (FK `Restrict`), `type` (enum `CashMovementType`), `origin` (enum `CashMovementOrigin`), `inCash` `Boolean` (default `true`), `amount` `Decimal(12,2)`, `description`, `justification?`, `saleId?` (FK `Restrict`), `reversalOfId?` (auto-relação FK `Restrict`), `reversals`, `reversedAt?`, `reversedByUserId?` (FK `SetNull`), `reversalReason?`, `createdByUserId` (FK `Restrict`), `createdAt` | único `(origin, saleId)` (venda/cancelamento nunca duplicam lançamento; NULLs não conflitam); índices `(companyId, createdAt)`, `(companyId, cashSessionId)`, `(companyId, saleId)`; sem `updatedAt` — ledger imutável |

Enums novos:

- `CashSessionStatus`: `OPEN`, `CLOSED`.
- `CashMovementType`: `IN`, `OUT`.
- `CashMovementOrigin`: `MANUAL`, `SALE`, `SALE_CANCELMENT`, `REVERSAL`.

Alteração em modelo existente:

- `Sale.cashSessionId` (`String?`, FK → `CashSession`, `SetNull`): vincula a
  venda à sessão de caixa aberta no momento da venda; vendas anteriores à
  Etapa 4 ficam sem sessão/lançamento (dados de desenvolvimento).

Regras derivadas:

- **Uma única sessão `OPEN` por empresa**; serialização de abertura via
  `SELECT ... FOR UPDATE` na linha da `Company`.
- Saldos de caixa (`expectedAmount`, `difference`) calculados **somente no
  servidor** no fechamento: `inicial + Σ(IN inCash) − Σ(OUT inCash)`; a
  diferença é `contado − esperado`.
- `inCash` decide o que compõe o saldo físico: apenas venda com
  `paymentMethod = CASH` (e cancelamentos/estornos correspondentes) entra
  em entradas/saídas do caixa; CARD/PIX/OTHER geram lançamento com
  `inCash = false` (entram no resumo financeiro por origem/tipo).
- Venda e cancelamento criam **um único** lançamento (`origin = SALE` /
  `SALE_CANCELMENT`) na mesma transação, garantido também por
  `@@unique([origin, saleId])`.
- Estorno: apenas lançamentos `MANUAL` ainda não estornados; cria
  movimento compensatório (`origin = REVERSAL`, tipo oposto, mesma
  sessão) e marca o original (`reversedAt` via `updateMany` condicional —
  dupla corrida → 409); histórico nunca é apagado.
- Vendas/cancelamentos movimentações manuais exigem sessão `OPEN`
  (`SELECT ... FOR UPDATE` na sessão — lock de sessão **antes** dos
  produtos, ordem fixa, evita deadlock).

## Modelos implementados (Etapa 3)

Migration: `database/prisma/migrations/20261009205135_etapa3_sales_pdv`.

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `Sale` | `companyId` (FK `Restrict`), `receiptCode`, `clientRequestId?`, `status` (enum `SaleStatus`), `subtotal`/`discount`/`total` `Decimal(12,2)`, `paymentMethod` (enum `PaymentMethod`), `paymentNote?`, `createdByUserId` (FK `Restrict`), `cancelledAt?`, `cancelledByUserId?` (FK `SetNull`), `cancelReason?`, `createdAt`, `items` | únicos `(companyId, receiptCode)` e `(companyId, clientRequestId)` (NULLs não conflitam); índices `(companyId, createdAt)`, `(companyId, status)`; sem `updatedAt` — venda concluída só muda por cancelamento |
| `SaleItem` | `saleId` (FK `Restrict`), `productId` (FK `Restrict`), `productName`, `productSku?`, `unit` (enum `ProductUnit`), `unitPrice` `Decimal(12,2)`, `quantity` `Decimal(12,3)`, `subtotal` `Decimal(12,2)` | índice `(saleId)`; snapshot imutável de nome/SKU/unidade/preço no momento da venda |

Enums novos:

- `PaymentMethod`: `CASH`, `CARD`, `PIX`, `OTHER`.
- `SaleStatus`: `COMPLETED`, `CANCELLED` (cancelamento lógico — nenhuma
  exclusão física de venda ou item).

Regras derivadas:

- Preços e totais **recalculados no servidor** a partir de
  `Product.salePrice`; valores do cliente nunca entram na gravação.
- Criação da venda, itens, baixa de estoque e movimentos `OUT` ocorrem em
  **uma única transação**, com lock `FOR UPDATE` dos produtos em ordem
  de `id` (mesma regra de ordenação no cancelamento — evita deadlock).
- `clientRequestId` torna a criação **idempotente**: reenvio/duplo clique
  → 409, sem segunda venda nem dupla baixa.
- Cancelamento devolve estoque com movimentos `IN` usando
  `reference = receiptCode`; `updateMany({ status: COMPLETED })` garante
  devolução única (corrida entre cancelamentos → 409).

## Modelos implementados (Etapa 2)

Migration: `database/prisma/migrations/20261009194843_etapa2_products_stock`.

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `Category` | `companyId` (FK), `name`, `nameKey`, `description?`, `status` (enum `RecordStatus`), timestamps | único `(companyId, nameKey)` — `nameKey` = nome em minúsculas para unicidade case-insensitive |
| `Supplier` | `companyId` (FK), `name`, `document?`, `email?`, `phone?`, `notes?`, `status`, timestamps | índices `(companyId, status)`, `(companyId, name)`; CPF/CNPJ tratado como texto (validação de formato pendente) |
| `Product` | `companyId` (FK), `categoryId?` (FK `SetNull`), `supplierId?` (FK `SetNull`), `name`, `description?`, `sku?`, `barcode?`, `unit` (enum `ProductUnit`), `costPrice`/`salePrice` `Decimal(12,2)`, `stockQuantity`/`minimumStock` `Decimal(12,3)`, `status`, timestamps | únicos `(companyId, sku)` e `(companyId, barcode)` (NULLs não conflitam no Postgres); índices `(companyId, status)`, `(companyId, name)` |
| `StockMovement` | `companyId` (FK), `productId` (FK `Restrict`), `type` (enum `StockMovementType`), `quantity` `Decimal(12,3)`, `notes?`, `reference?`, `createdByUserId` (FK `Restrict`), `createdAt` | índices `(companyId, productId, createdAt)`, `(companyId, createdAt)`; sem `updatedAt` — histórico imutável |

Regras derivadas:

- **Saldo materializado** em `Product.stockQuantity`; entrada/saída/ajuste
  atualizam saldo e criam `StockMovement` na mesma transação, com lock
  pessimista (`SELECT ... FOR UPDATE`) por produto — movimentações
  concorrentes não geram saldo negativo ou divergente.
- Histórico **não editável** por operações comuns: não existem endpoints de
  update/delete de movimentos; correções são novos movimentos compensatórios.
- Alerta de estoque baixo: produto `ACTIVE` com `minimumStock > 0` e
  `stockQuantity <= minimumStock`.
- Unidades aceitas: `UNIDADE`, `KG`, `G`, `L`, `ML`, `CAIXA`, `PACOTE`,
  `ROLLO`; quantidades com até 3 casas decimais; preços com até 2, nunca
  negativos (validados também no Zod compartilhado).
- SKU é normalizado para maiúsculas; barcode e códigos vazios viram `NULL`.
- Nenhuma exclusão física de produto com movimentações: apenas inativação.

## Modelos implementados (Etapa 1)

Migration: `database/prisma/migrations/20261009185907_etapa1_auth_tenancy`
(aplicada em `petflow` e `petflow_test`).

| Modelo | Campos principais | Restrições/índices |
|---|---|---|
| `Company` | `id`, `name`, `slug`, `status` (enum), `createdAt`, `updatedAt` | `slug` único |
| `User` | `id`, `companyId` (FK → `Company`), `name`, `email`, `passwordHash`, `role` (enum `ADMIN`/`MEMBER`), `status` (enum `ACTIVE`/`INACTIVE`), timestamps | único `(companyId, email)`; email normalizado (trim+minúsculas) antes da validação; `onDelete: Restrict` |
| `Session` | `id`, `userId` (FK → `User`), `tokenHash` (SHA-256 do cookie), `expiresAt`, `createdAt` | `tokenHash` único; `userId` com cascade de exclusão lógica via revogação no logout/inativação; índices em `userId` e `expiresAt` |

Regras derivadas:

- Sessões nunca armazenam o token em texto puro; apenas o hash.
- Inativar usuário (`User.status = INACTIVE`) revoga suas sessões.
- Bootstrap (`npm run bootstrap:admin`) cria `Company` + `User` ADMIN de forma
  idempotente (checagem prévia por email/slug), via variáveis `BOOTSTRAP_*`.
- Nenhuma tabela de negócio fora do escopo da Etapa 1 foi criada.

## Isolamento multiempresa

- Toda entidade de negócio terá `companyId` obrigatório, com foreign key para a
  tabela `companies` e índice composto `(companyId, id)` ou equivalente.
- Todas as consultas da API serão filtradas por `companyId` do contexto
  autenticado (middleware/filtro de tenant).
- Identificadores externos (ex.: telefone no WhatsApp, código de produto) serão
  únicos dentro da empresa, não globalmente.
- Já implementado em `User`: unicidade de email por empresa e todos os
  accessos escopados pelo `companyId` da sessão autenticada.

## Integridade referencial

- Foreign keys explícitas com `onDelete` definido (evitar cascade amplo;
  preferir `RESTRICT` ou `SET NULL` conforme o caso).
- Soft delete (`deletedAt`) apenas quando houver necessidade real de histórico
  preservado; caso contrário, exclusão lógica por status.

## Histórico de movimentações

- Estoque, caixa e vendas terão tabelas de movimentação (ledger), nunca apenas
  "saldo" atual — permitindo auditoria e conciliação.
- Alterações críticas podem registrar `createdBy`/`updatedBy`.

## Valores monetários

- Valores em `Decimal(12, 2)` (colunas `DECIMAL`), nunca `FLOAT`.
- Quantidades de estoque em `Decimal(12, 3)` quando houver unidade fracionada.
- Datas e horários em UTC (`TIMESTAMP`); exibição no fuso local no frontend.

## Padrões de colunas

- IDs: `TEXT` (CUID) via Prisma ou `UUID`; decidir um padrão único por modelo.
- `createdAt` / `updatedAt` obrigatórios em toda tabela de negócio.
- Enums do Postgres para estados fechados (status de venda, tipo de
  movimentação), evitando strings livres.

## Migrations e dados iniciais

- Toda mudança de schema é migration versionada em `database/prisma/migrations/`.
- **Não há seed SQL.** Dados iniciais/demonstração são CLIs da API,
  idempotentes: `npm run bootstrap:admin` (admin via `BOOTSTRAP_*`) e
  `npm run db:seed:demo` (empresa piloto de demonstração).
- O schema é validado na CI/etapa com `npm run db:validate`.
