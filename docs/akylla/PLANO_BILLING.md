# Plano de billing e checklist de decisões comerciais (Etapa 11)

> **Entregável da Etapa 11** do roteiro
> `docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md`. Prepara a monetização sem
> simular integrações inexistentes. **Nenhuma cobrança ou limite é
> anunciado sem implementação comprovada** (critério da etapa).
>
> **Status (2026-10-12): decisões D1–D4 aprovadas e implementação
> concluída.** Ver CHANGELOG Etapa 11 para o detalhe do que foi
> entregue.
>
> **Atualização (2026-10-14):** o enforcement proposto aqui **está
> implementado** — `TenantLimitsService` aplica `userLimit`/`clientLimit`/
> `productLimit` nos `create` de Users/Clients/Products, apenas para
> empresas com assinatura `ACTIVE` (decisão D3). Os campos de limite
> existem em `TenantPlan` (migration `20261012173450_tenant_plan_limits`).
> Trechos que dizem "sem enforcement" / "não existem colunas de limite"
> descrevem o estado pré-Etapa 11.

**Base normativa:**

- Roteiro Etapa 11 (L363+): separar entidades, documentar diferenças,
  decidir planos/limites com o proprietário, aplicar limites no backend,
  modelar estados, avaliar gateway antes de integrar;
- `docs/akylla/MAPA_DE_MODULOS.md` §5: separação billing-SaaS ×
  financeiro do cliente (decisão permanente desde a fundação do
  produto);
- `docs/akylla/DIAGNOSTICO_INICIAL.md`: lacuna registrada —
  `TenantPlan` sem campos de limite e sem enforcement.

---

## 1. Separação de entidades (instrução 1 — já existente, formalizada)

Duas famílias de assinatura coexistem no sistema e **nunca se misturam**:

| Aspecto | **Billing da plataforma (Akylla)** | **Assinaturas de negócio (empresa cliente)** |
|---|---|---|
| Models | `TenantPlan` (catálogo global), `TenantSubscription` (1 por empresa) | `SubscriptionPlan` (por empresa), `Subscription` (por cliente) |
| API/UI | `billing` · `/faturamento` | `subscriptions` + `subscription-plans` · `/assinaturas`, `/planos` |
| Quem paga | A **empresa** (tenant) paga à **Akylla** | Os **clientes finais** pagam à empresa |
| Dinheiro | **Não** gera `CashMovement`; sem gateway | Gera `CashMovement` na caixa (`registerPayment`, renovação) |
| Escopo | `TenantPlan` é **global** (exceção documentada); `TenantSubscription` único por `companyId` | 100% escopado por `companyId` |
| Guard | `AdminGuard` | `AdminGuard` + `@RequireModule(SUBSCRIPTIONS)` |
| Testes | `billing.test.ts` (12) | `subscriptions.test.ts` (18) |

A separação é imposta por schema, API e testes — confirmada sem
mistura no código (AUDITORIA C2, Etapa 1).

---

## 2. Estado atual dos modelos de billing (instrução 2)

### 2.1 `TenantPlan` (catálogo global)

| Campo | Tipo | Observação |
|---|---|---|
| `id`, `name`, `nameKey` | string | `nameKey` globalmente único |
| `description` | text? | **hoje contém a promessa de limite em prosa** ("Até 3 usuários…") — sem enforcement |
| `priceMonthly` | Decimal(12,2) | preço mensal em BRL |
| `durationDays` | int (default 30) | vigência da assinatura |
| `active` | boolean | planos inativos somem do catálogo |
| **limites** | — | **não existem colunas de limite** |

### 2.2 `TenantSubscription` (assinatura da empresa)

| Campo | Tipo | Observação |
|---|---|---|
| `companyId` | unique | exatamente 1 assinatura por empresa |
| `planId` | FK Restrict | plano vigente |
| `status` | `ACTIVE` / `EXPIRED` / `CANCELLED` | expiração lazy na leitura (`expireStale`) |
| `currentPeriodStart` / `currentPeriodEnd` | datetime | troca de plano reinicia o período; renovação estende de `max(agora, fim atual)` sem perder dias |
| `cancelReason` / `cancelledAt` / `changedByUserId` | — | cancelamento auditado; 409 em duplo cancelamento |

