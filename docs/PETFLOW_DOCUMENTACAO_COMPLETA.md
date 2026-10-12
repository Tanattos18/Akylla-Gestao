# PetFlow — Documentação técnica completa de todos os processos desenvolvidos

> Documento autocontido, gerado para ser lido por um modelo de IA (GPT) como
> fonte única de contexto sobre o projeto. Resume **tudo o que foi
> desenvolvido até o momento** (Etapa 0 → Etapa 9 + entregas pós-Etapa 9),
> com os processos internos de cada módulo: fluxos, transações, locks,
> validações, permissões, endpoints, telas e testes.
>
> Data de referência: 2026-10-12. Fonte: `docs/**` + árvore de código real.
> Sem segredos, senhas ou credenciais neste documento.

---

## 1. Visão geral

**PetFlow** é um SaaS web de gestão para pet shops de pequeno porte
(produtos, estoque, PDV, caixa, clientes/pets, serviços, WhatsApp,
agendamentos, relatórios e assinaturas), com arquitetura **multiempresa
(tenant)** desde a primeira etapa.

- Cada registro de negócio pertence a uma `Company` (tenant).
- O `companyId` é **sempre derivado da sessão autenticada**, nunca aceito do
  cliente.
- Recurso de outra empresa responde **404** (não vaza existência).

### Situação atual

| Item | Estado |
|---|---|
| Etapas do roadmap (0–9) | **Concluídas** |
| Pós-Etapa 9 (redefinição de senha, cadastro aberto, seed demo, README) | **Concluído** |
| Testes | **380/380 aprovados** (18 arquivos, PostgreSQL real) |
| Próxima etapa | **Nenhuma autorizada** — aguarda decisão do proprietário |

---

## 2. Stack e arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind CSS 4 |
| Backend | NestJS 11 + TypeScript (módulos, DI, guards, pipes, filters) |
| Banco | PostgreSQL 17 local (sem Docker), portas 5432 |
| ORM | Prisma 5 (`database/prisma/schema.prisma`, migrations versionadas) |
| Validação | Zod, schemas compartilhados em `@petflow/shared` |
| Testes | Vitest + Supertest contra PostgreSQL real (`petflow_test`) |
| Lint | ESLint 9 (flat config) + typescript-eslint |
| Fila | PostgreSQL (sem Redis/BullMQ) processada pelo `apps/worker` |

### Monorepo (npm workspaces)

```
apps/api      → NestJS        http://localhost:3001  (prefixo /api; /health fora)
apps/web      → Next.js       http://localhost:3000  (rewrites /api/:path* → 3001)
apps/worker   → tarefas em background (fila WhatsApp)
packages/shared  → @petflow/shared (schemas Zod + tipos + constantes)
packages/config  → tsconfig base
packages/whatsapp→ @petflow/whatsapp (provedor Meta/Mock, E.164, backoff, erros)
database/     → schema Prisma, migrations, seeds
tests/        → testes de integração compartilhados
docs/         → documentação
automação do whatsapp/ → base legada PRESERVADA, fora do monorepo (não mexer)
```

### Comandos

