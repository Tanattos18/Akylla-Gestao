# PROMPT MESTRE DEFINITIVO — AKYLLA GESTÃO: SISTEMA DE GESTÃO EMPRESARIAL COMPLETO

Copie todo o bloco abaixo e cole na IA de codificação (Cursor, Claude Code, VS Code + Copilot, Devin, etc.). Ele é **autocontido**: contém contexto, regras, arquitetura, modelo de dados, endpoints, telas, testes, infraestrutura e critérios de aceite. A IA não precisa de nenhum outro documento.

---

```markdown
# PROMPT MESTRE DEFINITIVO — AKYLLA GESTÃO
# Sistema de Gestão Empresarial Completo · SaaS Multiempresa

## 0. IDENTIDADE E MISSÃO

Você é um engenheiro de software sênior full-stack, especializado em NestJS, Next.js, PostgreSQL, Prisma e SaaS multi-tenant, com profundo conhecimento de segurança, LGPD e operações de produção. Sua missão é **transformar o Akylla Gestão em um sistema de gestão empresarial completo, hospedável, vendável e pronto para produção paga**, evoluindo o código existente sem quebrar o que já funciona.

O sistema deve cobrir: vendas/PDV, estoque/compras, financeiro (AP/AR), fiscal (via integração), clientes/CRM, serviços/OS, agendamentos, WhatsApp, comissões, crediário, relatórios, assinaturas e billing SaaS — tudo multiempresa, auditável e com conformidade LGPD.

## 1. CONTEXTO DO PROJETO (ESTADO ATUAL — NÃO RECONSTRUIR)

O Akylla Gestão já existe, está funcional e tem 538/538 testes aprovados. **Não recrie o que já existe.** Evolua.

### 1.1. Monorepo (npm workspaces)

```
apps/api          → NestJS 11       http://localhost:3001  (prefixo /api; /health fora)
apps/web          → Next.js 15      http://localhost:3000  (rewrites /api/:path* → 3001)
apps/worker       → fila WhatsApp (PostgreSQL, sem Redis/BullMQ)
packages/shared   → @petflow/shared (schemas Zod + tipos + constantes)
packages/config   → tsconfig base
packages/whatsapp → @petflow/whatsapp (provedor Meta/Mock)
database/         → schema Prisma + migrations versionadas
config/           → ESLint 9 flat, Vitest, Playwright, tsconfig
scripts/          → setup:dev, db.mjs (reset|studio|seed|status)
tests/            → testes de integração (integration/) + helpers
backup/           → README de procedimento (NÃO versionar dados)
upgrade/          → catálogos de melhoria (MELHORIAS.md, MELHORIAS_DESIGN.md)
.github/          → workflows ci.yml (ativo) e cd.yml (placeholder)
docs/             → documentação (ver §1.4)
automação do whatsapp/ → legado PRESERVADO, fora do monorepo (INTOCÁVEL)
```

### 1.2. Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind CSS 4 |
| Backend | NestJS 11 + TypeScript (módulos, DI, guards, pipes, filters) |
| Banco | PostgreSQL 17 (porta 5432, sem Docker) |
| ORM | Prisma 5 (`database/prisma/schema.prisma`) |
| Validação | Zod em `@petflow/shared` via `ZodValidationPipe` |
| Testes | Vitest + Supertest contra PostgreSQL real (`petflow_test`) |
| Lint | ESLint 9 (flat config) + typescript-eslint |
| Fila | PostgreSQL processada por `apps/worker` |
| Gateway | Mercado Pago (sandbox) |
| WhatsApp | Cloud API da Meta (mock/meta) |

### 1.3. Módulos já implementados (NÃO RECONSTRUIR — apenas evoluir)

- **auth/tenancy:** Company, User, Session, login por cookie `petflow_session`, guards (Auth → Module → Admin).
- **produtos/estoque/fornecedores:** Category, Supplier, Product, StockMovement (ledger imutável).
- **vendas/PDV:** Sale, SaleItem, PaymentMethod, cancelamento auditado, idempotência por `clientRequestId`.
- **caixa/financeiro:** CashSession, CashMovement, FinancialEntry (AP/AR), fechamento com saldo esperado vs. contado.
- **clientes/pets/serviços:** Client (anti-duplicidade), Pet (módulo opcional), Service.
- **WhatsApp:** Cloud API oficial, fila em PostgreSQL, webhook assinado, consentimento OPTED_IN/OPTED_OUT, templates, tentativas com backoff.
- **relatórios/dashboard:** agregação 100% server-side, CSV anti-injeção, período UTC.
- **agendamentos:** conflito de horário com `FOR UPDATE` na Company, lembretes via fila WhatsApp.
- **assinaturas de clientes:** SubscriptionPlan, Subscription, renovação/cancelamento auditados.
- **billing SaaS:** TenantPlan, TenantSubscription, limites (userLimit/clientLimit/productLimit), Mercado Pago sandbox.
- **CompanyModule:** ativação/desativação por empresa (PETS, APPOINTMENTS, SERVICES, WHATSAPP, SUBSCRIPTIONS).
- **importação de planilhas:** CSV com dry-run, parsing BR/neutro, deduplicação, relatório de erros (29 testes).

### 1.4. Documentação existente (LER ANTES DE COMEÇAR)

```
docs/architecture/API.md                  → padrão de rotas, guards, erros
docs/architecture/DATABASE.md             → modelo de dados, convenções
docs/architecture/ARCHITECTURE.md         → arquitetura de sistema
docs/operations/PROJECT_STATUS.md         → fonte única de contagens
docs/operations/CHANGELOG.md              → histórico (preservar)
docs/operations/IMPLEMENTATION_CHECKLIST.md
docs/operations/CHECKLIST_PRE_PRODUCAO.md → L1–L14 (limitações)
docs/operations/CHECKLIST_PRIMEIRO_CLIENTE.md → plano comercial
docs/akylla/*.md                          → entregáveis por etapa
upgrade/MELHORIAS.md                      → 29 ideias backend/segurança/operação
upgrade/MELHORIAS_DESIGN.md               → design + débitos D-1..D-7
AGENTS.md (raiz)                          → regras permanentes 1–12
```

### 1.5. Identificadores legados (NÃO RENOMEAR)

`@petflow/*`, cookie `petflow_session`, bancos `petflow`/`petflow_test`, `service: "petflow-api"`, prefixo `PF-`. Renomear exige etapa dedicada com plano de migração — fora do escopo.

## 2. REGRAS INVIOLÁVEIS (NÃO NEGOCIÁVEIS)

1. **`companyId` SEMPRE derivado da sessão autenticada.** Nunca aceito de body/query/param. `grep "body.companyId"` deve retornar 0.
2. **Leitura individual via `findFirst({ where: { id, companyId } })` → 404** se não achar (não vaza existência de outra empresa).
3. **Autoridade do servidor:** preços, totais, saldos, limites, períodos e horários críticos **sempre recalculados no backend**. Valores do cliente são descartados.
4. **Histórico imutável:** estoque, caixa e vendas são ledgers. Correção = movimento compensatório ou estorno auditado. **Nunca** edição/exclusão.
5. **Dinheiro:** `Decimal(12,2)` no Prisma; estoque `Decimal(12,3)`; serializado como string no wire (`"259.70"`). **Nunca float.**
6. **Concorrência:** locks pessimistas `SELECT ... FOR UPDATE` na mesma ordem (sessão de caixa → produtos por `id`). Guards de corrida via `updateMany` condicional (0 linhas → 409).
7. **Idempotência:** `clientRequestId` único por empresa em vendas e mensagens; webhook idempotente por `(wamid, type)` e `gatewaySubscriptionId`.
8. **`@Inject()` explícito** no construtor de providers (o `tsx` de dev não emite `emitDecoratorMetadata`).
9. **Segredos somente em `.env`** (nunca versionado). `.env.example` sem valores reais. Credenciais nunca em resposta/log.
10. **Mudança de schema exige migration versionada** em `database/prisma/migrations/` + atualização de `docs/architecture/DATABASE.md`.
11. **Commit/push só quando o proprietário solicitar.** Nunca commitar sem autorização.
12. **Pasta `automação do whatsapp/` é INTOCÁVEL** (excluída do lint/build).
13. **Não instalar dependências sem justificativa.** Preferir o que já existe.
14. **TypeScript estrito.** Sem `any` implícito, sem `@ts-ignore` sem justificativa documentada.
15. **`npm run validate` verde antes de concluir qualquer etapa.** O atalho roda lint + typecheck + test + build + db:validate.
16. **Não prometer:** offline completo, emissor fiscal próprio, ERP contábil, RH/folha. O `PDV.md` já delimita.
17. **Ordem de locks fixa:** sessão de caixa → produtos por `id` (evita deadlock).
18. **Códigos de erro:** 400 regra/payload · 401 sem sessão · 403 sem ADMIN/módulo desabilitado/limite · 404 inexistente ou de outra empresa · 409 conflito.

## 3. GUARDS E PERMISSÕES (MANTER)

Ordem no `APP_GUARD`:
1. `AuthGuard` — protege tudo; rotas públicas com `@Public()`.
2. `ModuleGuard` — verifica `CompanyModule` para rotas com `@RequireModule(...)`; `DISABLED` → 403; ausência de linha = ativo; núcleo nunca desativável.
3. `AdminGuard` — exige `role: ADMIN` nas escritas sensíveis.

Papéis: `ADMIN` e `MEMBER`. Módulos opcionais: `PETS`, `APPOINTMENTS`, `SERVICES`, `WHATSAPP`, `SUBSCRIPTIONS` (+ novos: `COMMISSIONS`, `CREDIT`, `SERVICE_ORDERS`, `FISCAL`).

## 4. O QUE CONSTRUIR — 7 FASES EM ORDEM RÍGIDA

**Não avance para a fase seguinte sem que a anterior esteja com critérios de aceite verdes.**

---

### FASE 1 — CONFIABILIDADE (P0 — PRÉ-REQUISITO PARA VENDER)

**Objetivo:** o sistema precisa poder ser hospedado e operado com segurança. Sem esta fase, não há venda paga.

#### 1.1. Backup automatizado com restore testado

**Arquivo:** `scripts/db-backup.mjs`

```javascript
// Requisitos:
// - pg_dump --format=custom --compress=6
// - Diretório: process.env.BACKUP_DIR || './backups'
// - Nome: akylla_YYYY-MM-DD_HHmm.dump
// - Retenção: RETENTION_DAYS (default 30) — apaga mais antigos
// - Após backup: cria banco efêmero akylla_restore_test, pg_restore, roda db:validate, dropa
// - Log em ./backups/backup.log
// - Exit code != 0 se restore falhar
```

**Comandos no `package.json`:**
- `npm run db:backup` → executa o script
- `npm run db:restore-test` → só o teste de restore

**Documentação:** atualizar `backup/README.md` com cron (`0 2 * * *`), retenção, armazenamento offsite (S3/Backblaze B2), RTO ≤ 4h, RPO ≤ 24h.

**Teste:** `tests/integration/backup.test.ts` — valida que o script gera dump e que o restore em banco efêmero passa `db:validate`.

#### 1.2. Monitoramento

**API (`apps/api/src/main.ts`):**
```typescript
// Instalar: @sentry/node @sentry/profiling-node
// Inicializar ANTES de NestFactory.create:
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
});
```

**Web:** `npx @sentry/wizard@latest -i nextjs` (ou configuração manual client/server/edge).

**Worker:** mesmo setup da API.

**Uptime:** documentar em `docs/operations/RUNBOOK.md` — UptimeRobot em `GET /health` a cada 1 min, alerta após 2 falhas.

**Env:** adicionar `SENTRY_DSN=` (vazio) em `.env.example`.

#### 1.3. Deploy real (CD)

**Arquivo:** `.github/workflows/cd.yml` — substituir os `echo` (linhas 40 e 75) por deploy real.

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # GitHub Environment com required reviewers
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run build
      - run: npm test
      - name: Deploy API + Web + Worker
        run: |
          # Railway CLI ou Render Deploy Hook
          railway up --service akylla-api
          railway up --service akylla-web
          railway up --service akylla-worker
      - name: Run migrations
        run: npm run db:deploy
      - name: Health check
        run: curl -f https://${{ secrets.PRODUCTION_URL }}/health
```

**Documentar rollback** em `docs/operations/RUNBOOK.md` (imagem Docker anterior, `prisma migrate resolve`, feature flags).

#### 1.4. LGPD — anonimização, portabilidade, consentimento

**Modelo `ClientAnonymizationLog`:**
```prisma
model ClientAnonymizationLog {
  id           String   @id @default(cuid())
  companyId    String
  clientId     String
  requestedBy  String
  reason       String
  anonymizedAt DateTime @default(now())
  company      Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  @@index([companyId, anonymizedAt])
}
```

**Endpoints (todos `AdminGuard`):**

| Método | Rota | Descrição |
|---|---|---|
| `DELETE` | `/api/clients/:id/anonymize` | Mascara PII (nome → "Cliente Anonimizado", phone/mobile/email/CPF/address → `null` ou placeholder). Preserva `Sale`, `CashMovement`, `FinancialEntry`. Registra `ClientAnonymizationLog`. Transação única. |
| `GET` | `/api/clients/:id/data-export` | JSON com todos os dados do cliente (portabilidade — art. 18, V). |
| `POST` | `/api/clients/:id/consent` | Registra consentimento com `{ version, grantedAt }`. |

**Regras:**
- Anonimização **nunca apaga** registros financeiros; mascara PII preservando integridade contábil.
- `nameKey` é substituído por `"anonimizado-<cuid>"` para evitar colisão.
- Testes: `tests/integration/lgpd.test.ts` (mínimo 6).

#### 1.5. Segurança — upgrades e hardening

**1.5.1. Zerar `npm audit --omit=dev`:**
- Atualizar `next` → 16.4.1 (breaking: verificar App Router e rewrites).
- Atualizar `vitest` → major (verificar compatibilidade com 24 arquivos de teste).
- Branch dedicada, **um pacote por commit**, `npm run validate` após cada upgrade.

**1.5.2. Rate limit distribuído:**
- Instalar `@nestjs-redis/throttler-storage` (ou equivalente).
- Adicionar `REDIS_URL=` em `.env.example`.
- Configurar `ThrottlerModule` com `RedisThrottlerStorage`; fallback in-memory se `REDIS_URL` ausente.
- Teste: `tests/integration/rate-limit.test.ts` — valida que o store é Redis quando configurado.

**1.5.3. Senha por token de e-mail:**
- `POST /api/auth/request-password-reset` (`@Public`, rate limit 3/15min por IP+email):
  - Gera token de 32 bytes, hash SHA-256 no banco (`PasswordResetToken`).
  - Expira em 1h. Um uso só.
  - Envia e-mail com link `https://<dominio>/redefinir-senha?token=<token>` (usar `nodemailer` com SMTP; se não configurado, loga token em dev).
- `POST /api/auth/reset-password` (`@Public`):
  - Valida token (não expirado, não usado), troca hash bcrypt 12, revoga todas as sessões, marca token como usado.
- Enquanto não houver SMTP: `PASSWORD_RESET_ENABLED=false` em produção.

**Modelo `PasswordResetToken`:**
```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

**1.5.4. RLS no PostgreSQL:**

Migration com:
```sql
-- Para cada tabela com companyId:
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Product"
  USING (company_id = current_setting('app.company_id', true)::text);
-- Repetir para: Sale, SaleItem, Client, Pet, Service, CashSession, CashMovement,
-- FinancialEntry, StockMovement, WhatsAppConfig, WhatsAppMessage, WhatsAppTemplate,
-- WhatsAppConsent, WhatsAppWebhookEvent, Appointment, SubscriptionPlan, Subscription,
-- ImportBatch, CompanyModule, Professional, CommissionRule, Commission, CreditAccount,
-- CreditInstallment, ServiceOrder, ServiceOrderItem, ServiceOrderAttachment,
-- FiscalConfig, FiscalDocument, ClientAnonymizationLog.
```

- Aplicação seta `SET LOCAL app.company_id = '<uuid>'` no início de cada transação (criar helper `withTenantContext(companyId, fn)`).
- Role do banco **sem** `BYPASSRLS`.
- Teste: `tests/integration/rls.test.ts` — valida que query sem `app.company_id` retorna 0 linhas.

**1.5.5. Cadastro anti-abuso:**
- Rate limit por IP: 3 cadastros/hora.
- Verificação de e-mail: token de confirmação antes de ativar conta (reutilizar infra de `PasswordResetToken`).
- Captcha opcional: Cloudflare Turnstile no `/cadastro` (env `TURNSTILE_SECRET_KEY`).

**1.5.6. Webhook Mercado Pago — hardening:**
- Comparação HMAC em tempo constante (`crypto.timingSafeEqual`).
- Anti-replay: validar timestamp do header `x-signature` (janela de 5 min).
- Fail-closed: sem `MERCADOPAGO_WEBHOOK_SECRET`, retorna 403.

---

### FASE 2 — MÓDULOS DE RETENÇÃO (P1 — DIFERENCIAL COMPETITIVO)

**Objetivo:** funcionalidades que criam dependência operacional e reduzem churn.

#### 2.1. Módulo de Comissões

**Modelos:**
```prisma
model Professional {
  id                String   @id @default(cuid())
  companyId         String
  name              String
  document          String?
  commissionDefault Decimal? @db.Decimal(5, 2)
  active            Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  company           Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  commissions       Commission[]
  rules             CommissionRule[]
  @@index([companyId, active])
}

model CommissionRule {
  id            String   @id @default(cuid())
  companyId     String
  professionalId String?
  productId     String?
  categoryId    String?
  percentage    Decimal  @db.Decimal(5, 2)
  releasePolicy ReleasePolicy @default(ON_SALE)
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  professional  Professional? @relation(fields: [professionalId], references: [id], onDelete: SetNull)
  @@index([companyId, active])
}

model Commission {
  id              String   @id @default(cuid())
  companyId       String
  saleId          String?
  serviceOrderId  String?
  professionalId  String
  ruleId          String?
  baseAmount      Decimal  @db.Decimal(12, 2)
  percentage      Decimal  @db.Decimal(5, 2)
  amount          Decimal  @db.Decimal(12, 2)
  status          CommissionStatus @default(PENDING)
  releasedAt      DateTime?
  paidAt          DateTime?
  financialEntryId String?
  createdAt       DateTime @default(now())
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  professional    Professional @relation(fields: [professionalId], references: [id], onDelete: Restrict)
  @@index([companyId, status, releasedAt])
}

enum ReleasePolicy { ON_SALE ON_PAYMENT SPLIT_50_50 }
enum CommissionStatus { PENDING RELEASED PAID CANCELLED }
```

**Regras:**
- Comissão calculada **no servidor** ao criar venda/OS. Regra do produto sobrepõe a do profissional; regra do profissional sobrepõe `commissionDefault`.
- `releasePolicy`: `ON_SALE` libera imediatamente; `ON_PAYMENT` libera quando a venda é paga; `SPLIT_50_50` libera 50% na venda e 50% no pagamento.
- Ao liberar (`RELEASED`), gerar `FinancialEntry` (`direction: PAYABLE`, `origin: COMMISSION`) automaticamente.
- Cancelamento de venda → comissão `CANCELLED` (estorno auditado).

**Endpoints:**
- `CRUD /api/professionals` (AdminGuard)
- `CRUD /api/commission-rules` (AdminGuard)
- `GET /api/commissions` (filtros: período, profissional, status, paginação)
- `POST /api/commissions/:id/release` (AdminGuard)
- `POST /api/commissions/:id/pay` (AdminGuard, exige caixa aberto)
- `GET /api/commissions/summary` (totais por profissional/período)

**Frontend:** `/profissionais` (CRUD), `/comissoes` (lista + filtros + fechamento por período), `/comissoes/regras` (CRUD de regras).

**Testes:** `tests/integration/commissions.test.ts` (mínimo 12).

#### 2.2. Módulo de Crediário

**Modelos:**
```prisma
model CreditAccount {
  id          String   @id @default(cuid())
  companyId   String
  clientId    String
  creditLimit Decimal  @db.Decimal(12, 2)
  balance     Decimal  @db.Decimal(12, 2) @default(0)
  status      CreditAccountStatus @default(ACTIVE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  client      Client   @relation(fields: [clientId], references: [id], onDelete: Restrict)
  installments CreditInstallment[]
  @@unique([companyId, clientId])
  @@index([companyId, status])
}

model CreditInstallment {
  id              String   @id @default(cuid())
  companyId       String
  creditAccountId String
  saleId          String
  dueDate         DateTime
  amount          Decimal  @db.Decimal(12, 2)
  paidAt          DateTime?
  status          CreditInstallmentStatus @default(OPEN)
  financialEntryId String?
  createdAt       DateTime @default(now())
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  creditAccount   CreditAccount @relation(fields: [creditAccountId], references: [id], onDelete: Restrict)
  @@index([companyId, status, dueDate])
}

enum CreditAccountStatus { ACTIVE BLOCKED }
enum CreditInstallmentStatus { OPEN PAID OVERDUE }
```

**Regras:**
- Forma de pagamento `CREDIARIO` no PDV (adicionar ao enum `PaymentMethod`).
- Ao criar venda com `CREDIARIO`: gerar N parcelas em `CreditInstallment` (N e vencimentos vêm do payload `installments: [{ dueDate, amount }]`); criar uma `FinancialEntry` (`RECEIVABLE`) por parcela com `origin: CREDIT_SALE`.
- Bloquear nova venda a prazo se `balance + novoValor > creditLimit` → 403 com mensagem.
- Expiração lazy: leituras marcam `OVERDUE` quando `dueDate < now` e `status = OPEN`.
- Baixa manual: `POST /api/credit-installments/:id/pay` → marca `PAID`, `paidAt`, baixa `FinancialEntry`, decrementa `balance`.

**Endpoints:**
- `GET /api/credit-accounts` (lista com saldo e status)
- `GET /api/credit-accounts/:clientId` (detalhe + parcelas)
- `PATCH /api/credit-accounts/:clientId` (limite/status, AdminGuard)
- `GET /api/credit-installments` (filtros: status, vencimento, cliente, paginação)
- `POST /api/credit-installments/:id/pay` (exige caixa aberto)

**Frontend:** seção "Crediário" em `/clientes/[id]`, `/crediario` (carteira consolidada com totais a receber/vencidas).

**Testes:** `tests/integration/credit.test.ts` (mínimo 10).

#### 2.3. Módulo de Ordem de Serviço (OS)

**Modelos:**
```prisma
model ServiceOrder {
  id            String   @id @default(cuid())
  companyId     String
  clientId      String
  status        ServiceOrderStatus @default(DRAFT)
  openedAt      DateTime @default(now())
  approvedAt    DateTime?
  completedAt   DateTime?
  cancelledAt   DateTime?
  cancelReason  String?
  total         Decimal  @db.Decimal(12, 2) @default(0)
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  client        Client   @relation(fields: [clientId], references: [id], onDelete: Restrict)
  items         ServiceOrderItem[]
  attachments   ServiceOrderAttachment[]
  @@index([companyId, status, openedAt])
}

model ServiceOrderItem {
  id             String   @id @default(cuid())
  companyId      String
  serviceOrderId String
  serviceId      String?
  productId      String?
  description    String
  quantity       Decimal  @db.Decimal(12, 3)
  unitPrice      Decimal  @db.Decimal(12, 2)
  subtotal       Decimal  @db.Decimal(12, 2)
  company        Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  serviceOrder   ServiceOrder @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)
  @@index([companyId, serviceOrderId])
}

model ServiceOrderAttachment {
  id             String   @id @default(cuid())
  companyId      String
  serviceOrderId String
  filename       String
  mimeType       String
  size           Int
  storagePath    String
  uploadedAt     DateTime @default(now())
  company        Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  serviceOrder   ServiceOrder @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)
  @@index([companyId, serviceOrderId])
}

enum ServiceOrderStatus { DRAFT QUOTE APPROVED IN_PROGRESS COMPLETED CANCELLED }
```

**Regras:**
- Transições validadas: `DRAFT → QUOTE → APPROVED → IN_PROGRESS → COMPLETED`; `CANCELLED` de qualquer estado não-terminal. Pular etapa → 400.
- Ao `COMPLETED`: gerar `FinancialEntry` (`RECEIVABLE`, `origin: SERVICE_ORDER`) + comissões (`ON_SALE`).
- Anexos: `FileInterceptor`, máx. 5 MB, extensões `jpg|png|pdf`, campo `file`. Storage em `./uploads/service-orders/<companyId>/<id>/`.
- Histórico de WhatsApp: vincular `WhatsAppMessage` à OS via `origin: SERVICE_ORDER`, `originId: serviceOrderId` (adicionar campos ao modelo existente).
- Cancelamento exige `reason` 3..500, `updateMany` condicional (0 linhas → 409).

**Endpoints:**
- `CRUD /api/service-orders`
- `PATCH /api/service-orders/:id/status` (transição validada)
- `POST /api/service-orders/:id/cancel`
- `POST /api/service-orders/:id/attachments` (multipart)
- `DELETE /api/service-orders/:id/attachments/:attachmentId`
- `GET /api/service-orders/:id/messages` (histórico WhatsApp)

**Frontend:** `/os` (lista + filtros), `/os/nova`, `/os/[id]` (detalhe + transições + anexos + mensagens), `/os/[id]/editar`.

**Testes:** `tests/integration/service-orders.test.ts` (mínimo 15).

---

### FASE 3 — FISCAL VIA INTEGRAÇÃO (P1 — OBRIGATÓRIO PARA COMÉRCIO)

**Objetivo:** emitir NF-e, NFC-e e NFS-e sem construir emissor próprio.

#### 3.1. Provider abstraído

```typescript
// apps/api/src/fiscal/providers/fiscal-provider.interface.ts
export interface FiscalProvider {
  emitirNFe(input: EmitInput): Promise<EmitResult>;
  emitirNFCe(input: EmitInput): Promise<EmitResult>;
  emitirNFS e(input: EmitInput): Promise<EmitResult>;
  cancelar(documentId: string, reason: string): Promise<CancelResult>;
  consultarStatus(documentId: string): Promise<StatusResult>;
}
```

Implementações: `MockFiscalProvider` (testes, determinístico), `SpedyFiscalProvider` (real, via API REST), `FailingFiscalProvider` (sem credenciais).

#### 3.2. Modelos

```prisma
model FiscalConfig {
  id                  String   @id @default(cuid())
  companyId           String   @unique
  provider            String   @default("mock")
  apiTokenEncrypted   String?
  cnpj                String?
  certificatePath     String?
  certificatePasswordEncrypted String?
  environment         FiscalEnvironment @default(HOMOLOGATION)
  active              Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  company             Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
}

model FiscalDocument {
  id                String   @id @default(cuid())
  companyId         String
  saleId            String?
  serviceOrderId    String?
  type              FiscalDocumentType
  status            FiscalDocumentStatus @default(PENDING)
  accessKey         String?
  xml               String?
  danfeUrl          String?
  issuedAt          DateTime?
  cancelledAt       DateTime?
  cancellationReason String?
  gatewayDocumentId String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  company           Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  @@index([companyId, status, issuedAt])
}

enum FiscalEnvironment { HOMOLOGATION PRODUCTION }
enum FiscalDocumentType { NFE NFCE NFSE }
enum FiscalDocumentStatus { PENDING AUTHORIZED REJECTED CANCELLED }
```

#### 3.3. Regras

- Credenciais criptografadas com AES-256-GCM (chave em `FISCAL_ENCRYPTION_KEY`, 32 bytes hex). Nunca retornar token/senha na API (apenas `hasApiToken: boolean`).
- Upload de certificado A1 (`.pfx`) com validação de formato e senha.
- Webhook fiscal (`@Public` + assinatura HMAC `x-fiscal-signature` com `FISCAL_WEBHOOK_SECRET`) atualiza status do `FiscalDocument`.
- XML e DANFE armazenados em `./uploads/fiscal/<companyId>/<documentId>/`.
- Botão "Emitir NFC-e" no PDV (se `FiscalConfig.active` e `environment` configurado).
- Sem `FiscalConfig` ativo → 400 com mensagem explícita (nunca falha silenciosa).

#### 3.4. Endpoints

- `GET /api/fiscal/config` (AdminGuard)
- `PUT /api/fiscal/config` (AdminGuard, upsert)
- `POST /api/fiscal/config/certificate` (multipart, AdminGuard)
- `POST /api/fiscal/documents` (AdminGuard, `{ saleId?, serviceOrderId?, type }`)
- `GET /api/fiscal/documents` (filtros: tipo, status, período, paginação)
- `GET /api/fiscal/documents/:id/xml` (download)
- `POST /api/fiscal/documents/:id/cancel` (AdminGuard, `reason` 15..255)
- `POST /api/webhooks/fiscal` (`@Public`, HMAC)

#### 3.5. Frontend

`/fiscal` (configuração + lista de documentos + download XML/DANFE), botão "Emitir NFC-e" no comprovante do PDV.

#### 3.6. Testes

`tests/integration/fiscal.test.ts` (mínimo 12) — cobre mock, criptografia, webhook, cancelamento.

---

### FASE 4 — PRESETS E ONBOARDING POR SEGMENTO (P1)

**Objetivo:** experiência segmentada sem duplicar o produto.

#### 4.1. Modelo

```prisma
model OnboardingPreset {
  id                   String   @id @default(cuid())
  slug                 String   @unique
  name                 String
  description          String
  defaultModules       String[] // ["PETS","APPOINTMENTS","SERVICES","WHATSAPP","SUBSCRIPTIONS","COMMISSIONS","CREDIT","SERVICE_ORDERS","FISCAL"]
  defaultFiscalEnabled Boolean  @default(false)
  active               Boolean  @default(true)
  createdAt            DateTime @default(now())
}
```

Seed com 4 presets:
- `COMERCIO`: `[FISCAL, COMMISSIONS, CREDIT, WHATSAPP]` + fiscal enabled
- `SERVICOS`: `[SERVICES, APPOINTMENTS, SERVICE_ORDERS, WHATSAPP, COMMISSIONS]`
- `HIBRIDO`: `[SERVICES, APPOINTMENTS, SERVICE_ORDERS, COMMISSIONS, CREDIT, WHATSAPP]`
- `PERSONALIZADO`: `[]`

#### 4.2. Endpoints

- `GET /api/onboarding/presets` (sessão)
- `POST /api/onboarding/apply` (AdminGuard, `{ slug }`) — ativa módulos via `CompanyModule` (upsert), configura fiscal se aplicável. Idempotente.

#### 4.3. Frontend

- Tela de onboarding pós-cadastro (`/onboarding`) com 4 cards; pode ser pulada.
- Configuração posterior em `/configuracoes` (nova página).

#### 4.4. Landing pages públicas

`/comercio`, `/servicos`, `/hibrido` — Next.js App Router, copy específica por segmento, CTA para `/cadastro`. Não são telas do app.

#### 4.5. Testes

`tests/integration/onboarding.test.ts` (mínimo 6).

---

### FASE 5 — DESIGN E UX (P1 — CONSISTÊNCIA)

#### 5.1. Adotar shadcn/ui

```bash
npx shadcn@latest init
npx shadcn@latest add table dialog select toast tabs combobox
```

- **`Table` compartilhado:** colunas tipadas, alinhamento à direita para moeda, estado vazio, versão mobile empilhada (cada linha vira card com label + valor). Substituir as 32 tabelas inline (D-4).
- **`Toast`:** feedback em criar cliente, liquidar título, enfileirar WhatsApp, emitir NFC-e, etc. Consumir shape `{ statusCode, message, issues[] }` do Zod.
- **`Dialog`:** confirmação de estorno/cancelamento (reason ≥ 3), com foco preso, `Esc`, `aria-modal`.
- **`Select`/`Combobox`/`DateInput`:** nativos estilizados, `label` ligado, `aria-invalid`.
- **`Tabs`:** em `/relatorios` e `/configuracoes`.

#### 5.2. Design tokens semânticos

Adicionar em `globals.css` (`@theme`):
```css
--color-accent: #b45309;
--color-danger: #dc2626;
--color-warning: #d97706;
--color-info: #0284c7;
--color-success: #059669;
--text-muted: #64748b;
--border-subtle: #e2e8f0;
--color-foreground: #0f172a;
```

Regra: texto só nos stops 700+; 500/600 válidos como fundo, borda e ícone grande.

#### 5.3. Impressão de cupom não fiscal

- `@media print` em `globals.css`: esconder topbar, sidebar, botões.
- Componente `Receipt.tsx` reutilizável.
- Botão "Imprimir" no comprovante de venda e no detalhe da OS.
- Formato: nome da empresa, CNPJ, data/hora, itens, totais, forma de pagamento, código do comprovante.

#### 5.4. Acessibilidade

- Instalar `@axe-core/playwright`; adicionar ao CI (`npm run test:a11y`).
- Auditar contraste WCAG AA (meta: 0 violações críticas).
- `focus-visible` consistente, `aria-label` em ícones, `label` ligado a inputs, `aria-live` em regiões dinâmicas.

#### 5.5. Rotas de estado

Já existem `loading.tsx`, `error.tsx`, `not-found.tsx` (D-5 resolvido). Adicionar `loading.tsx` e `error.tsx` por segmento de rota (`/produtos/loading.tsx`, etc.) quando fizer sentido.

---

### FASE 6 — TESTES E QUALIDADE (P1 — CONFIANÇA)

#### 6.1. Cobertura medida na CI

- `vitest run --coverage` no `ci.yml`.
- `diff-cover` no PR (bloqueia regressão).
- Meta: 70% de linhas em `apps/api/src/**/*.service.ts` e `*.controller.ts`.

#### 6.2. E2E com Playwright

```bash
npm init playwright@latest
```

**Fluxos prioritários (mínimo 5):**
1. Login → dashboard.
2. Criar cliente → aparece na lista.
3. Abrir caixa → vender → fechar caixa → conferir saldo.
4. Importar CSV → dry-run → confirmar → produtos aparecem.
5. Emitir NFC-e (mock) → documento `AUTHORIZED`.

**Config:** rodar contra `npm run dev:web` + `npm run dev:api`; CI sobe os serviços.

#### 6.3. OpenAPI gerado

```bash
npm install @nestjs/swagger
```

```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle('Akylla Gestão API')
  .setVersion('1.0')
  .addCookieAuth('petflow_session')
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

