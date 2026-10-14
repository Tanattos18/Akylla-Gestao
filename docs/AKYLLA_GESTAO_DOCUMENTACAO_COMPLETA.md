# Akylla Gestão — Documentação técnica completa

> Documento autocontido, gerado para ser lido por um modelo de IA (GPT) como
> fonte única de contexto sobre o projeto. Resume **tudo o que foi
> desenvolvido** (Roteiro Akylla Gestão — Etapas 0→12, concluído em
> 2026-10-12), com os processos internos de cada módulo: fluxos,
> transações, locks, validações, permissões, endpoints, telas e testes.
>
> **Produto:** **Akylla Gestão** — SaaS multiempresa para pequenos
> negócios brasileiros (nicho pet shop removido da navegação; módulos
> genéricos reutilizáveis). Monorepo adaptado e renomeado em 2026-10-12.
>
> Fonte: `docs/**` + árvore de código real. Sem segredos, senhas ou
> credenciais neste documento.

---

## 1. Visão geral

**Akylla Gestão** é um SaaS web de gestão para pequenos negócios
brasileiros (produtos, estoque, PDV, caixa, financeiro, clientes,
serviços, WhatsApp, agendamentos, relatórios e assinaturas), com
arquitetura **multiempresa (tenant)** desde a primeira etapa.

- Cada registro de negócio pertence a uma `Company` (tenant).
- O `companyId` é **sempre derivado da sessão autenticada**, nunca aceito
  do cliente.
- Recurso de outra empresa responde **404** (não vaza existência).
- Módulos de nicho (pets) são **opcionais e desativáveis por empresa**
  via `CompanyModule` (Etapa 10); o núcleo (clientes, produtos, vendas,
  caixa, financeiro, relatórios) é sempre ativo.

### Situação atual

| Item | Estado |
|---|---|
| Roteiro Akylla Gestão (Etapas 0–12) | **CONCLUÍDO** (2026-10-12) |
| Testes | **538/538 aprovados** (24 arquivos, PostgreSQL real) |
| Migrations | 12 aplicadas em `petflow` e `petflow_test` |
| Gateway Mercado Pago | Sandbox implementado; cobrança real **não ativada** |
| Deploy / produção | **Não realizado** — requer aprovação do proprietário |
| Próximos passos | Checklist pré-produção (`docs/akylla/CHECKLIST_PRE_PRODUCAO.md`) |

---

## 2. Stack e arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind CSS 4 |
| Backend | NestJS 11 + TypeScript (módulos, DI, guards, pipes, filters) |
| Banco | PostgreSQL 17 local (sem Docker), porta 5432 |
| ORM | Prisma 5 (`database/prisma/schema.prisma`, migrations versionadas) |
| Validação | Zod, schemas compartilhados em `@petflow/shared` |
| Testes | Vitest + Supertest contra PostgreSQL real (`petflow_test`) |
| Lint | ESLint 9 (flat config) + typescript-eslint |
| Fila | PostgreSQL (sem Redis/BullMQ) processada pelo `apps/worker` |
| Gateway | Mercado Pago (SDK oficial `mercadopago`, sandbox por padrão) |
| WhatsApp | Cloud API oficial da Meta (provedor abstraído: mock/meta) |

### Monorepo (npm workspaces)

```
apps/api        → NestJS        http://localhost:3001  (prefixo /api; /health fora)
apps/web        → Next.js       http://localhost:3000  (rewrites /api/:path* → 3001)
apps/worker     → tarefas em background (fila WhatsApp)
packages/shared → @petflow/shared (schemas Zod + tipos + constantes)
packages/config → tsconfig base
packages/whatsapp → @petflow/whatsapp (provedor Meta/Mock, E.164, backoff)
database/       → schema Prisma e migrations (sem pasta de seeds)
tests/          → testes de integração compartilhados (24 arquivos)
docs/           → documentação
automação do whatsapp/ → base legada PRESERVADA, fora do monorepo (não mexer)
```

### Comandos

```bash
npm run dev:api      # build de shared+whatsapp e API com tsx watch
npm run dev:web      # Next.js
npm run dev:worker   # worker da fila WhatsApp
npm run lint         # ESLint no monorepo
npm run typecheck    # tsc nos workspaces apps/* (api, web, worker)
npm test             # Vitest (aplica migrations no petflow_test)
npm run build        # build de todos os workspaces
npm run db:validate  # valida schema Prisma
npm run db:migrate   # aplica migrations pendentes
npm run db:seed:demo -- --company=<slug|id|email>   # dados de demonstração
npm run bootstrap:admin                              # empresa + 1º ADMIN (idempotente)
```

Atenção operacional: `npm run build` e `npm run dev:web` **não podem rodar
ao mesmo tempo** (ambos escrevem em `apps/web/.next`).

---

## 3. Convenções transversais (valem para todos os módulos)

1. **Prefixo global da API**: `/api` (exceto `GET /health`).
2. **Autenticação**: cookie `HttpOnly` `petflow_session` (`SameSite=Lax`,
   `Secure` se `AUTH_COOKIE_SECURE=true`); token aleatório de 32 bytes; no
   banco fica apenas o **hash SHA-256** em `Session.tokenHash`. Nada de JWT,
   nada de `localStorage`. Senha com `bcryptjs` 12 rounds.
3. **Guards (ordem no APP_GUARD)**:
   - `AuthGuard` — protege tudo; rotas públicas usam `@Public()`.
   - `ModuleGuard` — verifica `CompanyModule` para rotas com
     `@RequireModule(...)`; módulo `DISABLED` → 403; ausência de linha =
     ativo; núcleo nunca é desativável.
   - `AdminGuard` — exige `role: ADMIN` nas escritas sensíveis.
   Papéis: `ADMIN` e `MEMBER` (nunca `STAFF`; alguns documentos antigos
   chamam o não-admin de "STAFF").
4. **Tenant**: `request.user.companyId` é a única fonte de `companyId`;
   toda leitura/escrita individual usa
   `findFirst({ where: { id, companyId } })` → 404 se não achar.
