# Akylla Gestão — Documentação técnica completa

> Documento **autocontido**, gerado para ser lido por um modelo de IA
> como fonte única de contexto sobre o projeto. Resume **tudo o que
> existe**: o Roteiro Akylla Gestão (Etapas 0→12, concluído em
> 2026-10-12), todas as entregas **fora do roteiro** (importação de
> planilhas, reorganização estrutural, correção documental, catálogos
> de melhoria e plano comercial) e os processos internos de cada
> módulo: fluxos, transações, locks, validações, permissões,
> endpoints, telas e testes.
>
> **Produto:** **Akylla Gestão** — SaaS multiempresa para pequenos
> negócios brasileiros (nicho pet shop removido da navegação; módulos
> genéricos reutilizáveis). Monorepo adaptado e renomeado em 2026-10-12.
>
> **Estado em 2026-10-14:** código completo e testado (**538/538**),
> sem deploy, sem backup e sem cobrança real. O caminho até o primeiro
> cliente pagante está no §28.
>
> **O que este documento NÃO é:** não é plano aprovado. As seções §26–§28
> são **catálogos e propostas** — nada deles foi executado. Regra 2 do
> `AGENTS.md` vale: sem autorização do proprietário, não se avança.
>
> Fonte: `docs/**`, `upgrade/**` + árvore de código real. Sem segredos,
> senhas ou credenciais neste documento.

---

## Índice de navegação

| § | Seção | Natureza |
|---|---|---|
| 1–15 | Visão geral, stack, convenções e módulos | **Fato** — código implementado |
| 16 | Frontend — mapa de páginas | **Fato** |
| 17–20 | Testes, segurança, demo, ambientes | **Fato** |
| 21–22 | Pendências e padrão de módulos | **Fato** (lacunas) + regra |
| 23 | Roteiro Etapas 0–12 | **Fato** (histórico) |
| **24** | **Importação de planilhas CSV** | **Fato** — implementado e testado |
| **25** | **Entregas fora do roteiro** | **Fato** — entregues em 2026-10 |
| **26** | **Catálogo de melhorias (backend/segurança/operação)** | **Proposta** — não executado |
| **27** | **Catálogo de design (frontend)** | **Proposta** — não executado |
| **28** | **Plano do primeiro cliente pagante** | **Proposta** — não executado |
| **29** | **Mapa de documentos do projeto** | Índice das fontes |

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

### Situação atual (2026-10-14)

| Item | Estado |
|---|---|
| Roteiro Akylla Gestão (Etapas 0–12) | **CONCLUÍDO** (2026-10-12) |
| Entregas fora do roteiro | **5 concluídas** (§25): importação, reorganização, correção documental, catálogos, plano comercial |
| Testes | **538/538 aprovados** (24 arquivos, PostgreSQL real) |
| Código | 26 controllers · 28 models · 32 enums · 39 páginas · 13 migrations |
| CI | Ativa — lint, typecheck, testes (Postgres 17), build, `db:validate` |
| CD / deploy | **Não realizado** — `cd.yml` é placeholder; requer decisão de hosting |
| Backup | **Não existe** — sem `pg_dump` agendado nem restore testado |
| LGPD | **Não existe** — direito ao esquecimento pendente |
| Gateway Mercado Pago | Sandbox implementado; **cobrança real nunca validada** |
| Monitoramento | **Não existe** |
| `npm audit --omit=dev` | **2 vulnerabilidades** (`postcss` via `next`, severidade alta) |
| Próximo passo | §28 — plano de 3 semanas até o primeiro cliente pagante (aguarda autorização) |

---

## 1.1. Resumo executivo para quem lê pela primeira vez

Em uma frase: **é um SaaS de gestão multiempresa completo e
extensivamente testado, que ainda não foi para o ar.**

| Pergunta | Resposta |
|---|---|
| O que faz? | Gestão para pequenos negócios: cadastros, estoque, PDV, caixa, financeiro, clientes, serviços, WhatsApp, agendamentos, relatórios e assinatura SaaS |
| Como isola empresas? | `companyId` obrigatório em toda entidade; sempre derivado da sessão; recurso alheio responde 404 |
| Qual o diferencial técnico? | 538 testes contra PostgreSQL real; trilha de auditoria imutável (correção = movimento compensatório); importação de planilhas; WhatsApp nativo com consentimento |
| O que falta para produzir? | Deploy, backup com restore testado, LGPD, monitoramento, E2E real do Mercado Pago (§21 e §28) |
| Dá para vender hoje? | Não para produção paga; sim para **piloto fechado e pago** (§28) |

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
config/         → ESLint 9 flat config, Vitest, Playwright, tsconfig base
scripts/        → setup:dev, db.mjs (reset|studio|seed|status)
tests/          → testes de integração (integration/) + helpers compartilhados
backup/         → README de procedimento de backup (contém SÓ o README)
upgrade/        → catálogos de melhoria (backend MELHORIAS.md, design MELHORIAS_DESIGN.md)
.github/        → workflows ci.yml (ativo) e cd.yml (placeholder)
docs/           → documentação
automação do whatsapp/ → base legada PRESERVADA, fora do monorepo (não mexer)
```

A pasta `automação do whatsapp/` é história do projeto e está
**excluída** do lint e do build (regra 12 do `AGENTS.md`).

### Comandos

```bash
# desenvolvimento
npm run dev:api        # build de shared+whatsapp e API com tsx watch
npm run dev:web        # Next.js
npm run dev:worker     # worker da fila WhatsApp
npm run setup:dev      # setup inicial do ambiente