```bash
npm run dev:api      # build de shared+whatsapp e API com tsx watch
npm run dev:web      # Next.js
npm run dev:worker   # worker da fila WhatsApp
npm run lint         # ESLint no monorepo
npm run typecheck    # tsc em todos os workspaces
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
3. **Guards**: `AuthGuard` global (`APP_GUARD`) protege tudo; rotas públicas
   usam `@Public()`. `AdminGuard` exige `role: ADMIN` nas escritas sensíveis.
   Papéis: `ADMIN` e `STAFF` (a documentação às vezes chama o não-admin de
   "MEMBER").
4. **Tenant**: `request.user.companyId` é a única fonte de `companyId`;
   toda leitura/escrita individual usa
   `findFirst({ where: { id, companyId } })` → 404 se não achar.
5. **Validação**: Zod compartilhado (`@petflow/shared`) via `ZodValidationPipe`
   na entrada; resposta de erro `{ statusCode, message, timestamp, path }`
   (Zod inclui `issues[]`).
6. **Códigos**: 400 regra/payload, 401 sem sessão, 403 sem ADMIN, 404
   inexistente **ou** de outra empresa, 409 conflito (unicidade/corrida).
7. **Dinheiro**: `Decimal(12,2)`; estoque `Decimal(12,3)`; sempre serializado
   como string no wire (`"259.70"`); nada de float/binário para dinheiro.
8. **Autoridade do servidor**: preços, totais, saldos, períodos e horários
   são recalculados no backend; valores "críticos" vindos do cliente são
   ignorados.
9. **Histórico imutável**: estoque, caixa e vendas são ledgers — correção é
   movimento compensatório ou estorno auditado, nunca edição/exclusão.
10. **Concorrência**: locks pessimistas `SELECT ... FOR UPDATE` em transação,
    sempre na **mesma ordem** (sessão de caixa → produtos por `id`) para
    evitar deadlock; guards de corrida via `updateMany` condicional
    (0 linhas → 409).
11. **Idempotência**: `clientRequestId` único por empresa em vendas e
    mensagens WhatsApp; webhook idempotente por `(wamid, type)`.
12. **Injeção de dependência**: providers com injeção de construtor usam
    `@Inject()` explícito — o runtime de dev `tsx` (esbuild) não emite
    `emitDecoratorMetadata`.
13. **Segredos**: somente `.env` (nunca versionado); `.env.example` sem
    valores reais; credenciais WhatsApp nunca aparecem em resposta/log.

---

## 4. Banco de dados — processos e migrations

Migrations (todas aplicadas em `petflow` e `petflow_test`, `db:validate` OK):

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

Padrões: FK explícitas (`Restrict` para dados de negócio, `SetNull` para
autor/cancelador ou vínculos opcionais), índices compostos por `companyId`,
enums do Postgres para estados fechados, `createdAt`/`updatedAt` em toda
tabela de negócio (ledgers sem `updatedAt`), IDs CUID (`TEXT`).

Exceção documentada: `TenantPlan` e `TenantSubscription` são **globais**
(sem `companyId` no catálogo; `TenantSubscription.companyId @unique`) — o
catálogo é da plataforma.

---

## 5. Processo de autenticação e acesso (Etapa 1 + pós-Etapa 9)

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

### Cadastro aberto (pós-Etapa 9)
- `POST /api/auth/register` (201) — só responde com
  `REGISTRATION_ENABLED=true` (senão 404); rate limit por IP `register|ip`;
  email **globalmente único** → 409; slug gerado do nome da empresa com
  sufixo único; cria `Company` + `User` ADMIN em transação e **loga
  automaticamente** (mesmo `AuthService.createSession()` do login).
- Tela `/cadastro`, link "Cadastre-se" no login.

### Redefinição de senha pelo painel (pós-Etapa 9)
- `POST /api/auth/reset-password` — só com `PASSWORD_RESET_ENABLED=true`
  (senão 404); rate limit `reset|ip|email`; política 8..72; 404
  inexistente/inativo; 400 se o email pertence a várias contas; em **uma
  transação** troca o hash e **revoga todas as sessões** do usuário.
- Tela `/redefinir-senha`, link no login. Sem token de e-mail (decisão
  registrada — em produção manter a flag desligada até existir token por
  e-mail).

### Bootstrap
- `npm run bootstrap:admin`: cria `Company` + `User` ADMIN de forma
  idempotente a partir das variáveis `BOOTSTRAP_*` (sem senha padrão).

---

## 6. Módulo produtos, estoque, fornecedores (Etapa 2)

Código: `apps/api/src/{categories,suppliers,products,stock}`.

### Processo de movimentação de estoque (entrada/saída/ajuste)
1. Validação Zod (`quantity` > 0, até 3 decimais; ajuste exige `reason` ≥ 3
   e papel ADMIN).
2. Transação: lock `SELECT ... FOR UPDATE` no produto → valida saldo →
   atualiza `Product.stockQuantity` (saldo materializado) → cria
   `StockMovement` → commit. Resposta `{ movement, stockQuantity }`.
3. Saída/ajuste negativo que deixaria saldo **negativo** → 400 (estoque
   negativo nunca é permitido).
4. Movimentos não têm endpoint de update/delete: correção = novo movimento
   compensatório.

### Regras
- SKU (maiúsculas) e barcode únicos por empresa (NULLs não conflitam);
  categorias únicas por `nameKey` (`nome minúsculo com espaços colapsados`).
- Categoria/fornecedor do produto validados no servidor contra a empresa.
- Alerta de estoque baixo: `ACTIVE` + `minimumStock > 0` +
  `stockQuantity <= minimumStock`.
- Permissões: leitura autenticada; escrita de catálogo/produtos/ajustes ADMIN.
- Frontend: `/produtos`, `/produtos/novo`, `/produtos/[id]`,
  `/produtos/[id]/editar`, `/categorias`, `/fornecedores`.

---

## 7. Módulo vendas e PDV (Etapa 3)

Código: `apps/api/src/sales`.

### Processo de criação de venda (`POST /api/sales`)
1. Valida Zod: `items[{productId, quantity}]`, `discount`, `paymentMethod`
   (`CASH|CARD|PIX|OTHER`), `clientRequestId` (obrigatório), `clientId`
   opcional.
2. `clientId`, se vier, é validado **antes dos locks** (ativo + mesma
   empresa → senão 400).
3. Transação única:
   - lock `FOR UPDATE` dos produtos **em ordem de `id`**;
   - recalcula `unitPrice`/subtotal/total com `Product.salePrice` do banco
     (**preços enviados pelo cliente são descartados**);
   - cria `Sale` + `SaleItem` com **snapshot** (nome, SKU, unidade, preço,
     quantidade);
   - baixa `stockQuantity` e cria movimentos `OUT` (`reference` =
     `receiptCode`);
   - (Etapa 4) grava `cashSessionId` e um lançamento `CashMovement`
     `origin=SALE`.
4. Idempotência: `clientRequestId` único por empresa → repetição responde
   **409** sem alterar estoque. Código de comprovante `PF-XXXXXXXX` único por
   empresa, gerado no servidor (sem numeração sequencial — evita lock global
   no `Company`).
5. **Exige caixa aberto** (Etapa 4): sem sessão `OPEN` → 409.

### Cancelamento (`POST /api/sales/:id/cancel`, ADMIN)
- `reason` ≥ 3; transação com `updateMany({ status: COMPLETED })` → só o
  primeiro cancelamento devolve estoque (corrida → 409); devolve com
  movimentos `OUT` → `IN` compensatórios; cria lançamento
  `origin=SALE_CANCELMENT`; venda nunca é apagada (cancelamento lógico com
  autor/data/motivo). Também exige caixa aberto (409).

### Leitura
- `GET /api/sales` (filtros `status`, `search` por código, `from`/`to` UTC,
  paginação) e `GET /api/sales/:id` (itens com snapshots + `client`).
- Frontend: `/pdv` (busca por nome/SKU/barcode, carrinho, desconto, formas
  de pagamento, comprovante imprimível em nova janela, banner "Caixa
  fechado"), `/vendas`, `/vendas/[id]`.

---

## 8. Módulo caixa e financeiro (Etapa 4)

Código: `apps/api/src/cash`.

### Regras fundamentais
- **Uma única sessão `OPEN` por empresa**: abertura com `FOR UPDATE` na
  linha da `Company` (segunda abertura → 409). Fechamento/estorno lockam a
  própria sessão.
- **`inCash`** decide o que compõe o saldo físico: venda em `CASH` + manuais;
  CARD/PIX/OTHER geram lançamento com `inCash=false` (entram só no resumo).
- Vendas, cancelamentos e movimentações manuais **exigem caixa aberto** (409).
- Ordem de locks fixa: sessão de caixa → produtos por `id` (evita deadlock).

### Processos
- **Abertura** `POST /api/cash/sessions` (ADMIN): `{ initialAmount, notes }`.
- **Movimentação manual** `POST /api/cash/movements` (ADMIN): `IN`/`OUT`,
  `OUT` exige `justification` ≥ 3; sessão precisa estar `OPEN`.
- **Fechamento** `POST /api/cash/sessions/:id/close` (ADMIN): `expected` =
  `inicial + Σ(IN inCash) − Σ(OUT inCash)` e `difference = contado −
  expected` calculados **no servidor** (nunca do cliente); duplo fechamento →
  409.
- **Estorno auditável** `POST /api/cash/movements/:id/reversal` (ADMIN):
  apenas lançamento `MANUAL` não estornado na sessão aberta; cria
  `REVERSAL` do tipo oposto e marca o original (`reversedAt` via `updateMany`
  condicional → corrida 409). Estorno de venda → 400 (usar cancelamento).
- **Resumo** `GET /api/cash/summary`: agregações por origem/tipo/período/
  sessão (vendas, manuais, cancelamentos, estornos, entradas, saídas, líquido).
- Leitura para qualquer sessão; escrita restrita a ADMIN.
- Frontend: `/caixa`, `/caixa/fechar`, `/caixa/movimentos` (filtros + estorno),
  `/caixa/sessoes`, `/financeiro`.

---

## 9. Módulo clientes, pets e serviços (Etapa 5)

Código: `apps/api/src/{clients,pets,services}`.

### Clientes
- Normalização no Zod compartilhado: telefone/CPF só dígitos, email
  minúsculo; endereço estruturado.
- **Anti-duplicidade por aplicação** (sem unique duro): criação responde 409
  `"Cliente possivelmente duplicado"` apenas quando `nameKey` **e** algum
  contato (phone/mobile/email) coincidem com cliente `ACTIVE`. Homônimos sem
  contato e famílias com mesmo telefone são permitidos; `INACTIVE` não
  bloqueia. Janela de corrida aceita (documentada).
- Permissões: leitura e escrita autenticadas (MEMBER pode — operação diária).

### Pets
- Responsável validado no servidor (ativo + mesma empresa → senão 400);
  nascimento futuro e peso fora de faixa rejeitados; `sex` default
  `UNKNOWN`; troca de responsável validada.

### Serviços
- `@@unique([companyId, nameKey])` (case-insensitive, espaços colapsados) →
  nome repetido 409; `price Decimal(12,2)` ≥ 0; `durationMinutes` 1..1440;
  **escrita restrita a ADMIN** (catálogo/preços).

### Integração venda–cliente
- `POST /sales` aceita `clientId` opcional; listagem/detalhe retornam
  `client { id, name }`; inativar cliente nunca quebra histórico.

### Frontend
`/clientes`, `/clientes/[id]` (ficha + pets), `/pets`, `/servicos`; seletor
opcional de cliente no `/pdv`.

---

## 10. Módulo WhatsApp — Cloud API + fila + webhook (Etapa 6)

Código: `packages/whatsapp`, `apps/api/src/whatsapp`, `apps/worker`.

### Decisões
- Cloud API oficial da Meta (scraping/Selenium/QR fora de escopo); fila em
  **Postgres** no worker (sem Redis/BullMQ); provedor abstraído na interface
  `WhatsAppProvider` com `MetaCloudProvider` (HTTPS, `fetch` injetável) e
  `MockWhatsAppProvider` (dev/teste, determinístico). Pasta
  `automação do whatsapp/` intocada.

### Configuração multiempresa
- Credenciais vêm primeiro de `WhatsAppConfig` (por empresa) com fallback em
  env (`WHATSAPP_PROVIDER`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`,
  `WHATSAPP_APP_SECRET`, `WHATSAPP_API_VERSION`, `WHATSAPP_COUNTRY_CODE`).