5. **Validação**: Zod compartilhado (`@petflow/shared`) via
   `ZodValidationPipe` na entrada; resposta de erro
   `{ statusCode, message, timestamp, path }` (Zod inclui `issues[]`).
6. **Códigos**: 400 regra/payload, 401 sem sessão, 403 sem ADMIN ou
   módulo desabilitado ou limite de plano atingido, 404 inexistente
   **ou** de outra empresa, 409 conflito (unicidade/corrida).
7. **Dinheiro**: `Decimal(12,2)`; estoque `Decimal(12,3)`; sempre
   serializado como string no wire (`"259.70"`); nada de float/binário
   para dinheiro.
8. **Autoridade do servidor**: preços, totais, saldos, períodos e
   horários são recalculados no backend; valores "críticos" vindos do
   cliente são ignorados.
9. **Histórico imutável**: estoque, caixa e vendas são ledgers —
   correção é movimento compensatório ou estorno auditado, nunca
   edição/exclusão.
10. **Concorrência**: locks pessimistas `SELECT ... FOR UPDATE` em
    transação, sempre na **mesma ordem** (sessão de caixa → produtos por
    `id`) para evitar deadlock; guards de corrida via `updateMany`
    condicional (0 linhas → 409).
11. **Idempotência**: `clientRequestId` único por empresa em vendas e
    mensagens WhatsApp; webhook idempotente por `(wamid, type)`; webhook
    Mercado Pago idempotente por `gatewaySubscriptionId`.
12. **Injeção de dependência**: providers com injeção de construtor usam
    `@Inject()` explícito — o runtime de dev `tsx` (esbuild) não emite
    `emitDecoratorMetadata`.
13. **Segredos**: somente `.env` (nunca versionado); `.env.example` sem
    valores reais; credenciais WhatsApp/Mercado Pago nunca aparecem em
    resposta/log.

---

## 4. Banco de dados — processos e migrations

Migrations (todas aplicadas em `petflow` e `petflow_test`, `db:validate`
OK):

| Migration | Etapa | Conteúdo |
|---|---|---|
| `20261009185907_etapa1_auth_tenancy` | 1 | `Company`, `User`, `Session` + enums |
| `20261009194843_etapa2_products_stock` | 2 | `Category`, `Supplier`, `Product`, `StockMovement` |
| `20261009205135_etapa3_sales_pdv` | 3 | `Sale`, `SaleItem`, `PaymentMethod`, `SaleStatus` |
| `20261009212628_etapa4_cash_finance` | 4 | `CashSession`, `CashMovement`, `Sale.cashSessionId` |
| `20261009222638_etapa5_clients_pets_services` | 5 | `Client`, `Pet`, `Service`, `Sale.clientId` |
| `20261009232055_etapa6_whatsapp_integration` | 6 | 6 modelos WhatsApp + 8 enums |
| `20261010002727_etapa7_report_indexes` | 7 | índices `(companyId, createdAt)` em `Client`/`Pet` |
| `20261010115308_etapa8_appointments` | 8 | `Appointment`, enum, campos de lembrete em `WhatsAppConfig` |
| `20261010131027_etapa9_subscriptions` | 9 | `SubscriptionPlan`, `Subscription`, `TenantPlan` (seed), `TenantSubscription`, `CashMovement.subscriptionId` |
| `20261012154010_company_module` | 10 | enums `BusinessModule`/`CompanyModuleStatus` + tabela `CompanyModule` |
| `20261012164040_financial_entry` | 8* | `FinancialEntry` (AP/AR, contas a pagar/receber) |
| `20261012173450_tenant_plan_limits` | 11 | `TenantPlan.userLimit/clientLimit/productLimit` + `TenantSubscription.gateway/gatewaySubscriptionId` |
| `20261014114855_import_batch` | pós-12 | `ImportBatch` + enums `ImportType`/`ImportStatus` (importação de planilhas CSV) |

Padrões: FK explícitas (`Restrict` para dados de negócio, `SetNull` para
autor/cancelador ou vínculos opcionais), índices compostos por
`companyId`, enums do Postgres para estados fechados,
`createdAt`/`updatedAt` em toda tabela de negócio (ledgers sem
`updatedAt`), IDs CUID (`TEXT`).

Exceções documentadas:
- `TenantPlan` e `TenantSubscription` são **globais** (sem `companyId` no
  catálogo; `TenantSubscription.companyId @unique`) — o catálogo é da
  plataforma.
- `FinancialEntry` tem escopo por empresa mas origens diversas (vendas,
  caixa, assinaturas de clientes).

---

## 5. Processo de autenticação e acesso

### Login
1. `POST /api/auth/login` (`@Public`, rate limit 5/15min por IP+email,
   checagem de `Origin`, CORS por allowlist `APP_ORIGINS`).
2. Email normalizado (trim+minúsculas) → bcrypt compara → gera token de 32
   bytes → grava `Session` com hash SHA-256 e `expiresAt` (TTL
   `AUTH_SESSION_TTL_HOURS`, padrão 12h) → devolve cookie `petflow_session`.
3. Toda rota privada: cookie → hash → sessão ativa → usuário `ACTIVE` →
   `request.user`/`request.company`.
4. `POST /api/auth/logout` apaga a sessão (revogação efetiva). Inativar
   usuário revoga todas as sessões dele.

### Cadastro aberto
- `POST /api/auth/register` (201) — só responde com
  `REGISTRATION_ENABLED=true` (senão 404); rate limit por IP
  `register|ip`; email **globalmente único** → 409; slug gerado do nome
  da empresa com sufixo único; cria `Company` + `User` ADMIN em
  transação e **loga automaticamente**.
- Tela `/cadastro`, link "Cadastre-se" no login.

### Redefinição de senha pelo painel
- `POST /api/auth/reset-password` — só com `PASSWORD_RESET_ENABLED=true`
  (senão 404); rate limit `reset|ip|email`; política 8..72; 404
  inexistente/inativo; 400 se o email pertence a várias contas; em
  **uma transação** troca o hash e **revoga todas as sessões** do
  usuário.