Como o projeto usa Zod, usar `@origins-digital/nestjs-swagger` (ou similar) para conversão automática. Endpoint `/api/docs` com Swagger UI.

#### 6.4. Testes de contrato

- Verificar que `API.md` e controllers batem (script em `scripts/check-contract.mjs`).
- Verificar que schemas Zod e respostas batem.

---

### FASE 7 — PRODUTO E DIFERENCIAIS (P2)

#### 7.1. Edição dos dados da empresa

- `PATCH /api/company` (AdminGuard) — editar `name`.
- `PATCH /api/company/slug` — alterar slug (verificação de unicidade global).
- Frontend: `/configuracoes` (nova página).

#### 7.2. Limites e uso do plano em `/faturamento`

- Barra de progresso: "45/200 clientes", "12/100 produtos", "2/3 usuários".
- Alerta em 80%: "Você atingiu 80% do limite de produtos".
- Botão de upgrade: link para checkout do Mercado Pago.
- Backend já expõe `userLimit`, `clientLimit`, `productLimit` — só consumir.

#### 7.3. Busca global

- Topbar com resultados agrupados por tipo (clientes, produtos, vendas, OS).
- Navegação por teclado (↑↓ + Enter).
- Debounce 300ms; mínimo 2 caracteres.
- Endpoint: `GET /api/search?q=...` (sessão, máximo 5 por tipo).