- A API **nunca** devolve token (apenas `hasAccessToken`); erros passam por
  scrub antes de log/serialização. `status=DISCONNECTED` bloqueia envios.

### Processo de envio (enfileirar ≠ entregar)
1. `POST /api/whatsapp/messages`: valida no servidor cliente `ACTIVE` da
   empresa, template `APPROVED`, consentimento `OPTED_IN`, variáveis contra
   `templateVariableCount()` → grava `WhatsAppMessage` `PENDING` +
   `nextAttemptAt`. Idempotente por `clientRequestId`.
2. Worker (`apps/worker`): claim atômico `updateMany` (`PENDING/RETRY` →
   `SENDING`) — dois workers nunca enviam a mesma mensagem; chama o
   provedor; grava `WhatsAppSendAttempt` + transição de status na mesma
   transação.
3. Classificação de erro: 429/408/5xx = **TRANSIENT** → reagenda com backoff
   exponencial `5s · 2^n` (cap 300s) até `maxAttempts=3` → `FAILED`;
   demais = **PERMANENT** → falha imediata. Rate limit por ciclo
   (`WHATSAPP_SEND_MAX_PER_CYCLE`, `WHATSAPP_SEND_INTERVAL_MS`).
4. Cancelamentos server-side: sem consentimento, opt-out posterior ou config
   desconectada → mensagem `CANCELLED` com motivo, sem chamar o provedor.