- Tela `/redefinir-senha`. Sem token de e-mail (decisão registrada — em
  produção manter a flag desligada até existir token por e-mail).

### Bootstrap
- `npm run bootstrap:admin`: cria `Company` + `User` ADMIN de forma
  idempotente a partir das variáveis `BOOTSTRAP_*` (sem senha padrão).

---

## 6. Módulo produtos, estoque, fornecedores

Código: `apps/api/src/{categories,suppliers,products,stock}`.

### Processo de movimentação de estoque (entrada/saída/ajuste)
1. Validação Zod (`quantity` > 0, até 3 decimais; ajuste exige `reason`
   ≥ 3 e papel ADMIN).
2. Transação: lock `SELECT ... FOR UPDATE` no produto → valida saldo →
   atualiza `Product.stockQuantity` (saldo materializado) → cria
   `StockMovement` → commit. Resposta `{ movement, stockQuantity }`.
3. Saída/ajuste negativo que deixaria saldo **negativo** → 400 (estoque
   negativo nunca é permitido).
4. Movimentos não têm endpoint de update/delete: correção = novo
   movimento compensatório.

### Regras
- SKU (maiúsculas) e barcode únicos por empresa (NULLs não conflitam);
  categorias únicas por `nameKey`.
- Categoria/fornecedor do produto validados no servidor contra a empresa.
- Alerta de estoque baixo: `ACTIVE` + `minimumStock > 0` +
  `stockQuantity <= minimumStock`.
- Permissões: leitura autenticada; escrita de catálogo/produtos/ajustes
  ADMIN.
- **Enforcement de limite de plano (Etapa 11)**: criação de produto
  bloqueada com 403 quando empresa tem assinatura `ACTIVE` no plano
  `Completo` não se aplica (ilimitado), mas no `Essencial` (limite 100)
  ou `Profissional` (limite 500) o 101º/501º produto recebe 403.
- Frontend: `/produtos`, `/produtos/novo`, `/produtos/[id]`,
  `/produtos/[id]/editar`, `/categorias`, `/fornecedores`.

---

## 7. Módulo vendas e PDV

Código: `apps/api/src/sales`.

### Processo de criação de venda (`POST /api/sales`)
1. Valida Zod: `items[{productId, quantity}]`, `discount`,
   `paymentMethod` (`CASH|CARD|PIX|OTHER`), `clientRequestId`
   (obrigatório), `clientId` opcional.
2. `clientId`, se vier, é validado **antes dos locks** (ativo + mesma
   empresa → senão 400).
3. Transação única:
   - lock `FOR UPDATE` dos produtos **em ordem de `id`**;
   - recalcula `unitPrice`/subtotal/total com `Product.salePrice` do
     banco (**preços enviados pelo cliente são descartados**);
   - cria `Sale` + `SaleItem` com **snapshot** (nome, SKU, unidade,
     preço, quantidade);
   - baixa `stockQuantity` e cria movimentos `OUT` (`reference` =
     `receiptCode`);
   - grava `cashSessionId` e um lançamento `CashMovement`
     `origin=SALE`.
4. Idempotência: `clientRequestId` único por empresa → repetição responde
   **409** sem alterar estoque. Código de comprovante `PF-XXXXXXXX`
   único por empresa, gerado no servidor.
5. **Exige caixa aberto**: sem sessão `OPEN` → 409.

### Cancelamento (`POST /api/sales/:id/cancel`, ADMIN)
- `reason` ≥ 3; transação com `updateMany({ status: COMPLETED })` → só
  o primeiro cancelamento devolve estoque (corrida → 409); devolve com
  movimentos `OUT` → `IN` compensatórios; cria lançamento
  `origin=SALE_CANCELMENT`; venda nunca é apagada (cancelamento lógico
  com autor/data/motivo). Também exige caixa aberto (409).

### Leitura
- `GET /api/sales` (filtros `status`, `search` por código, `from`/`to`
  UTC, paginação) e `GET /api/sales/:id` (itens com snapshots +
  `client`).
- Frontend: `/pdv` (busca por nome/SKU/barcode, carrinho, desconto,
  formas de pagamento, comprovante imprimível, banner "Caixa fechado"),
  `/vendas`, `/vendas/[id]`.

---

## 8. Módulo caixa e financeiro

Código: `apps/api/src/cash` e `apps/api/src/financial`.

### Regras fundamentais do caixa
- **Uma única sessão `OPEN` por empresa**: abertura com `FOR UPDATE` na
  linha da `Company` (segunda abertura → 409). Fechamento/estorno lockam
  a própria sessão.
- **`inCash`** decide o que compõe o saldo físico: venda em `CASH` +
  manuais; CARD/PIX/OTHER geram lançamento com `inCash=false` (entram
  só no resumo).
- Vendas, cancelamentos e movimentações manuais **exigem caixa aberto**
  (409).
- Ordem de locks fixa: sessão de caixa → produtos por `id` (evita
  deadlock).

### Processos do caixa
- **Abertura** `POST /api/cash/sessions` (ADMIN): `{ initialAmount,
  notes }`.
- **Movimentação manual** `POST /api/cash/movements` (ADMIN):
  `IN`/`OUT`, `OUT` exige `justification` ≥ 3; sessão precisa estar
  `OPEN`.
- **Fechamento** `POST /api/cash/sessions/:id/close` (ADMIN):
  `expected` = `inicial + Σ(IN inCash) − Σ(OUT inCash)` e
  `difference = contado − expected` calculados **no servidor**; duplo
  fechamento → 409.
- **Estorno auditável** `POST /api/cash/movements/:id/reversal`
  (ADMIN): apenas lançamento `MANUAL` não estornado na sessão aberta;
  cria `REVERSAL` do tipo oposto e marca o original (`reversedAt` via
  `updateMany` condicional → corrida 409). Estorno de venda → 400 (usar
  cancelamento).