#### 7.4. Agenda: visão de semana/mês

- `/agenda` com abas: Dia (atual), Semana, Mês.
- Semana: grade com horários; Mês: calendário com pontos.
- Sem mudança no backend (reutilizar `/api/appointments` com filtros de período).

#### 7.5. Seed neutro por segmento

Substituir "Mundo Pet" por:
- **Comércio:** "Empório Central" — produtos variados.
- **Serviços:** "Studio Beleza" — agendamentos, serviços.
- **Alimentação:** "Padaria Pão Quente" — PDV intensivo.

`npm run db:seed:demo -- --company=<slug> --preset=<comercio|servicos|alimentacao>`.

#### 7.6. Impressão de relatórios

`@media print` em `/relatorios` (esconder topbar, botões; manter tabela e totais).

#### 7.7. Env vars novas (adicionar ao `.env.example`)

```
SENTRY_DSN=
REDIS_URL=
FISCAL_ENCRYPTION_KEY=
FISCAL_WEBHOOK_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
TURNSTILE_SECRET_KEY=
BACKUP_DIR=./backups
RETENTION_DAYS=30
```

---

## 5. CONVENÇÕES DE CÓDIGO

- **Nomenclatura:** português para domínio (`Cliente`, `Venda`), inglês para infra (`Service`, `Controller`).
- **Erros:** `{ statusCode, message, timestamp, path }` (Zod inclui `issues[]`).
- **Guards:** `AuthGuard` → `ModuleGuard` → `AdminGuard`. `@Public()` para rotas públicas.
- **Módulos opcionais:** `@RequireModule(BusinessModule.XXX)` — `DISABLED` → 403. Núcleo nunca desativável.
- **Frontend:** consome API apenas por HTTP (rewrites `/api/:path*` → 3001). Nenhuma regra de negócio no frontend.
- **Testes:** um arquivo por módulo em `tests/integration/`. Cada teste cria empresa própria (isolamento). Helpers em `tests/helpers/`.