5. Loop do worker: poll `WORKER_POLL_INTERVAL_MS`, heartbeat 60s, shutdown
   gracioso (SIGINT/SIGTERM). Sem worker, mensagens ficam `PENDING`.

### Webhook (`@Public`)
- `GET /api/whatsapp/webhook`: responde o challenge da Meta em `text/plain`.
- `POST`: valida `x-hub-signature-256` (HMAC-SHA256 do `rawBody` com
  `WHATSAPP_APP_SECRET`) → 403 se inválido; grava cada `(wamid, tipo)` uma
  única vez em `WhatsAppWebhookEvent` (**idempotência** — reentrega da Meta
  não duplica efeito) e então transiciona status
  (SENT/DELIVERED/READ/FAILED). Resposta `"SAIR"` → opt-out auditado
  (`source=REPLY`).

### Consentimento
- Máquina auditável `OPTED_IN`/`OPTED_OUT` por cliente+empresa; opt-in é
  ADMIN, opt-out é liberado a qualquer sessão (proteção do cliente).

### Frontend
`/whatsapp` (status/credenciais/testar conexão), `/whatsapp/templates`
(criar, aprovação interna, ativar/inativar), `/whatsapp/mensagens` (+detalhe
com tentativas), seção de consentimento em `/clientes/[id]`.