- **Resumo** `GET /api/cash/summary`: agregações por origem/tipo/
  período/sessão.

### Financeiro (AP/AR — contas a pagar/receber)
- Modelo `FinancialEntry` com origens diversas (vendas, caixa,
  assinaturas de cliente) e estados **`OPEN`/`PAID`/`CANCELLED`**
  (enum `FinancialStatus`; nunca `PENDING`).
- `POST /api/financial` (sessão), `PATCH /api/financial/:id` (sessão),
  `POST /api/financial/:id/pay` (sessão, exige caixa aberto),
  `POST /api/financial/:id/reverse` e `POST /api/financial/:id/cancel`
  (ADMIN, auditáveis, nunca apagam); leitura com filtros por
  `direction`, `status`, período. Detalhe em
  [`docs/architecture/API.md`](architecture/API.md).
- Frontend: `/financeiro` (lista + totais a pagar/receber).

### Frontend do caixa
`/caixa`, `/caixa/fechar`, `/caixa/movimentos` (filtros + estorno),
`/caixa/sessoes`, `/financeiro`.

---

## 9. Módulo clientes, pets e serviços

Código: `apps/api/src/{clients,pets,services}`.

### Clientes
- Normalização no Zod compartilhado: telefone/CPF só dígitos, email
  minúsculo; endereço estruturado.
- **Anti-duplicidade por aplicação** (sem unique duro): criação responde
  409 `"Cliente possivelmente duplicado"` apenas quando `nameKey` **e**
  algum contato (phone/mobile/email) coincidem com cliente `ACTIVE`.
  Homônimos sem contato e famílias com mesmo telefone são permitidos.
- Permissões: leitura e escrita autenticadas (MEMBER pode — operação
  diária).
- **Enforcement de limite de plano (Etapa 11)**: criação de cliente
  bloqueada com 403 no `Essencial` (limite 200) ou `Profissional`
  (limite 1000); `Completo` ilimitado.

### Pets (módulo opcional — desativável)
- Responsável validado no servidor (ativo + mesma empresa → senão 400);
  nascimento futuro e peso fora de faixa rejeitados; `sex` default
  `UNKNOWN`; troca de responsável validada.
- **`@RequireModule(PETS)`**: empresa que desativa o módulo recebe 403
  nas rotas de pets; UI oculta os cards/links correspondentes.

### Serviços
- `@@unique([companyId, nameKey])` (case-insensitive, espaços
  colapsados) → nome repetido 409; `price Decimal(12,2)` ≥ 0;
  `durationMinutes` 1..1440; **escrita restrita a ADMIN**.
- **`@RequireModule(SERVICES)`**.

### Integração venda–cliente
- `POST /sales` aceita `clientId` opcional; listagem/detalhe retornam
  `client { id, name }`; inativar cliente nunca quebra histórico.

### Frontend
`/clientes`, `/clientes/[id]` (ficha + pets + consentimento WhatsApp),
`/pets`, `/servicos`; seletor opcional de cliente no `/pdv`.

---

## 10. Módulo WhatsApp — Cloud API + fila + webhook

Código: `packages/whatsapp`, `apps/api/src/whatsapp`, `apps/worker`.

### Decisões
- Cloud API oficial da Meta (scraping/Selenium/QR fora de escopo); fila
  em **Postgres** no worker (sem Redis/BullMQ); provedor abstraído na
  interface `WhatsAppProvider` com `MetaCloudProvider` (HTTPS, `fetch`
  injetável) e `MockWhatsAppProvider` (dev/teste, determinístico). Pasta
  `automação do whatsapp/` intocada.

### Configuração multiempresa
- Credenciais vêm primeiro de `WhatsAppConfig` (por empresa) com
  fallback em env (`WHATSAPP_PROVIDER`, `WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_API_VERSION`, `WHATSAPP_COUNTRY_CODE`).
- A API **nunca** devolve token (apenas `hasAccessToken`); erros passam
  por scrub antes de log/serialização. `status=DISCONNECTED` bloqueia
  envios.
- **`@RequireModule(WHATSAPP)`** em config/templates/consents/messages;
  o webhook permanece `@Public` (assinado).

### Processo de envio (enfileirar ≠ entregar)
1. `POST /api/whatsapp/messages`: valida no servidor cliente `ACTIVE`
   da empresa, template `APPROVED`, consentimento `OPTED_IN`, variáveis
   contra `templateVariableCount()` → grava `WhatsAppMessage` `PENDING` +
   `nextAttemptAt`. Idempotente por `clientRequestId`.
2. Worker: claim atômico `updateMany` (`PENDING/RETRY` → `SENDING`) —
   dois workers nunca enviam a mesma mensagem; chama o provedor; grava
   `WhatsAppSendAttempt` + transição de status na mesma transação.
3. Classificação de erro: 429/408/5xx = **TRANSIENT** → reagenda com
   backoff exponencial `5s · 2^n` (cap 300s) até `maxAttempts=3` →
   `FAILED`; demais = **PERMANENT** → falha imediata. Rate limit por
   ciclo (`WHATSAPP_SEND_MAX_PER_CYCLE`, `WHATSAPP_SEND_INTERVAL_MS`).
4. Cancelamentos server-side: sem consentimento, opt-out posterior ou
   config desconectada → mensagem `CANCELLED` com motivo.
5. Loop do worker: poll `WORKER_POLL_INTERVAL_MS`, heartbeat 60s,
   shutdown gracioso (SIGINT/SIGTERM). Sem worker, mensagens ficam
   `PENDING`.

### Webhook (`@Public` + assinatura)
- `GET /api/webhooks/whatsapp`: responde o challenge da Meta em
  `text/plain`.
- `POST`: valida `x-hub-signature-256` (HMAC-SHA256 do `rawBody` com
  `WHATSAPP_APP_SECRET`) → 403 se inválido; grava cada `(wamid, tipo)`
  uma única vez em `WhatsAppWebhookEvent` (**idempotência**) e então
  transiciona status (SENT/DELIVERED/READ/FAILED). Resposta `"SAIR"` →
  opt-out auditado (`source=REPLY`).