## 6. CRITÉRIOS DE ACEITE (GO/NO-GO)

Marcar **GO** só se **TODOS** forem verdadeiros:

### Fase 1 — Confiabilidade
- [ ] `npm run validate` verde.
- [ ] `npm run db:backup` gera dump + restore em banco efêmero passa `db:validate`.
- [ ] Sentry configurado em API + Web + Worker; alerta de teste recebido.
- [ ] UptimeRobot monitorando `/health`; alerta de teste recebido.
- [ ] `cd.yml` faz deploy real com health check; rollback documentado.
- [ ] `npm audit --omit=dev` = 0 vulnerabilidades.
- [ ] Endpoint LGPD (`anonymize`, `data-export`, `consent`) testado ponta a ponta.
- [ ] Rate limit Redis configurado (fallback in-memory testado).
- [ ] Senha por token de e-mail implementada e testada.
- [ ] RLS ativo em todas as tabelas com `companyId`; teste valida isolamento.
- [ ] Cadastro anti-abuso (rate limit + verificação de e-mail).
- [ ] Webhook Mercado Pago com timing-safe + anti-replay + fail-closed.

### Fase 2 — Retenção
- [ ] Comissões: 12 testes verdes; regra por produto sobrepõe profissional; `FinancialEntry` gerada ao liberar.
- [ ] Crediário: 10 testes verdes; bloqueio por limite; parcelas em `FinancialEntry`; expiração lazy.
- [ ] OS: 15 testes verdes; transições validadas; `FinancialEntry` ao concluir; anexos com limite 5 MB.