---

## 11. Módulo dashboard e relatórios (Etapa 7)

Código: `apps/api/src/reports`.

- **Agregação 100% server-side** (`ReportsService`, SQL puro com `companyId`
  no `WHERE`); o navegador só formata. Nenhum dado fictício — indicador
  inexistente volta `available:false` + motivo; ticket médio sem vendas é
  `null`, não `0`.
- **Período em UTC**: janela inclusiva `T00:00:00.000Z`–`T23:59:59.999Z`,
  default 30 dias, máximo 366; datas de calendário impossíveis
  (`2026-02-30`) rejeitadas por round-trip ISO; inverso/formato inválido →
  400 com `issues`.
- Endpoints (apenas sessão — MEMBER pode ler; `companyId` query é ignorado):
  - `GET /api/reports/summary` — vendas (concluídas/canceladas, líquido/
    bruto/descontos, ticket), vendas por dia e por forma de pagamento,
    caixa, estoque (baixo/zerado), clientes/pets novos, WhatsApp por status,
    agendamentos por status (`services`) e `modules.servicesRealized`.
  - `GET /api/reports/sales` — totais separados concluídas × canceladas
    (filtro `status` afeta **só a lista**; `paymentMethod` afeta os totais) +
    lista paginada.
  - `GET /api/reports/stock/alerts`, `/stock/movements`, `/cash`,
    `/clients`, `/whatsapp`.