### Consentimento
- Máquina auditável `OPTED_IN`/`OPTED_OUT` por cliente+empresa; opt-in
  é ADMIN, opt-out é liberado a qualquer sessão (proteção do cliente).

### Frontend
`/whatsapp` (status/credenciais/testar conexão), `/whatsapp/templates`
(criar, aprovação interna, ativar/inativar), `/whatsapp/mensagens`
(+detalhe com tentativas), seção de consentimento em `/clientes/[id]`.

---

## 11. Módulo dashboard e relatórios

Código: `apps/api/src/reports`.

- **Agregação 100% server-side** (`ReportsService`, SQL puro com
  `companyId` no `WHERE`); o navegador só formata. Nenhum dado fictício —
  indicador inexistente volta `available:false` + motivo; ticket médio
  sem vendas é `null`, não `0`.
- **Período em UTC**: janela inclusiva `T00:00:00.000Z`–
  `T23:59:59.999Z`, default 30 dias, máximo 366; datas impossíveis
  rejeitadas; inverso/formato inválido → 400 com `issues`.
- Endpoints (apenas sessão — MEMBER pode ler; `companyId` query é
  ignorado):
  - `GET /api/reports/summary` — vendas (concluídas/canceladas, líquido/
    bruto/descontos, ticket), vendas por dia e por forma de pagamento,
    caixa, estoque (baixo/zerado), clientes novos, WhatsApp por status,
    agendamentos por status (`services`) e `servicesRealized`.
  - `GET /api/reports/sales` — totais separados concluídas ×
    canceladas + lista paginada.
  - `GET /api/reports/stock/alerts`, `/stock/movements`, `/cash`,
    `/clients`, `/whatsapp`.
- **CSV** (`format=csv` em sales, stock/alerts, stock/movements):
  helper próprio com aspas/CRLF, anti-injeção (célula iniciada por
  `=`, `+`, `-`, `@` recebe apóstrofo), teto 5000 linhas, ignora
  paginação, `Content-Disposition`.
- **Sem biblioteca de gráficos**: barras são divs CSS (decisão
  registrada).
- Dicionário de indicadores: `docs/akylla/DICIONARIO_INDICADORES.md`.
- Frontend: `/dashboard`, `/relatorios` (abas), `lib/format.ts`,
  `downloadCsv()`.

---

## 12. Módulo agendamentos

Código: `apps/api/src/appointments`.

### Decisões de escopo
- Conflito de horário da **empresa inteira**; serviços em vendas/PDV
  ficaram fora; `durationMinutes` obrigatório (1..1440); **sem
  `AdminGuard`** — MEMBER agenda (configuração de lembrete em
  `/whatsapp` continua ADMIN).
- **`@RequireModule(APPOINTMENTS)`**.

### Processo de criação/edição (`POST /api/appointments`, `PATCH /:id`)
1. Cliente envia apenas `startLocal` (`YYYY-MM-DDTHH:mm`) +
   `utcOffsetMinutes` + `clientId`, `petId`, `serviceId`, `notes`.
2. Servidor recalcula `startAt`/`endAt` sempre (nunca aceita `endAt` do
   cliente); horário no passado → 400 (tolerância 60 s).
3. Valida cliente ativo, pet do cliente, serviço ativo, todos da empresa
   (cross-tenant → 404).
4. **Conflito em transação com `FOR UPDATE` na `Company`**: sobreposição
   `startAt < endAt AND endAt > startAt` sobre `SCHEDULED`/`CONFIRMED`
   → **409**; fim-início exato é livre; `COMPLETED`/`CANCELLED`/
   `NO_SHOW` não bloqueiam; a edição exclui o próprio registro.
5. **`syncReminder` roda na mesma transação** de cada mutação.

### Transições
- `PATCH /:id/status` aceita só `CONFIRMED`/`COMPLETED`/`NO_SHOW`
  (enum com `CANCELLED` → 400; terminal → 409).
- `POST /:id/cancel`: `reason` 3..500 obrigatório, `updateMany`
  condicional → dupla corrida 409, autor/data auditados. Edição só em
  status não-terminal.

### Lembretes (reutilizam a fila do WhatsApp)
- Chave de idempotência `appointment-reminder:<id>` única por empresa,
  `origin=SERVICE_REMINDER`, `nextAttemptAt = max(now, startAt −
  reminderLeadMinutes)`.
- Variáveis: `[pet ou cliente, serviço, "dd/mm/aaaa às HH:mm"]` (rótulo
  generalizado na Etapa 10: `{{1}} tutor/pet` → `{{1}} cliente`).
- Elegibilidade **revalidada a cada mutação**: config ≠ DISCONNECTED,
  template da mesma empresa `APPROVED`/ativo com **exatamente 3
  variáveis**, cliente ativo com telefone E.164, consentimento
  `OPTED_IN`, horário futuro.
- Reagendar atualiza a pendente; cancelar/concluir/inelegível cancela
  com motivo registrado; **falha de lembrete só gera `Logger.warn`** — o
  CRUD nunca falha por causa do WhatsApp.
- Campos em `GET/PUT /api/whatsapp/config`: `reminderTemplateId`,
  `reminderLeadMinutes` (5..40320, default 1440).

### Frontend
`/agenda` (visão por dia, ←/Hoje/→, date picker, filtros, paginação),
`/agenda/novo`, `/agenda/[id]` (transições + cancelamento),
`/agenda/[id]/editar`, `components/AppointmentForm.tsx`.

---

## 13. Módulo assinaturas de clientes e billing do SaaS

Código: `apps/api/src/subscriptions` e `apps/api/src/billing`.