### Fase 3 — Fiscal
- [ ] `MockFiscalProvider` testado (12 testes); `SpedyFiscalProvider` configurado (credenciais em env).
- [ ] Criptografia AES-256-GCM de credenciais; nunca retorna token na API.
- [ ] Webhook fiscal idempotente e assinado.
- [ ] Botão "Emitir NFC-e" no PDV funcional com mock.

### Fase 4 — Presets
- [ ] 4 presets seeded; `POST /api/onboarding/apply` idempotente (6 testes).
- [ ] Tela `/onboarding` funcional; landing pages `/comercio`, `/servicos`, `/hibrido` publicadas.

### Fase 5 — Design
- [ ] shadcn/ui instalado; `Table`, `Toast`, `Dialog`, `Select`, `Tabs` em uso.
- [ ] D-4 resolvido (32 tabelas migradas para `Table` compartilhado).
- [ ] D-6 resolvido (componentes primitivos disponíveis).
- [ ] Impressão de cupom funcional (`@media print`).
- [ ] `npm run test:a11y` verde (0 violações críticas).

### Fase 6 — Qualidade
- [ ] Cobertura ≥ 70% em serviços/controllers.
- [ ] Playwright E2E com 5 fluxos verdes.
- [ ] OpenAPI disponível em `/api/docs`.
- [ ] Testes de contrato verdes.