# verificação (sequência padrão antes de concluir qualquer tarefa)
npm run validate       # roda as 5 abaixo em sequência
npm run lint           # ESLint no monorepo
npm run typecheck      # tsc nos workspaces apps/* (api, web, worker)
npm test               # Vitest (aplica migrations no petflow_test)
npm run build          # build de todos os workspaces
npm run db:validate    # valida schema Prisma (requer DATABASE_URL)

# banco de dados
npm run db:generate                # gera o client Prisma
npm run db:migrate                 # aplica migrations pendentes
npm run db:deploy                  # aplica migrations em produção (migrate deploy)
npm run db -- reset                # drop + migrations + seed (DEV ONLY)
npm run db -- studio               # Prisma Studio
npm run db -- seed                 # aplica seed de demonstração
npm run db -- status               # status das migrations
npm run db:seed:demo -- --company=<slug|id|email>   # dados de demonstração
npm run bootstrap:admin                              # empresa + 1º ADMIN (idempotente)
```

Atenção operacional: `npm run build` e `npm run dev:web` **não podem rodar
ao mesmo tempo** (ambos escrevem em `apps/web/.next`).

### CI (GitHub Actions)

| Workflow | Gatilho | O que faz |
|---|---|---|
| `ci.yml` | push/PR | lint → typecheck → testes com **PostgreSQL 17 real** (serviço) → build → `db:validate` |
| `cd.yml` | push em `main` | **placeholder**: sobe dependências, build, `db:deploy`, e um `echo` no lugar do deploy real (`cd.yml:40` e `cd.yml:75`) |

A CI é ativa e verde. O CD ainda não entrega nada — é a pendência L7.

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
- **Cobertura real dos testes:** API de ponta a ponta em PostgreSQL real
  — controllers, guards, transações, limites de plano, webhooks e
  importação. **Não** cobrem: componentes React, `fetch` do `AppShell`,
  rewrites do Next, nem navegador (§26 §4.2). Um link quebrado no
  frontend passa 100% verde hoje.
- **Só existe validação automatizada em API.** A validação E2E de
  interface é **manual** por regra de encerramento de etapa.
- Cada etapa só é encerrada com evidência: `npm run lint` (0 erros),
  `npm run typecheck` (workspaces `apps/*`), `npm test`, `npm run build`,
  `npm run db:validate`, varredura de segredos e validação E2E manual.
- O atalho único é `npm run validate` (lint + typecheck + test +
  build + db:validate em sequência).

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

> Classificadas no `docs/akylla/CHECKLIST_PRE_PRODUCAO.md` §3 (L1–L14).
> As **ideias de solução** para cada uma estão catalogadas no §26
> (backend/operação) e §27 (design). O **plano de execução** está no §28.

### Bloqueiam produção (L1, L4, L7, L8, L9, L13)

- **L1 — 8 vulnerabilidades `npm audit`** — 6 em dependências de
  desenvolvimento (vitest/esbuild/tinypool) e **2 em produção**
  (`postcss` transitivo do `next`, severidade alta: XSS e path
  traversal); correção exige upgrade do `vitest` e do `next` (ambos
  breaking change). Solução: §26 §4.3.
- **L7 — CI sem deploy** — `ci.yml` cobre lint, typecheck, testes
  (Postgres 17), build e `db:validate`; `cd.yml` ainda é placeholder
  (migrations + `echo`) e depende de definição de hosting/secrets.
  Solução: §26 §2.2.
- **L8 — Sem backups automatizados** com restore testado. Solução:
  §26 §1.1. **É o risco mais alto**: um `db:reset` acidental = perda
  total de dado do cliente pagante.
- **L4 — Sem fluxo LGPD** — `Client` guarda nome, telefone, e-mail,
  CPF e endereço **sem nenhum caminho de remoção**. Solução: §26 §1.2.
- **L9 — Sem monitoramento** — um erro 500 em produção é descoberto
  pelo cliente. Solução: §26 §2.1.
- **L13 — Cobrança recorrente real não ativada** — o gateway está
  implementado e testado com `MockMercadoPagoProvider`, que prova a
  lógica interna, **não** a integração real. Solução: §26 §2.4.

### Degradam a operação (L2, L3, L5, L6, L10, L12, L14)

- **L2 — Rate limit in-memory** — reseta no restart e não vale entre
  instâncias. Solução: §26 §1.3.
- **L3 — Sem RLS no Postgres** — isolamento de tenant depende
  inteiramente da aplicação lembrar de filtrar por `companyId`
  (538 testes cobrem isso, mas é defesa em profundidade). Solução:
  §26 §1.4.
- **L5 — Redefinição de senha sem token** — `PASSWORD_RESET_ENABLED`
  redefine **sem qualquer token**; quem habilita em produção entrega a
  conta de qualquer usuário. Solução: §26 §1.5.
- **L6 — Cadastro público sem anti-abuso** — `REGISTRATION_ENABLED`
  permite criar empresa + ADMIN ilimitadamente. Solução: §26 §1.6.
- **L10 — Expiração de assinatura lazy** — acontece na leitura; empresa
  com assinatura vencida funciona até alguém abrir a tela certa.
  Solução: §26 §2.3.
- **L12 — `/faturamento` não exibe limites/uso do plano** — o backend
  já expõe `userLimit`/`clientLimit`/`productLimit`; falta a tela.
  Solução: §26 §5.1.
- **L14 — Catálogo global de planos não editável** — os planos se
  alteram **no banco**, sem trilha. Solução: §26 §6.4.

### Menores e de produto

- **L11 — Seed ainda temático de pet shop** ("Mundo Pet") — reescrever
  com aprovação. Solução: §26 §6.3.
- **Sem edição dos dados da empresa** — lacuna D1 do
  `MAPA_DE_MODULOS.md`: `Company` tem `name`/`slug` e **não há nenhuma
  forma de editar**. Solução: §26 §5.2.
- **Agenda**: visão por dia apenas (semana/mês, recorrência,
  profissionais fora do escopo). Solução: §26 §5.3.
- **PDV não imprime** — cupom não fiscal e second display fora do
  escopo. Solução: §26 §5.6.
- **Débitos de design medidos** — 7 achados reais no frontend
  (D-1 a D-7), incluindo contraste reprovado em WCAG AA. Solução: §27 §0.

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

---

## 24. Módulo importação de planilhas CSV

> Entrega **fora do roteiro** (§25), implementada e testada: +29 testes
> (509 → 538). É o módulo que permite ao cliente migrar do Excel.

### Arquivos

| Arquivo | Papel |
|---|---|
| `apps/api/src/imports/imports.module.ts` | módulo Nest |
| `apps/api/src/imports/imports.controller.ts` | rotas |
| `apps/api/src/imports/imports.service.ts` | parsing, classificação, inserção |
| `tests/integration/imports.test.ts` | 29 testes |
| `database/prisma/migrations/..._import_batch/` | modelo `ImportBatch` |
| `apps/web/src/app/importacoes/` | tela de upload + histórico |

### Rotas (todas com `AdminGuard`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/imports/template?type=` | baixa o modelo CSV daquele tipo (com BOM, separador `;`, exemplos) |
| `POST` | `/api/imports` | upload multipart (`file`) + `type` + `dryRun` |
| `GET` | `/api/imports` | histórico paginado de `ImportBatch` |

### Tipos suportados

`CATEGORY` · `SUPPLIER` · `PRODUCT` · `CLIENT` · `SERVICE`

Cada tipo tem `REQUIRED_COLUMNS` e `TEMPLATE_HEADERS` próprios. Exemplo
— `PRODUCT` exige `nome`; aceita `sku`, `codigo_barras`, `unidade`,
`preco_custo`, `preco_venda`, `estoque_minimo`, `saldo_inicial`,
`categoria`, `fornecedor`.

### Fluxo do upload (`ImportsService.upload`)

1. **Validação do arquivo**: presença, extensão `.csv`, tamanho ≤
   `IMPORT_MAX_FILE_BYTES` (5 MB), `originalname` truncado em 255.
2. **Parsing** (`parseRows`): UTF-8 com BOM; **delimitador autodetectado**
   (conta `;` vs `,` na primeira linha); cabeçalhos **normalizados**
   (remove acento, lowercase, só `[a-z0-9]` — `preço de custo` vira
   `precocusto`); valida colunas obrigatórias; descarta linhas vazias.
   Limite de **5000 linhas** de dados.
3. **Contexto** (`buildContext`): carrega categorias, fornecedores e
   chaves existentes da **empresa autenticada** para deduplicação.
4. **Classificação** (`classify`): por linha, aplica o schema Zod
   correspondente de `@petflow/shared`; classifica como **payload**
   (válido e novo), **skip** (duplicado existente ou repetido na
   planilha) ou **erro** (validação falhou, com `row` + mensagem).
   - Números aceitam **formato BR** (`1.234,56`) e neutro (`1234.56`) —
     `parseDecimalCell`.
   - `PRODUCT` resolve `categoria`/`fornecedor` **por nome**; se não
     achar, erro de linha (não cria órfão).
   - `saldo_inicial > 0` gera `StockMovement` `IN` com `reference` =
     filename — o estoque inicial tem origem auditável.
5. **Limite de plano** (`assertPlanLimit`): só para `CLIENT` e
   `PRODUCT`, e **somente se a assinatura for `ACTIVE`**. Se
   `current + count > limit`, lança `403` com o nome do plano.
   Assinatura nula ou não-ativa = **sem limite** (equivalente ao plano
   Completo — ver `tenant-limits.service.ts`).
6. **Dry run**: retorna o relatório **sem gravar nada** (`batchId:
   null`). É o modo de revisão antes de confirmar.
7. **Gravação**: **transação única** — ou tudo entra, ou nada. No
   sucesso cria `ImportBatch` com contagens e até 100
   `errorDetails`. Na falha, cria `ImportBatch` `FAILED` (best-effort)
   e relança.

### Relatório (`ImportReport`)

`dryRun`, `batchId`, `type`, `filename`, `totalRows`, `created`,
`skipped`, `errors`, `errorDetails[]` (cada um com `row` e `message`,
máx. 100).

### Segurança

- `AdminGuard` em todas as rotas.
- `companyId` sempre do contexto autenticado.
- Limite de 5 MB e 5000 linhas (anti-DoS).
- Parsing sem `eval`; CSV tratado como dados.
- Deduplicação por empresa — nunca cruza tenants.

### Tela

`/importacoes`: escolher tipo, baixar modelo, enviar CSV, rodar em
`dryRun`, revisar o relatório e confirmar. Abaixo, histórico de
`ImportBatch` com autor, contagens e status.

---

## 25. Entregas fora do roteiro (outubro de 2026)

Cinco entregas autorizadas pelo proprietário após a conclusão da
Etapa 12. **Nenhuma alterou código de negócio.**

| # | Entrega | Commits | O que fez |
|---|---|---|---|
| 1 | **Importação de planilhas** | (Etapa 12.5) | Novo módulo completo com 29 testes — §24 |
| 2 | **Reorganização estrutural** | `d37b7ec`, `8707d47` | Extração de `config/` (ESLint, Vitest, Playwright, tsconfig), `scripts/`, separação de `tests/`, workflows `.github/`, `.gitignore` corrigido com `backup/` |
| 3 | **Correção documental e banners** | `7137489`, `bb2413b` | Auditou `docs/**` contra o código; corrigiu erros factuais (enums, rotas, webhook, contagens); adicionou banners de obsolescência em 9 docs; renomeou `akylla_gestao_diretrizes_opencode.md` → `docs/AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md` |
| 4 | **Catálogos de melhoria** | `77afedd`, `babb475` | `upgrade/MELHORIAS.md` (29 ideias) + `upgrade/MELHORIAS_DESIGN.md` (design + 7 débitos medidos) — §26 e §27 |
| 5 | **Plano do primeiro cliente** | `0d23847` | `docs/operations/CHECKLIST_PRIMEIRO_CLIENTE.md` — roteiro de 3 semanas com critério go/no-go — §28 |

### Pasta `backup/`

Contém **apenas** `README.md` — o procedimento de backup. O conteúdo
real de backup é operação e **não deve ser versionado**. O `.gitignore`
contém `/backup/*` com exceção `!/backup/README.md`.

### Pasta `upgrade/`

Catálogos de decisão (§26 e §27). Não é plano aprovado — nada de lá
entra em execução sem autorização (regra 2 do `AGENTS.md`).

---

## 26. Catálogo de melhorias — backend, segurança, operação e produto

> **PROPOSTA — nada executado.** Fonte completa:
> `upgrade/MELHORIAS.md` (428 linhas). Esta seção é o resumo; o
> catálogo traz, para cada item, o que é, o que melhora **neste
> projeto**, por onde começar e a prioridade.

### Legenda de prioridade

| | Significado |
|---|---|
| **P0** | bloqueia produção / risco de dados ou segurança |
| **P1** | necessário antes de escalar ou de confiar na operação |
| **P2** | valor claro, fazer após estabilizar |
| **P3** | exploratório / quando houver demanda |

### §1. Segurança e compliance

| # | Ideia | P | Fecha |
|---|---|---|---|
| 1.1 | **Backup automatizado com restore testado** — `pg_dump` agendado (cron/GHA/gerenciado), retenção e *drill* automatizado em ambiente isolado | **P0** | L8 |
| 1.2 | **Exclusão/anonimização LGPD** — endpoint ADMIN que mascarar PII preservando `FinancialEntry`/`Sale`, com trilha | **P0** | L4 |
| 1.3 | **Rate limit distribuído (Redis)** — interface `RateLimitStore`; hoje em memória, morre no restart e não vale entre instâncias | P1 | L2 |
| 1.4 | **RLS no Postgres** — `WHERE company_id = current_setting('app.company_id')` além do filtro da aplicação; defesa em profundidade | P1 | L3 |
| 1.5 | **Senha por token de e-mail** — token de uso único com expiração; hoje `PASSWORD_RESET_ENABLED` redefine sem token | P1 | L5 |
| 1.6 | **Cadastro anti-abuso** — limite por IP/CPF, captcha ou convite + verificação de e-mail | P1 | L6 |
| 1.7 | **2FA/MFA para ADMIN** — TOTP no mesmo serviço de sessão (já guarda hash SHA-256), sem JWT | P2 | — |
| 1.8 | **Trilha de auditoria exportável** — log append-only de ações sensíveis (quem, o quê, quando, IP) | P2 | D1 |

### §2. Operação e confiabilidade

| # | Ideia | P | Fecha |
|---|---|---|---|
| 2.1 | **Monitoramento** — Sentry/GlitchTip no `AllExceptionsFilter` + uptime em `GET /health` | P1 | L9 |
| 2.2 | **CD real** — fechar `cd.yml` (hoje `echo`), staging + produção + rollback | P1 | L7 |
| 2.3 | **Expiração de assinatura por job** — cron no worker; hoje é lazy | P2 | L10 |
| 2.4 | **E2E Mercado Pago em sandbox** — checkout → preapproval → webhook → `ACTIVE` com cartão de teste | P1 | L13 |
| 2.5 | **Fila real (BullMQ/Redis)** — substituir polling do worker por fila com retries e dead-letter | P2 | — |

### §3. Desempenho e escala

| # | Ideia | P |
|---|---|---|
| 3.1 | Cache de relatórios/dashboard, invalidado em `create` de `Sale`/`CashMovement`/`FinancialEntry` | P2 |
| 3.2 | Índices sob demanda a partir do `pg_stat_statements` (validar com dados reais) | P2 |
| 3.3 | Paginação/limites obrigatórios em **toda** rota `GET` (varredura: `/whatsapp/consents`, `/cash/sessions`, listas de importação) | P1 |

### §4. Qualidade de código e testes

| # | Ideia | P |
|---|---|---|
| 4.1 | Cobertura medida na CI (`vitest run --coverage` + diff-cover no PR) — hoje há 538 testes verdes mas **não se sabe o que não cobrem** | P1 |
| 4.2 | E2E de interface (Playwright) — hoje a validação E2E é **manual**; nenhum teste passa por componente React nem pelos rewrites do Next | P1 |
| 4.3 | Upgrade de dependências — `next`→16.4.1, `vitest`→major; branch dedicada, um pacote por commit | P1 |
| 4.4 | OpenAPI gerado (`@nestjs/swagger`) — `API.md` é escrito à mão e foi justamente a fonte dos erros corrigidos | P2 |
| 4.5 | Lint de contrato entre workspaces — checar que `API.md`, schemas e controllers batem | P2 |

### §5. Produto e UX

| # | Ideia | P | Fecha |
|---|---|---|---|
| 5.1 | Exibir limites e uso do plano em `/faturamento` — backend **já expõe** os limites | P1 | L12 |
| 5.2 | Edição dos dados da empresa (`PATCH /api/company`) — hoje não existe forma de editar | P1 | D1 |
| 5.3 | Agenda: visão de semana/mês, recorrência, múltiplos profissionais | P2 | — |
| 5.4 | CSV de caixa, clientes e WhatsApp (utilitário de exportação **já existe**) | P2 | — |
| 5.5 | Busca global com resultados agrupados por tipo | P2 | — |
| 5.6 | Impressão de cupom não fiscal (ESC/POS/PDF) e second display no PDV | P2 | — |
| 5.7 | Modo offline/reativo no PDV — alto impacto, alta complexidade | P3 | — |

### §6. Plataforma e DX

| # | Ideia | P | Fecha |
|---|---|---|---|
| 6.1 | Contrato de tipos entre frontend e API automático | P2 | — |
| 6.2 | Staging efêmero por PR (URL de preview) | P2 | — |
| 6.3 | Seed de demonstração neutro por segmento | P3 | L11 |
| 6.4 | Catálogo global de planos editável por papel de plataforma | P3 | L14 |

### Resumo por prioridade

| P | Itens |
|---|---|
| **P0** | 1.1 backup com restore testado · 1.2 LGPD |
| **P1** | 1.3 rate limit · 1.4 RLS · 1.5 senha por e-mail · 1.6 anti-abuso · 2.1 monitoramento · 2.2 CD · 2.4 E2E MP · 3.3 limites de leitura · 4.1 cobertura · 4.2 E2E UI · 4.3 upgrades · 5.1 uso do plano · 5.2 editar empresa |
| **P2** | 1.7 2FA · 1.8 auditoria · 2.3 expiração por job · 2.5 fila · 3.1 cache · 3.2 índices · 4.4 OpenAPI · 4.5 contrato · 5.3 agenda · 5.4 CSV · 5.5 busca · 5.6 impressão · 6.1 tipos · 6.2 staging |
| **P3** | 5.7 offline · 6.3 seed neutro · 6.4 catálogo global |

### Sequência sugerida

1. **Antes de qualquer produção:** 1.1 → 1.2 → 1.4 → 2.2 → 2.1.
2. **Primeiro mês:** 4.3 → 4.1 → 4.2 → 2.4.
3. **Primeiro trimestre:** 1.5 → 1.6 → 5.1 → 5.2 → 1.3.
4. **Depois:** escala e DX (3.x, 5.3–5.6, 6.x).

---

## 27. Catálogo de design — frontend

> **PROPOSTA — nada executado.** Fonte completa:
> `upgrade/MELHORIAS_DESIGN.md` (455 linhas). Base inspecionada:
> `apps/web/` (Next.js 15 + React 19 + Tailwind v4),
> `components/ui/`, `components/shell/`, `globals.css`,
> `docs/akylla/REDESIGN_PAINEL.md`.

### §0. Achados concretos no código (débitos medidos — resolver primeiro)

Não são ideias — são **correções**. Podem ser executadas assim que
autorizadas, sem design review.

| # | Achado | Arquivo | Efeito |
|---|---|---|---|
| **D-1** | `color: var(--foreground)` — **`--foreground` nunca é definida** no `@theme` | `globals.css:39` | a cor do texto cai no default do browser; qualquer tema futuro quebra em silêncio |
| **D-2** | Fonte carregada como `variable: "--font-inter"` mas o CSS usa a **string literal** `"Inter"`; a variável é setada no `<html>` e **nunca lida** | `layout.tsx:6-9` × `globals.css:34` | trocar a fonte exige editar 2 lugares |
| **D-3** | Classes e comentários de **sidebar** mortos | `globals.css:16-21, 43-50` | CSS sem uso; confunde quem manter |
| **D-4** | **32 `<table>` escritos inline**, sem componente compartilhado | `apps/web/src/app/**` | cabeçalho, zebra, alinhamento de moeda e responsividade divergem página a página |
| **D-5** | **Nenhum** `loading.tsx`, `error.tsx` ou `not-found.tsx` | `apps/web/src/app/` | navegação mostra a tela anterior congelada; 404 e 500 caem na página branca |
| **D-6** | Primitivos faltam: **sem `Table`, `Modal`/`Dialog`, `Select`, `Toast`, `Tabs`** | `components/ui/` (só Badge, Button, Card, Input, Progress, Skeleton, StatCard, EmptyState, 2 charts) | cada tela inventa a própria versão; é a origem do D-4 |
| **D-7** | **Contraste reprovado** (WCAG AA exige 4.5) | `globals.css` + **194** usos | `text-amber-500`/branco = **2.15**; `text-success-500` = **2.49**; `text-amber-600` = **3.19**. `text-amber-700` = **5.02** ✅ |

> **D-1, D-2 e D-7 são correções de 15 minutos.** D-7 é uma busca e
> substituição (`text-amber-600` → `text-amber-700`). D-5 usa
> infraestrutura que o Next.js já traz — custo quase zero.

### Contraste medido (WCAG AA)

| Par | Razão | Situação |
|---|---|---|
| `--color-sidebar-text` `#94a3b8` sobre `#0f172a` | 6.96 | ✅ |
| `text-primary-700` `#b45309` sobre branco | 5.02 | ✅ |
| `text-amber-700` sobre branco | 5.02 | ✅ |
| `text-amber-600` `#d97706` sobre branco | 3.19 | ❌ |
| `text-amber-500` `#f59e0b` sobre branco | 2.15 | ❌ |
| `text-success-500` `#14b8a6` sobre branco | 2.49 | ❌ |

**Regra de correção:** banir os stops 300/400/500/600 como **cor de
texto** — texto só nos stops 700+. Os 500/600 continuam válidos como
fundo, borda e ícone grande.

### §1. Fundamentos: tokens e CSS

| # | Ideia | P |
|---|---|---|
| 1.1 | **Design tokens semânticos** (`--color-accent`, `--color-danger`, `--text-muted`, `--border-subtle`...) usados só nos componentes — hoje os tokens são nomes de paleta | **P0** |
| 1.2 | Completar a escala (faltam `danger`, `warning`, `info`; `success` só tem 4 stops) e remover a "segunda paleta" improvisada de utilitários Tailwind | P1 |
| 1.3 | Escuro por tokens, não por classe `dark:` (hoje `dark:` nunca aparece) | P2 |
| 1.4 | Tema por segmento — paleta `primary` trocada por tenant, resolvida no servidor | P3 |

### §2. Componentes: parar de reinventar

| # | Ideia | P |
|---|---|---|
| 2.1 | **`Table` compartilhado** — colunas tipadas, alinhamento à direita para moeda, estado vazio, versão empilhada no mobile (resolve D-4) | **P0** |
| 2.2 | `Modal`/`Dialog` acessível — foco preso, `Esc`, devolve foco, `aria-modal`; a API já exige `reason ≥ 3` em estorno/cancelamento | P1 |
| 2.3 | `Select`, `Combobox`, `DateInput` — nativos estilizados, `label` ligado, `aria-invalid` | P1 |
| 2.4 | `Toast` — hoje criar cliente, liquidar título ou enfileirar WhatsApp **não gera feedback visível**; consumir o shape `{ statusCode, message, issues[] }` do Zod | P1 |
| 2.5 | `PageHeader` e `FilterBar` (39 páginas repetem o mesmo topo) | P2 |

### §3. Movimento

| # | Ideia | P |
|---|---|---|
| 3.1 | Transições 150–200 ms em hover/focus/pressed — há **11 ocorrências** de `animate|transition|@keyframes` em todo o `apps/web`; sem biblioteca de animação; respeitar `prefers-reduced-motion` | P1 |
| 3.2 | Skeletons coerentes com a geometria real (`Skeleton.tsx` já existe) | P1 |
| 3.3 | Optimistic UI **só em status** — nunca em dinheiro (regra permanente) | P2 |
| 3.4 | Gráficos com animação de entrada e transição ao trocar período | P2 |

### §4. Acessibilidade

| # | Ideia | P |
|---|---|---|
| 4.1 | Auditoria `@axe-core/playwright` na CI — há apenas ~63 ocorrências de `aria-|role=` em 39 páginas + 22 componentes | P1 |
| 4.2 | `focus-visible` consistente e ordem de tabulação coerente (quem opera o PDV de teclado) | P1 |
| 4.3 | Contraste medido — **já há reprovações** (tabela acima) | P1 |
| 4.4 | Regiões `aria-live` — anunciar "12 clientes encontrados", "caixa fechado com diferença de R$ 2,00" | P2 |

### §5. Responsividade

| # | Ideia | P |
|---|---|---|
| 5.1 | Mobile-first no fluxo do balcão — testar em 360 px; as 32 tabelas não têm versão empilhada (resolve junto com 2.1) | P1 |
| 5.2 | Áreas de toque ≥ 44 px e modo denso opcional | P2 |

### §6. Estados

| # | Ideia | P |
|---|---|---|
| 6.1 | `loading.tsx`, `error.tsx`, `not-found.tsx` (resolve D-5; `not-found` dá caminho de volta quando o 404 de outra empresa aparece) | **P0** |
| 6.2 | Estados vazios com ação (`EmptyState.tsx` já existe) — a primeira hora do usuário é tela vazia | P1 |
| 6.3 | Erros in-line no campo via `aria-describedby`, mostrando a primeira `issue` do Zod | P1 |
| 6.4 | Skeleton/fallback no fetch do `AppShell` (evita flash de menu incompleto) | P2 |

### §7. Dados e visualização

| # | Ideia | P |
|---|---|---|
| 7.1 | Ordenação e busca local (< 500 linhas) — a paginação no servidor já é ótima, mas ordenar por dia de movimentos por round-trip parece lento | P2 |
| 7.2 | `formatBRL()` único com `Intl.NumberFormat("pt-BR")` — sem isso uma hora aparece `R$ 1.500,0` | P1 |
| 7.3 | Texto alternativo dos gráficos (dashboard é a tela de decisão) | P2 |

### §8. Performance percebida

| # | Ideia | P |
|---|---|---|
| 8.1 | `useOptimistic`/`useTransition` nas navegações — evita duplo clique, crítico em `POST /api/sales` | P2 |
| 8.2 | Fechar D-2 (usar a variável do `next/font`) — a Inter já é otimizada; é só o débito | P2 |
| 8.3 | PWA para o tablet de balcão — **não** prometer offline aqui (isso é §5.6 do outro catálogo) | P3 |

### §9. Impressão

| # | Ideia | P |
|---|---|---|
| 9.1 | `@media print` para recibo e relatórios (hoje sai com topbar e cores de tela) | P2 |
| 9.2 | Página de recibo standalone (URL imprimível/reenviável por WhatsApp) | P2 |

### Sequência sugerida

1. **Uma tarde:** D-1, D-2, D-3, D-5, **D-7**, 7.2, 1.2.
2. **Uma semana:** `Table` (2.1) + rotas de estado + skeletons + empty
   states + erros in-line. Sai o "site genérico" e entra um produto.
3. **Duas semanas:** tokens semânticos (1.1) + Modal + Toast +
   microinterações + auditoria axe na CI.
4. **Depois:** dark mode, print, gráficos, tema por segmento.

### Regras de ouro do design neste produto

1. **O servidor manda.** Nenhum valor, saldo, total ou limite
   calculado no cliente (regra permanente).
2. **Dinheiro não otimiza.** UI pode ser otimista em status; em
   caixa/venda/financeiro, sempre esperar o servidor.
3. **Acessível por padrão.** Focus visível, contraste, label ligado —
   comportamento, não enfeite.
4. **Consistência > criatividade.** O usuário opera o mesmo fluxo 50
   vezes por dia; quer previsibilidade.
5. **`prefers-reduced-motion` respeitado.** Toda animação tem
   desligar.

---

## 28. Plano do primeiro cliente pagante

> **PROPOSTA — nada executado.** Fonte completa:
> `docs/operations/CHECKLIST_PRIMEIRO_CLIENTE.md`. Roteiro de 3
> semanas com itens obrigatórios, comandos concretos e **critério de
> aceite go/no-go**.

### Veredito comercial (leitura de 2026-10-14)

**Não para produção paga ainda; sim para um piloto fechado e pago.**

| Pergunta | Resposta |
|---|---|
| Dá para mostrar para um cliente? | **Sim, hoje** |
| Dá para cobrar piloto? | **Sim**, com contrato de 90 dias e backup manual |
| Dá para cobrar assinatura recorrente? | **Não** — falta deploy, backup, LGPD e E2E real do MP |
| Tempo até produção? | **~3 semanas** focadas |

### O que já vende (diferencial real)

| Diferencial | Por que vende |
|---|---|
| Multiempresa de verdade | `companyId` obrigatório + isolamento coberto por teste |
| 538 testes em PostgreSQL real | raro até em produto pago |
| Trilha de auditoria | correção é movimento compensatório com autor, data e motivo — é o que o contador pergunta |
| Importação de planilhas | ninguém troca de sistema sem conseguir levar os dados |
| WhatsApp nativo | fila, templates, consentimento LGPD |
| PDV + caixa por turno | fechamento com saldo esperado × contado |

### Semana 1 — Poder hospedar

1. **Definir hosting** (VPS+Docker, Railway, Render, Fly.io) —
   provisionar banco, domínio, TLS e secrets.
2. **Fechar o `cd.yml`** — substituir os placeholders em `cd.yml:40`
   e `cd.yml:75`; adicionar verificação pós-deploy; ativar *manual
   approval* em produção.
3. **Backup com restore testado** — criar `npm run db -- backup`
   (hoje `scripts/db.mjs` não tem esse subcomando); agendar `pg_dump`
   diário com retenção de 30 dias **fora** da máquina da app;
   **restaurar em banco efêmero e rodar `npm run validate`**.
4. **Monitoramento** — Sentry na API e no worker; UptimeRobot em
   `GET /health`.

### Semana 2 — Poder confiar

1. **Zerar `npm audit --omit=dev`** — `next`→16.4.1, `vitest`→major,
   branch dedicada, um pacote por commit.
2. **Endpoint LGPD** — `DELETE /api/clients/:id/anonymize`, `AdminGuard`,
   anonimizar PII preservando `Sale`/`CashMovement`/`FinancialEntry`,
   com trilha.
3. **D-7 do contraste** — trocar `text-amber-600` → `-700`.
4. **Termos de uso e política de privacidade** — `/termos`,
   `/privacidade`, checkbox obrigatório no `/cadastro` com versão e
   timestamp do aceite.

### Semana 3 — Poder cobrar

1. **E2E real do Mercado Pago** — cartão de teste em sandbox, fluxo
   completo até `TenantSubscription.status = ACTIVE`; repetir com
   pagamento recusado. **Aceite:** evidência de `ACTIVE` por
   pagamento real, não pelo mock.
2. **Seed neutro por segmento** — hoje é 100% "Mundo Pet".
3. **Argumento comercial de migração** — roteiro começando pela
   importação; 2 planilhas-exemplo prontas.

### Modelo comercial do piloto

| | |
|---|---|
| Formato | setup + uso por 90 dias, com desconto |
| Escopo | 1 empresa, 1 segmento, módulos núcleo + WhatsApp |
| Exigido do cliente | planilha de migração, 1 operador treinado, testador do caixa diário |
| Exigido de você | SLA mínimo, backup diário, canal de suporte |
| Ao fim | reavaliar preço e converter para assinatura |

**Cláusulas mínimas:** responsabilidade sobre dado (backup + LGPD);
nível de serviço mínimo; cobrança recorrente ativada após o piloto.

### Critério de aceite final (go/no-go)

Marcar **GO** só se **todos** forem verdadeiros:

- `https://<dominio>/health` 200 e deploy automático funcionando
- Existe dump com data **e** restore concluído registrado
- Alerta de uptime e de erro 500 recebidos pelo menos uma vez
- `npm audit --omit=dev` = 0 vulnerabilidades
- Endpoint LGPD testado de ponta a ponta
- Evidência de assinatura `ACTIVE` via pagamento real do sandbox
- Termos + privacidade publicados e aceite registrado
- `npm run validate` verde no commit de produção
- Demo ensaiado 2 vezes, começando pela importação

### Não prometer

Funcionalidades que o sistema **não** tem e que geram churn no mês 2:
offline, conciliação fiscal, emissor de NF-e. O `PDV.md` já delimita
isso.

---

## 29. Mapa de documentos do projeto

Para quem lê este arquivo e precisa ir à fonte.

### Documentação técnica (`docs/`)

| Documento | Conteúdo |
|---|---|
| `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md` | **este arquivo** — fonte única consolidada |
| `AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md` | diretrizes do agente de IA; §10 (plano 0-5) está **superado** |
| `README.md` | índice da pasta `docs/` |
| `architecture/API.md` | padrão de rotas, guards, erros e paginação |
| `architecture/DATABASE.md` | modelo de dados, convencões, índices |
| `architecture/ARCHITECTURE.md` | arquitetura de sistema |
| `development/DEVELOPMENT.md` | guia de desenvolvimento |

### Plano e operação (`docs/operations/`)

| Documento | Conteúdo |
|---|---|
| `PROJECT_STATUS.md` | **fonte única de contagens correntes** e de pendências |
| `IMPLEMENTATION_CHECKLIST.md` | etapas concluídas + seção "Fora do roteiro" |
| `CHANGELOG.md` | histórico completo de alterações (preservar) |
| `CHECKLIST_PRIMEIRO_CLIENTE.md` | roteiro comercial de 3 semanas (§28) |

### Entregáveis por etapa (`docs/akylla/`)

| Documento | Etapa |
|---|---|
| `DIAGNOSTICO_INICIAL.md` | 0 |
| `PLANO_DE_ADAPTACAO.md` | 1 |
| `AUDITORIA_MULTIEMPRESA.md` | 3 |
| `MAPA_DE_MODULOS.md` | 4 |
| `LIMITACOES_VENDAS.md` | 5 |
| `MODELO_FINANCEIRO.md` | 7 |
| `DICIONARIO_INDICADORES.md` | 8 |
| `PDV.md` | 7 |
| `PLANO_MODULARIZACAO.md` | 10 |
| `PLANO_BILLING.md` | 11 |
| `CHECKLIST_PRE_PRODUCAO.md` | 12 — **L1–L14**, a fonte das limitações |
| `REDESIGN_PAINEL.md` | design — opção B (topbar única); §2-§11 = proposta histórica |

### Catálogos de decisão (`upgrade/`)

| Documento | Conteúdo |
|---|---|
| `MELHORIAS.md` | 29 ideias de backend/segurança/operação/produto (§26) |
| `MELHORIAS_DESIGN.md` | design + 7 débitos medidos D-1..D-7 (§27) |

### Procedimentos

| Documento | Conteúdo |
|---|---|
| `backup/README.md` | procedimento de backup (a pasta não versiona dados) |
| `AGENTS.md` (raiz) | regras permanentes para agentes — regras 1–12 |

### Identificadores técnicos legados

Compatibilidade — **não** são a marca do produto (regra de
`AGENTS.md`): pacotes `@petflow/*`, cookie `petflow_session`, bancos
`petflow`/`petflow_test`, `service: "petflow-api"`, prefixo de
comprovante `PF-`. **Não renomear** sem etapa dedicada com plano de
migração.

### Regras permanentes que atravessam o documento

Extraídas de `AGENTS.md` e `architecture/API.md`:

1. `companyId` **sempre** do contexto autenticado — nunca do cliente.
2. Saldo, valores, limites e horários críticos **sempre recalculados
   no servidor**.
3. Histórico de movimentações é **imutável** — correção é movimento
   compensatório.
4. Leitura individual via `findFirst({ id, companyId })` → 404.
5. `@Inject()` explícito no construtor de providers (o `tsx` de dev não
   emite `emitDecoratorMetadata`).
6. Valores monetários: `Decimal` no Prisma, **nunca float**.
7. Só instalar dependências justificadas (regra 5); sem segredos no
   Git (regra 6); TypeScript estrito (regra 7); mudança de schema
   exige migration + `DATABASE.md` (regra 8); `npm run validate` antes
   de concluir (regra 9); atualizar os 3 arquivos de operação (regra
   10); commit só quando solicitado (regra 11); `automação do
   whatsapp/` intocável (regra 12).