### Duas famílias com regras diferentes
| Família | Modelos | Escopo | Escrita |
|---|---|---|---|
| Assinaturas de **clientes do negócio** | `SubscriptionPlan`, `Subscription` | tenant-scoped (`companyId` + FK `Restrict` + índices por empresa) | `AdminGuard` + `@RequireModule(SUBSCRIPTIONS)` |
| **Billing da empresa no SaaS** | `TenantPlan`, `TenantSubscription` | globais (exceção documentável); assinatura única por empresa (`companyId @unique`) | `AdminGuard` + `@RequireModule(SUBSCRIPTIONS)`; catálogo global **sem escrita via API** |

### Assinaturas de clientes (processos)
- **Planos** `POST /api/subscription-plans`: nome único por empresa
  (`nameKey`) → 409; `durationDays` 1..3650; `price ≥ 0`.
- **Criação** `POST /api/subscriptions` (201): cliente ativo e plano
  ativo validados; `startAt` opcional (default `now`); se
  `registerPayment: true`, cria `CashMovement` `IN`/`MANUAL`
  (`inCash:true`, `subscriptionId` vinculado) em transação **após**
  `lockOpenCashSession` → caixa fechado **409**; preço vem do plano,
  nunca do cliente.
- **Renovação** `POST /:id/renew` (201): trava a sessão de caixa; novo
  período começa em `max(now, endAt)`; `renewalCount+1`,
  `lastPaymentAt=now`, status volta a `ACTIVE`; cria movimento de
  caixa vinculado; assinatura `CANCELLED` → 409; caixa fechado → 409.
- **Cancelamento** `POST /:id/cancel` (201): `reason` 3..500 obrigatório;
  `updateMany({ id, companyId, status: ACTIVE })` → 0 linhas = **409**
  (dupla corrida); grava autor/data. Cancelada é definitiva.
- **Expiração lazy, sem job**: leituras (`GET` lista/detalhe) marcam
  `EXPIRED` quando `endAt < now`.
- Frontend: `/planos` (CRUD ADMIN), `/assinaturas` (+ `nova`, `[id]`).

### Billing do SaaS (Etapa 11 — planos, limites, Mercado Pago)

**Decisões do proprietário (2026-10-12):**
- **D1**: planos do seed mantidos (Essencial R$79,90/3 usuários ·
  Profissional R$149,90/10 usuários · Completo R$249,90/ilimitado;
  30 dias). **Não anunciados publicamente.**
- **D2**: todos os limites — `userLimit`/`clientLimit`/`productLimit`
  em `TenantPlan` (`NULL` = ilimitado): Essencial 3/200/100;
  Profissional 10/1000/500; Completo ilimitado.
- **D3**: enforcement **apenas** com assinatura `ACTIVE`; sem
  assinatura, expirada ou cancelada — nenhum bloqueio (status quo).
- **D4**: gateway **Mercado Pago** em sandbox; cobrança recorrente real
  não ativada (exige E2E + aprovação).

**Enforcement de limites (`TenantLimitsService`):**
- Chamado nos `create` de `UsersService`, `ClientsService`,
  `ProductsService`.
- Conta recursos do `companyId`; se assinatura `ACTIVE` e limite
  atingido → **403** com nome do plano e mensagem de upgrade.
- `TenantLimitsModule` injetado em UsersModule, ClientsModule,
  ProductsModule.

**Gateway Mercado Pago (sandbox):**
- SDK oficial `mercadopago`; provider abstraído
  (`MockMercadoPagoProvider` para testes, `SdkMercadoPagoProvider` para
  real, `FailingMercadoPagoProvider` sem credenciais).
- `POST /api/billing/checkout` (AdminGuard): `{ planId, payerEmail }` →
  cria preapproval no MP → grava `gateway`/`gatewaySubscriptionId` na
  `TenantSubscription` com status `EXPIRED` (ativa quando webhook
  confirma) → retorna `{ checkoutUrl, gatewaySubscriptionId }`.
- `POST /api/webhooks/mercadopago` (`@Public` + assinatura HMAC
  `x-signature` com `MERCADOPAGO_WEBHOOK_SECRET`): processa eventos
  `type=preapproval`; idempotente por `gatewaySubscriptionId`; mapeia
  `authorized`→`ACTIVE`, `cancelled`→`CANCELLED`, `paused`→`EXPIRED`.
- `GET /api/billing/gateway` (AdminGuard): descreve
  `{ env: "sandbox"|"production", credentialsConfigured }`.
- Env vars: `MERCADOPAGO_ENV`, `MERCADOPAGO_ACCESS_TOKEN`,
  `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET` — todas em
  `.env.example` sem valores reais.
- Sem token → checkout retorna **400** com mensagem explícita (nunca
  cobra por engano).
- Frontend: `/faturamento`.

---

## 14. Módulo de ativação por módulos (CompanyModule — Etapa 10)

Código: `apps/api/src/company-modules`, guard em
`apps/api/src/common/guards/module.guard.ts`.

- Tabela `CompanyModule` com `@@unique([companyId, module])`; enums
  `BusinessModule` (`PETS`, `APPOINTMENTS`, `SERVICES`, `WHATSAPP`,
  `SUBSCRIPTIONS`) e `CompanyModuleStatus` (`ACTIVE`, `DISABLED`).
- **Ausência de linha = módulo ativo** (nenhuma empresa existente muda
  de comportamento). Núcleo (clientes, produtos, vendas, caixa,
  financeiro, relatórios, dashboard) **nunca é desativável**.
- `ModuleGuard` é `APP_GUARD` após `AuthGuard`; rotas com
  `@RequireModule(...)` retornam **403** se o módulo estiver
  `DISABLED`; `@Public` e rotas sem decorator nunca são bloqueadas.
- API: `GET /api/company-modules` (sessão, lista status de todos os
  módulos) e `PATCH /api/company-modules` (AdminGuard, upsert
  `{module, status}`).
- Frontend: home (`/`) filtra cards de módulos desabilitados; o guard
  protege no servidor mesmo se a UI for contornada.

---

## 15. Relógio de garantias: onde há lock, guarda ou idempotência