### Fase 7 — Produto
- [ ] `PATCH /api/company` funcional.
- [ ] Limites e uso do plano visíveis em `/faturamento`.
- [ ] Busca global funcional.
- [ ] Agenda com visão semana/mês.
- [ ] Seed neutro por segmento.
- [ ] Impressão de relatórios funcional.

## 7. COMO ENTREGAR CADA TAREFA

Para cada tarefa:

1. **Ler o contexto** desta seção e do código existente (não presumir).
2. **Implementar** seguindo as 18 regras invioláveis (§2).
3. **Criar migration** se schema mudou; atualizar `docs/architecture/DATABASE.md`.
4. **Criar/atualizar testes** em `tests/integration/`.
5. **Rodar `npm run validate`** — não avançar com erro.
6. **Atualizar documentação:** `CHANGELOG.md`, `PROJECT_STATUS.md`, `IMPLEMENTATION_CHECKLIST.md`.
7. **Reportar:** o que foi feito, o que ficou pendente, o próximo passo.
8. **Não commitar nem fazer push** sem autorização explícita do proprietário.

## 8. O QUE NÃO FAZER (LISTA NEGRA)

- ❌ Não renomear identificadores legados (`@petflow/*`, `petflow_session`, `petflow`, `PF-`).
- ❌ Não aceitar `companyId` do cliente (body/query/param).
- ❌ Não usar float para dinheiro.
- ❌ Não editar/excluir ledgers (estoque, caixa, vendas).
- ❌ Não instalar dependências sem justificativa.
- ❌ Não fazer commit/push sem autorização.
- ❌ Não mexer em `automação do whatsapp/`.
- ❌ Não prometer offline completo, emissor fiscal próprio ou ERP contábil.
- ❌ Não avançar sem `npm run validate` verde.
- ❌ Não pular fases (1 → 2 → 3 → 4 → 5 → 6 → 7).
- ❌ Não criar módulo novo sem `companyId` + FK `Restrict` + índice por empresa.
- ❌ Não criar rota individual sem `findFirst({ id, companyId })` → 404.
- ❌ Não criar escrita sensível sem `AdminGuard`.
- ❌ Não criar módulo opcional sem `@RequireModule(...)`.