### 2.3 Lacunas identificadas

1. **Sem campos de limite** — as promessas de plano existem apenas na
   `description` em prosa;
2. **Sem enforcement no backend** — um tenant pode criar quantos
   usuários quiser, independentemente do plano;
3. **Sem gateway** — correto para a etapa (não simular integração);
4. **Catálogo global sem escrita de plataforma** — pendência registrada
   (papel de plataforma).

---

## 3. Avaliação de gateway de pagamento (instrução 6)

| Critério | Avaliação |
|---|---|
| Necessidade | Recorrência mensal exige cobrança automática futura; hoje o fluxo é manual (admin troca/renova plano em `/faturamento`) |
| Opções de gateway (BR) | Mercado Pago, Pagar.me, Stripe (com suporte a BRL), Asaas |
| Webhooks | Todos expõem webhook de pagamento; exigem verificação de assinatura, idempotência por evento e reconciliação com `TenantSubscription` |
| Custo | Taxa por transação (~3-5% + R$ fixo); sem custo de setup |
| Modo de teste | Todos oferecem sandbox — obrigatório antes de produção |
| Risco | Cobrança recorrente sem E2E = chargebacks e suporte; **não integrar sem aprovação explícita** (instrução 7) |

**Decisão do proprietário (2026-10-12): integrar sandbox agora —
gateway Mercado Pago.** Implementado na Etapa 11: SDK oficial
`mercadopago`, checkout via preapproval, webhook assinado HMAC com
idempotência por `gatewaySubscriptionId`, ambiente `sandbox` por padrão.
Cobrança recorrente real **não ativada** — exige E2E com cartão de
teste + aprovação explícita (instrução 7).

---

## 4. Proposta de planos e limites (instruções 3 e 4)

### 4.1 Catálogo existente (seed da migration Etapa 9)

| Plano | Preço mensal | Promessa atual (description, sem enforcement) |
|---|---|---|
| **Essencial** | R$ 79,90 | "Até 3 usuários e módulos básicos" |
| **Profissional** | R$ 149,90 | "Até 10 usuários com todos os módulos" |
| **Completo** | R$ 249,90 | "Usuários ilimitados e prioridade no suporte" |

### 4.2 Limites propostos para implementação no backend

Adicionar a `TenantPlan` colunas **anuláveis** (`Int?`) — `NULL` =
ilimitado:

| Campo proposto | Essencial | Profissional | Completo | Enforcement proposto |
|---|---|---|---|---|
| `userLimit` | 3 | 10 | NULL (ilimitado) | `UsersService.create` → 403 ao atingir o limite |
| `clientLimit` | 200 | 1000 | NULL | `ClientsService.create` → 403 (opcional — ver decisão D2) |
| `productLimit` | 100 | 500 | NULL | `ProductsService.create` → 403 (opcional — ver decisão D2) |

**Mecânica do enforcement (backend, não interface):**

- Novo `TenantLimitGuard` (ou função utilitária no `BillingService`)
  chamado nos `create` de User/Client/Product;