| Operação | Mecanismo |
|---|---|
| Abertura de caixa | `FOR UPDATE` na `Company` (1 aberta) |
| Movimentação de estoque | `FOR UPDATE` no produto |
| Criação de venda | `FOR UPDATE` nos produtos ordenados por `id` + `clientRequestId` único |
| Cancelamento de venda/caixa/assinatura/agendamento | `updateMany` condicional → 0 linhas = 409 |
| Conflito de agendamento | `FOR UPDATE` na `Company` + checagem de sobreposição |
| Envio WhatsApp | claim atômico `PENDING/RETRY → SENDING` |
| Webhook Meta | unique `(wamid, type)` |
| Lembrete de agendamento | `idempotencyKey` única por empresa |
| Estorno de caixa | `updateMany` marcando `reversedAt` |
| Webhook Mercado Pago | `gatewaySubscriptionId @unique` + `updateMany` condicional |
| Criação de checkout MP | `upsert` por `companyId` (1 assinatura) |
| Criação de usuário/cliente/produto | `TenantLimitsService` (conta + trava 403) |

---

## 16. Frontend — mapa de páginas

### Layout global (topbar B)

- Shell: `components/shell/Header.tsx` (topbar escura única com
  dropdowns agrupados, busca global, sino, perfil) + `AppShell.tsx`
  (fetch sessão/módulos; conteúdo `max-w-[1440px]` full-width).
- Sem sidebar; menu mobile em acordeão. Rotas de auth ficam fora do
  shell. Detalhes e evolução: `docs/akylla/REDESIGN_PAINEL.md`.

### Públicas
`/login`, `/cadastro`, `/redefinir-senha`.

### Área protegida (autenticada)
| Página | Módulo | Notas |
|---|---|---|
| `/` (home) | — | cards de módulos (filtrados por `CompanyModule`) |
| `/usuarios` | usuários | AdminGuard |
| `/produtos` (+novo/[id]/editar) | produtos | |
| `/categorias` | produtos | AdminGuard na escrita |
| `/fornecedores` | produtos | AdminGuard na escrita |
| `/pdv` | vendas | banner "Caixa fechado" |
| `/vendas` (+[id]) | vendas | |
| `/caixa` (+fechar/movimentos/sessoes) | caixa | |
| `/financeiro` | financeiro (AP/AR) | |
| `/clientes` (+[id]) | clientes | ficha + pets + consentimento |
| `/pets` | pets (opcional) | oculto se módulo desabilitado |
| `/servicos` | serviços | |
| `/whatsapp` (+templates/mensagens/[id]) | WhatsApp | |
| `/dashboard` | relatórios | |
| `/relatorios` | relatórios | abas + CSV |
| `/agenda` (+novo/[id]/editar) | agendamentos | |
| `/planos` | assinaturas | AdminGuard |
| `/assinaturas` (+nova/[id]) | assinaturas | |
| `/faturamento` | billing SaaS | planos, assinatura, checkout MP |
| `/importacoes` | importação | upload de planilha (multipart) + histórico `ImportBatch` |

Frontend consome a API apenas por HTTP (rewrites `/api/:path*` → 3001),
mantendo mesmo domínio/cookies. **Nenhuma regra de negócio vive no
frontend** — valores exibidos são para UX, o servidor recalcula.

---

## 17. Testes e qualidade

> Contagens correntes (nº de testes, arquivos, páginas, modelos):
> [`docs/operations/PROJECT_STATUS.md`](operations/PROJECT_STATUS.md)
> é a fonte única. Os números abaixo são o estado em 2026-10-14.

- **538/538 aprovados em 24 arquivos** contra PostgreSQL real
  (`petflow_test`, migrations aplicadas por `tests/helpers/global-setup.ts`).
- Evolução: E1 23 → E2 76 → E3 104 → E4 141 → E5 190 → E6 251 → E7 292
  → E8 337 → E9 367 → pós-E9 380 → E10 393 (company-modules +13) →
  E11 509 (tenant-limits +7, mercadopago +12, financial +19) →
  pós-E12 538 (imports +29).
- Arquivos: `auth`, `users`, `health`, `catalog`, `products`, `stock`,
  `sales`, `cash`, `clients`, `pets`, `services`, `whatsapp`, `reports`,
  `appointments`, `subscriptions`, `billing`, `password-reset`,
  `register`, `tenancy-audit`, `financial`, `company-modules`,
  `tenant-limits`, `mercadopago`, `imports`.
- Cada etapa só é encerrada com evidência: `npm run lint` (0 erros),
  `npm run typecheck` (workspaces `apps/*`), `npm test`, `npm run build`,
  `npm run db:validate`, varredura de segredos e validação E2E manual.

---

## 18. Segurança — resumo (auditado na Etapa 12)

| Área | Situação |
|---|---|
| Segredos | `.env` fora do Git; `.env.example` sem valores; nenhum hardcoded |
| Logs | Erros 500+ com stack; senhas/tokens nunca logados |
| Autenticação | Cookie HttpOnly + SameSite=Lax + Secure opcional; bcrypt 12; SHA-256 em Session; rate limit login |
| Autorização | AuthGuard global → ModuleGuard → AdminGuard; `@Public` pontual |
| Tenant | `companyId` só do contexto autenticado; grep `body.companyId` = 0 |
| Uploads | Importação de planilhas (`FileInterceptor`, campo `file`, **máx. 5 MB**); validação de extensão/conteúdo no servidor |
| Exportações | CSV isolado por empresa; anti-injeção em células |
| Webhooks | WhatsApp (`x-hub-signature-256`) e Mercado Pago (`x-signature` HMAC) assinados e idempotentes |

---

## 19. Dados de demonstração

`npm run db:seed:demo -- --company=<slug|id|email>`
(`apps/api/src/cli/seed-demo.ts`): transação única, **só em empresa
vazia**, nunca em produção. Popula categorias, fornecedores, produtos,
clientes, pets, serviços, planos, vendas em sessões de caixa,
agendamentos, assinaturas e WhatsApp completo (templates, consentimentos,
mensagens). **Nota:** o seed ainda usa dados temáticos de pet shop
("Mundo Pet") — decisão D2 da Etapa 10: reescrever com aprovação.