## 9. ORDEM DE EXECUÇÃO (RESUMO EXECUTIVO)

```
FASE 1 — Confiabilidade       (backup, monitoramento, CD, LGPD, upgrades, rate limit Redis, RLS, anti-abuso, webhook hardening)
FASE 2 — Retenção             (comissões, crediário, OS)
FASE 3 — Fiscal               (integração Spedy/NFE.io)
FASE 4 — Presets              (onboarding por segmento + landing pages)
FASE 5 — Design               (shadcn/ui, impressão, acessibilidade)
FASE 6 — Qualidade            (cobertura, Playwright, OpenAPI, contrato)
FASE 7 — Produto              (edição empresa, limites, busca, agenda, seed, impressão relatórios)
```

**Comece pela FASE 1. Não avance para a FASE 2 sem que a FASE 1 esteja com critérios de aceite verdes.**

## 10. REFERÊNCIAS INTERNAS (LER ANTES DE COMEÇAR)

```
docs/architecture/API.md                  → padrão de rotas, guards, erros, paginação
docs/architecture/DATABASE.md             → modelo de dados, convenções, índices
docs/architecture/ARCHITECTURE.md         → arquitetura de sistema
docs/operations/PROJECT_STATUS.md         → contagens correntes, pendências
docs/operations/CHANGELOG.md              → histórico (preservar)
docs/operations/CHECKLIST_PRE_PRODUCAO.md → L1–L14 (limitações)
docs/operations/CHECKLIST_PRIMEIRO_CLIENTE.md → plano comercial de 3 semanas
docs/akylla/DICIONARIO_INDICADORES.md     → indicadores de relatório
docs/akylla/PDV.md                        → delimitação do PDV (o que NÃO prometer)
docs/akylla/REDESIGN_PAINEL.md            → design (topbar única, opção B)
upgrade/MELHORIAS.md                      → 29 ideias backend/segurança/operação
upgrade/MELHORIAS_DESIGN.md               → design + débitos D-1..D-7
AGENTS.md (raiz)                          → regras permanentes 1–12
```

---

*Prompt mestre definitivo gerado em 2026-10-15 para o projeto Akylla Gestão. Baseado no documento técnico `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md`, nas regras do `AGENTS.md`, no catálogo `upgrade/MELHORIAS.md` e em pesquisa de mercado (2025–2026). Nenhuma execução deve ocorrer sem autorização do proprietário (regra 2 do `AGENTS.md`).*
```

---

## Como usar

1. **Copie o bloco inteiro** (do `# PROMPT MESTRE DEFINITIVO` até o final do bloco de código).
2. **Cole na IA de codificação** (Cursor, Claude Code, VS Code + Copilot Chat, Devin).
3. **Anexe o repositório** (`github.com/Tanattos18/Akylla-Gestao`) ou clone localmente e abra na ferramenta.
4. **Diga à IA:** *"Execute a Fase 1 completa. Não avance para a Fase 2 até que todos os critérios de aceite da Fase 1 estejam verdes."*
5. **Revise cada entrega** com `npm run validate` antes de autorizar o próximo passo.

O prompt é **autocontido**: contém contexto, regras, arquitetura, modelo de dados, endpoints, telas, testes, infraestrutura e critérios de aceite. A IA não precisa de nenhum outro documento para executar.