- **CSV** (`format=csv` em sales, stock/alerts, stock/movements): helper
  próprio com aspas/CRLF, anti-injeção (célula iniciada por `=`, `+`, `-`,
  `@` recebe apóstrofo), teto 5000 linhas, ignora paginação,
  `Content-Disposition`.
- **Sem biblioteca de gráficos**: barras são divs CSS (decisão registrada).
- Frontend: `/dashboard`, `/relatorios` (abas), `lib/format.ts`,
  `downloadCsv()`.

---

## 12. Módulo agendamentos (Etapa 8)

Código: `apps/api/src/appointments`.

### Decisões de escopo
- Conflito de horário da **empresa inteira**; serviços em vendas/PDV ficaram
  fora; `durationMinutes` obrigatório (1..1440); **sem `AdminGuard`** —
  MEMBER agenda (a configuração de lembrete em `/whatsapp` continua ADMIN).

### Processo de criação/edição (`POST /api/appointments`, `PATCH /:id`)
1. Cliente envia apenas `startLocal` (`YYYY-MM-DDTHH:mm`) +
   `utcOffsetMinutes` (`-getTimezoneOffset()`, leste-positivo ±840) +
   `clientId`, `petId`, `serviceId`, `notes`.
2. Servidor recalcula `startAt`/`endAt` sempre (nunca aceita `endAt` do
   cliente); horário no passado → 400 (tolerância 60 s).
3. Valida cliente ativo, pet do cliente, serviço ativo, todos da empresa
   (cross-tenant → 404).
4. **Conflito em transação com `FOR UPDATE` na `Company`** (mesmo padrão da
   sessão de caixa): sobreposição `startAt < endAt AND endAt > startAt` sobre
   `SCHEDULED`/`CONFIRMED` → **409**; fim-início exato é livre;
   `COMPLETED`/`CANCELLED`/`NO_SHOW` não bloqueiam; a edição exclui o próprio
   registro. Unique duro descartado (a coluna `startLocal` é string de
   parede).
5. **`syncReminder` roda na mesma transação** de cada mutação.

### Transições
- `PATCH /:id/status` aceita só `CONFIRMED`/`COMPLETED`/`NO_SHOW` (enum com
  CANCELLED → 400; terminal → 409).
- `POST /:id/cancel`: `reason` 3..500 obrigatório, `updateMany` condicional
  → dupla corrida 409, autor/data auditados. Edição só em status não-terminal.

### Lembretes (reutilizam a fila da Etapa 6, worker intocado)
- Chave de idempotência `appointment-reminder:<id>` única por empresa,
  `origin=SERVICE_REMINDER`, `nextAttemptAt = max(now, startAt −
  reminderLeadMinutes)`.
- Variáveis: `[pet ou tutor, serviço, "dd/mm/aaaa às HH:mm"]`.
- Elegibilidade **revalidada a cada mutação**: config ≠ DISCONNECTED,
  template selecionado da mesma empresa `APPROVED`/ativo com **exatamente 3
  variáveis**, cliente ativo com telefone E.164, consentimento `OPTED_IN`,
  horário futuro.
- Reagendar atualiza a pendente; cancelar/concluir/inelegível cancela com
  motivo registrado; **falha de lembrete só gera `Logger.warn`** — o CRUD
  nunca falha por causa do WhatsApp.
- Campos em `GET/PUT /api/whatsapp/config`: `reminderTemplateId`,
  `reminderLeadMinutes` (5..40320, default 1440).