Bancos locais: `petflow` (dev) e `petflow_test` (testes). Empresas
existentes no dev: **Empresa Piloto (dev)** e **Mundo Pet** (demo).

---

## 20. Ambientes e variáveis de ambiente

### Ambientes
| Ambiente | Banco | Uso |
|---|---|---|
| Desenvolvimento | `petflow` (local) | Codificação, migrations |
| Teste | `petflow_test` (local, reset automático) | Suíte Vitest |
| Produção | `petflow` (servidor gerenciado) | **Não configurado** — requer backup + restore testado |

### Variáveis (todas em `.env.example` sem valores secretos)
| Variável | Padrão | Produção |
|---|---|---|
| `DATABASE_URL` | local | obrigatória |
| `AUTH_COOKIE_SECURE` | `false` | **`true`** |
| `AUTH_SESSION_TTL_HOURS` | 12 | conforme política |
| `AUTH_RATE_LIMIT_MAX` | 5 | ajustar conforme tráfego |
| `PASSWORD_RESET_ENABLED` | ausente/false | **ausente** (até fluxo com token) |
| `REGISTRATION_ENABLED` | ausente/false | **ausente** (ou com anti-abuso) |
| `WHATSAPP_PROVIDER` | `mock` | `meta` |
| `WHATSAPP_ACCESS_TOKEN` | vazio | obrigatório |
| `WHATSAPP_APP_SECRET` | vazio | obrigatório |
| `MERCADOPAGO_ENV` | `sandbox` | `production` |
| `MERCADOPAGO_ACCESS_TOKEN` | vazio | obrigatório |
| `MERCADOPAGO_WEBHOOK_SECRET` | vazio | obrigatório |
| `APP_ORIGINS` | `http://localhost:3000` | domínio real |

---

## 21. Pendências conhecidas e limitações

Classificadas no `docs/akylla/CHECKLIST_PRE_PRODUCAO.md` §3 (L1–L14).
Resumo das mais relevantes:

- **8 vulnerabilidades `npm audit`** — 6 em dependências de
  desenvolvimento (vitest/esbuild/tinypool) e **2 em produção**
  (`postcss` transitivo do `next`, severidade alta); correção exige
  upgrade do vitest e do `next` (ambos breaking change).
- **CI sem deploy** — `.github/workflows/ci.yml` cobre lint, typecheck,
  testes (Postgres 17), build e `db:validate`; `cd.yml` ainda é placeholder
  (migrations + `echo`) e depende de definição de hosting/secrets.
- **Sem backups automatizados** com restore testado — antes de produção.
- **Sem RLS no Postgres** — isolamento de tenant na camada de aplicação
  (538 testes); adicionar RLS como defesa em profundidade.
- **Sem fluxo LGPD** — direito ao esquecimento pendente.
- **Rate limit in-memory** — reseta no restart; para multi-instância
  usar Redis.
- **Cobrança recorrente real não ativada** — sandbox implementado;
  ativar exige E2E com cartão de teste + aprovação.
- **UI `/faturamento` não exibe limites/uso do plano** — backend pronto.
- **Seed ainda temático de pet shop** — reescrever com aprovação.
- **Escrita do catálogo global de planos não exposta** — exige papel de
  plataforma.
- **Redefinição de senha sem token de e-mail**; cadastro aberto sem
  captcha (flags desligadas por padrão).
- **Agenda**: visão por dia apenas (semana/mês, recorrência,
  profissionais fora do escopo).

---

## 22. Padrão obrigatório para novos módulos

1. Modelo com `companyId` + FK `Restrict` e índices por empresa.
2. `findFirst({ where: { id, companyId: auth.companyId } })` em toda
   leitura/escrita individual → 404.
3. Guards: leitura com sessão; escrita sensível com `AdminGuard`; módulo
   de nicho com `@RequireModule(...)`.
4. Nunca aceitar saldo/valores/horários críticos do cliente como fonte
   de verdade; recalcular no servidor.
5. Migration versionada em `database/prisma/migrations/` + atualização
   de `docs/architecture/DATABASE.md`.
6. Schemas Zod novos em `@petflow/shared`; testes no `petflow_test`;
   rodar `lint`, `typecheck`, `test` e `build` antes de concluir.
7. Atualizar `docs/operations/{CHANGELOG,PROJECT_STATUS,
   IMPLEMENTATION_CHECKLIST}.md` ao fim da etapa; commit apenas quando o
   proprietário solicitar.

---

## 23. Roteiro Akylla Gestão — resumo das etapas

| Etapa | Tema | Entregável principal |
|---|---|---|
| 0 | Diagnóstico do repositório | `DIAGNOSTICO_INICIAL.md` |
| 1 | Migração e linha de base | `PLANO_DE_ADAPTACAO.md` |
| 2 | Identidade Akylla Gestão | README, branding |
| 3 | Auditoria multiempresa | `AUDITORIA_MULTIEMPRESA.md` |
| 4 | Núcleo genérico | `MAPA_DE_MODULOS.md` |
| 5 | Cadastro, clientes e fornecedores | `LIMITACOES_VENDAS.md` |
| 6 | Produtos, categorias e estoque | — |
| 7 | Vendas e recebimentos | `MODELO_FINANCEIRO.md` |
| 8 | Financeiro básico (AP/AR) | `DICIONARIO_INDICADORES.md` |
| 9 | Dashboard e relatórios | — |
| 10 | Módulos específicos de pet shop | `PLANO_MODULARIZACAO.md` + CompanyModule |
| 11 | Planos e assinatura SaaS | `PLANO_BILLING.md` + limites + Mercado Pago |
| 12 | Qualidade, segurança e produção | `CHECKLIST_PRE_PRODUCAO.md` |

Todos os entregáveis estão em `docs/akylla/`. Roteiro **concluído** em
2026-10-12. Deploy e comercialização exigem aprovação explícita do
proprietário.