- Contagem = `count` do recurso para o `companyId` (já isolados);
- Limite atingido → **403** com mensagem clara ("Limite do plano
  Essencial atingido (3 usuários). Contate a Akylla para upgrade.");
- **Assinatura ausente ou expirada** → comportamento a decidir
  (recomendado: leitura liberada, criação de novos registros bloqueada
  com 402/403 — ver decisão D3);
- Cancelamento não apaga dados — apenas bloqueia crescimento.

### 4.3 Instrução 5 — estados, datas, vigência, cancelamento e renovação

Já modelados e testados (12 testes em `billing.test.ts`):

- Estados: `ACTIVE` → `EXPIRED` (lazy na leitura) → reativa por
  renovação; `CANCELLED` terminal (409 em renovação);
- Vigência: `currentPeriodStart`/`currentPeriodEnd` em UTC; troca de
  plano reinicia o período; renovação estende de
  `max(agora, fim atual)` (não perde dias);
- Cancelamento: motivo obrigatório (3..500), autor e data auditados,
  409 em duplo cancelamento;
- Sem assinatura: `GET /billing/subscription` → 404 (coberto por
  teste).

Nenhuma alteração de modelo de estado é necessária nesta etapa.

---

## 5. Checklist de decisões comerciais (para o proprietário)

| # | Decisão | Opções | Recomendação | Status |
|---|---|---|---|---|
| **D1** | Confirmar os 3 planos e seus preços (79,90 / 149,90 / 249,90) — hoje só no seed, **não anunciados publicamente** | Manter · Ajustar · Adiar anúncio | Manter valores do seed; **não publicar** até produção | **Aprovada — manter seed (2026-10-12)** |
| **D2** | Quais limites aplicar no backend | (a) só usuários · (b) usuários + clientes · (c) usuários + clientes + produtos | (c) todos — mais transparente e defensável | **Aprovada — todos os limites (2026-10-12)**: Essencial 3/200/100; Profissional 10/1000/500; Completo ilimitado |
| **D3** | Empresa sem assinatura ou expirada: o que bloquear? | (a) nada (hoje) · (b) bloquear criação de usuários/clientes/produtos, liberar leitura · (c) bloqueio total de escrita | (a) status quo — enforcement só para assinaturas ativas | **Aprovada — status quo, enforcement só com ACTIVE (2026-10-12)** |
| **D4** | Integração com gateway de pagamento | (a) não integrar agora · (b) integrar sandbox agora | (b) Mercado Pago — sandbox com testes antes de produção | **Aprovada — Mercado Pago sandbox (2026-10-12)** |

---

## 6. Plano de implementação — executado na Etapa 11

1. **Migration aditiva** em `TenantPlan` (✅ `20261012173450_tenant_plan_limits`):
   colunas `userLimit Int?`, `clientLimit Int?`, `productLimit Int?` +
   UPDATE dos planos seed (Essencial 3/200/100; Profissional 10/1000/500;
   Completo NULL);
2. **Enforcement** (✅ `TenantLimitsService`): chamado nos `create` de
   User/Client/Product; 403 com nome do plano e limite; **apenas** para
   assinaturas `ACTIVE` (decisão D3);
3. **Testes** (✅ `tenant-limits.test.ts` 7 + `mercadopago.test.ts` 12):
   sem assinatura, ativa/vencida/cancelada, limite atingido, Completo
   ilimitado, isolamento cross-tenant, checkout admin/member/anon, webhook
   assinado/idempotente/cancelamento;
4. **Gateway Mercado Pago sandbox** (✅ decisão D4): provider mock/real,
   `POST /api/billing/checkout`, webhook assinado HMAC, `GET
   /api/billing/gateway`; env vars em `.env.example` sem segredos;
5. **UI `/faturamento`**: exibir limites do plano atual e uso —
   **pendência registrada** (backend já expõe os campos no `planSelect`);
6. **Docs** (✅): `DATABASE.md`, `API.md`, `PROJECT_STATUS.md`,
   `IMPLEMENTATION_CHECKLIST.md`, `CHANGELOG.md`.

---

## 7. Fora do escopo desta etapa (instruções 7 e 8)

- Ativação de cobrança recorrente real (exige E2E sandbox com cartão de
  teste do Mercado Pago + aprovação explícita);
- Publicação de preços, limites ou promessas comerciais em landing/
  materiais;
- Papel de plataforma para escrita do catálogo global de planos;
- UI `/faturamento` exibindo limites/uso (backend pronto, front pendente);
- Alteração nas assinaturas de negócio do cliente final (módulo
  opcional já estável).