### Frontend
`/agenda` (visão por dia, ←/Hoje/→, date picker, filtros, paginação),
`/agenda/novo`, `/agenda/[id]` (transições + cancelamento),
`/agenda/[id]/editar`, `components/AppointmentForm.tsx`. Relatórios ganharam
`summary.services` e `clients.services` (contagens por status) e
`servicesRealized` passou a `available:true`.

---

## 13. Módulo assinaturas e billing (Etapa 9)

Código: `apps/api/src/subscriptions` e `apps/api/src/billing`.

### Duas famílias com regras diferentes
| Família | Modelos | Escopo | Escrita |
|---|---|---|---|
| Assinaturas de **clientes do pet shop** | `SubscriptionPlan`, `Subscription` | tenant-scoped (`companyId` + FK `Restrict` + índices por empresa) | `AdminGuard` |
| **Billing da empresa no SaaS** | `TenantPlan`, `TenantSubscription` | globais (exceção documentável); assinatura única por empresa (`companyId @unique`) | `AdminGuard`; catálogo global **sem escrita via API** |

### Processos
- **Planos** `POST /api/subscription-plans`: nome único por empresa
  (`nameKey`) → 409; `durationDays` 1..3650; `price ≥ 0`.
- **Criação de assinatura** `POST /api/subscriptions` (201): cliente ativo e
  plano ativo validados (cross-tenant → 404, inativo → 400); `startAt`
  opcional (default `now`); se `registerPayment: true`, cria `CashMovement`
  `IN`/`MANUAL` (`inCash:true`, `subscriptionId` vinculado) em transação
  **após** `lockOpenCashSession` → caixa fechado **409**; preço vem do plano,
  nunca do cliente.
- **Renovação** `POST /:id/renew` (201): trava a sessão de caixa; novo
  período começa em `max(now, endAt)` (renovar antes do fim não perde dias);
  `renewalCount+1`, `lastPaymentAt=now`, status volta a `ACTIVE`; cria
  movimento de caixa vinculado; assinatura `CANCELLED` → 409; caixa fechado
  → 409.
- **Cancelamento** `POST /:id/cancel` (201): `reason` 3..500 obrigatório;
  `updateMany({ id, companyId, status: ACTIVE })` → 0 linhas = **409**
  (dupla corrida); grava autor/data. Cancelada é definitiva (reativação seria
  nova assinatura).
- **Expiração lazy, sem job**: leituras (`GET` lista/detalhe) marcam
  `EXPIRED` quando `endAt < now`.
- **Billing**: `GET /api/billing/plans` (catálogo global ativo),
  `GET /api/billing/subscription` (404 se ausente), `PUT` (upsert — troca de
  plano **reinicia o período** e reativa), `POST .../renew` (cancelada →
  409), `POST .../cancel` (`reason?` ≤ 500, duplo → 409).
- **Sem gateway** (pagamento sempre pelo caixa) e **sem enforcement** de
  limites por plano ainda (pendência registrada).
- Frontend: `/planos` (CRUD ADMIN), `/assinaturas` (+ `nova`, `[id]`),
  `/faturamento`.

---

## 14. Relógio de garantias: onde há lock, guarda ou idempotência

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

---

## 15. Frontend — mapa de páginas

`/login`, `/cadastro`, `/redefinir-senha`, `/` (home com cards de módulos),
`/usuarios`, `/produtos`(+novo/[id]/editar), `/categorias`, `/fornecedores`,
`/pdv`, `/vendas`(+[id]), `/caixa`(+fechar/movimentos/sessoes),
`/financeiro`, `/clientes`(+[id]), `/pets`, `/servicos`, `/whatsapp`
(+templates/mensagens/[id]), `/dashboard`, `/relatorios`, `/agenda`
(+novo/[id]/editar), `/planos`, `/assinaturas`(+nova/[id]), `/faturamento`.

Frontend consome a API apenas por HTTP (rewrites `/api/:path*` → 3001),
mantendo mesmo domínio/cookies. **Nenhuma regra de negócio vive no
frontend** — valores exibidos são para UX, o servidor recalcula.

---

## 16. Testes e qualidade

- **380/380 aprovados em 18 arquivos** contra PostgreSQL real (`petflow_test`,
  migrations aplicadas por `tests/global-setup.ts`).
- Evolução: E1 23 → E2 76 → E3 104 → E4 141 → E5 190 → E6 251 → E7 292 →
  E8 337 → E9 367 → pós-E9 380.
- Arquivos: `auth`, `users`, `health`, `catalog`, `products`, `stock`,
  `sales`, `cash`, `clients`, `pets`, `services`, `whatsapp`, `reports`,
  `appointments`, `subscriptions`, `billing`, `password-reset`, `register`.
- Cada etapa só é encerrada com evidência: `npm run lint` (0 erros),
  `npm run typecheck` (5 workspaces), `npm test`, `npm run build`,
  `npm run db:validate`, varredura de segredos e validação E2E manual.

---

## 17. Dados de demonstração

`npm run db:seed:demo -- --company=<slug|id|email>` (`apps/api/src/cli/
seed-demo.ts`): transação única, **só em empresa vazia**, nunca em
produção. Popula 6 categorias, 5 fornecedores, 32 produtos, 24 clientes,
26 pets, 8 serviços, 4 planos, ~44 vendas em 8 sessões de caixa, 20
agendamentos, 8 assinaturas, tenant "Profissional" e WhatsApp completo
(templates, consentimentos, mensagens). Integridade conferida antes da
entrega (estoque×movimentos, totais de venda, saldos/diferenças de caixa,
`startLocal`×`startAt`).

Bancos locais: `petflow` (dev) e `petflow_test` (testes). Empresas existentes
no dev: **Empresa Piloto (dev)** e **Mundo Pet** (demo).

---

## 18. Pendências conhecidas (foram registradas, não implementadas)

- CI (lint + typecheck + testes) e deploy.
- Credenciais reais da Meta só no `.env` local; webhook exige URL pública
  (ngrok/domínio).
- **Billing**: escrita do catálogo global `TenantPlan` não exposta; gatilho
  de limites de uso por plano (clientes/usuários/módulos) sem enforcement.
- Pagamento de assinatura sempre em Dinheiro no caixa (sem método/cartão);
  renovação manual, sem cobrança recorrente automática; sem gateway.
- Redefinição de senha sem token de e-mail; cadastro aberto sem verificação
  de e-mail/captcha (flags desligadas por padrão).
- Validação de dígitos verificadores de CPF/CNPJ; duplicidade de cliente com
  janela de corrida aceita.
- Agenda: visão por dia apenas (semana/mês, recorrência, profissionais,
  horário de funcionamento). Lembretes sem janela de silêncio por cliente.
- Itens de serviço em vendas/PDV fora do escopo; formas de pagamento não
  configuráveis; CSV só em alguns relatórios; gráficos sem lib externa.
- Estoque negativo nunca permitido (backorder seria decisão explícita).
- Entrega de mensagens fora da janela de 24 h da Meta (template vs. sessão)
  — revisar política na publicação.

---

## 19. Padrão obrigatório para novos módulos

1. Modelo com `companyId` + FK `Restrict` e índices por empresa.
2. `findFirst({ where: { id, companyId: auth.companyId } })` em toda
   leitura/escrita individual → 404.
3. Guards: leitura com sessão; escrita sensível com `AdminGuard`.
4. Nunca aceitar saldo/valores/horários críticos do cliente como fonte de
   verdade; recalcular no servidor.
5. Migration versionada em `database/prisma/migrations/` + atualização de
   `docs/architecture/DATABASE.md`.
6. Schemas Zod novos em `@petflow/shared`; testes no `petflow_test`; rodar
   `lint`, `typecheck`, `test` e `build` antes de concluir.
7. Atualizar `docs/operations/{CHANGELOG,PROJECT_STATUS,IMPLEMENTATION_
   CHECKLIST}.md` ao fim da etapa; commit apenas quando o proprietário
   solicitar.
