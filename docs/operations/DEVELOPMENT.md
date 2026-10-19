# Desenvolvimento — Akylla Gestão

## Pré-requisitos

| Ferramenta | Versão usada no ambiente | Observação |
|---|---|---|
| Node.js | 24.21.0 (mínimo 20) | `node -v` |
| npm | 11.19.0 | workspaces nativos |
| Git | 2.55 | versionamento |
| PostgreSQL | 17 local (serviço `postgresql-x64-17`, porta 5432) | necessário desde a Etapa 1; **sem Docker** neste ambiente |

> A Etapa 1 exige PostgreSQL real. Bancos usados: `petflow` (dev) e
> `petflow_test` (testes). `psql` disponível em
> `C:\Program Files\PostgreSQL\17\bin`.

## Instalação

Caminho rápido (cria `.env` a partir de `.env.example`, instala
dependências, gera o client Prisma, aplica migrations e roda o
bootstrap do admin):

```bash
npm run setup:dev
```

Manualmente:

```bash
npm install
cp .env.example .env    # ajuste as variáveis conforme necessário
```

O `.env` não é versionado. O `.env.example` contém apenas exemplos não
secretos e é a **única** fonte de exemplo (não há `.env.local.example`).
O `.gitignore` cobre `.env.*` e só excepciona `!.env.example` — assim,
um `.env.production` jamais é versionado por engano.

### Variáveis de ambiente (Etapa 1)

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | conexão com o PostgreSQL (obrigatória) |
| `API_PORT` / `WEB_PORT` | portas da API (3001) e do web (3000) |
| `APP_ORIGINS` | allowlist de CORS (ex.: `http://localhost:3000`) |
| `AUTH_RATE_LIMIT_MAX` | máximo de tentativas de login (padrão 5/15min) |
| `AUTH_SESSION_TTL_HOURS` | validade da sessão (padrão 12h) |
| `AUTH_COOKIE_SECURE` | `true` em produção (cookie `Secure`) |
| `BOOTSTRAP_COMPANY_NAME`, `BOOTSTRAP_COMPANY_SLUG` | empresa do bootstrap |
| `PASSWORD_RESET_ENABLED` | `true` habilita `POST /api/auth/reset-password` e a página `/redefinir-senha` (local/controllado; padrão desabilitado) |
| `REGISTRATION_ENABLED` | `true` habilita `POST /api/auth/register` e a página `/cadastro` — cria empresa nova + administrador (local/controllado; padrão desabilitado) |
| `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | primeiro administrador |

### Variáveis de ambiente (Etapa 6 — WhatsApp)

| Variável | Finalidade |
|---|---|
| `WHATSAPP_PROVIDER` | `meta` (Cloud API) ou `mock` (padrão em dev/teste) |
| `WHATSAPP_ACCESS_TOKEN` | token de acesso da Meta (segredo — só `.env`) |
| `WHATSAPP_VERIFY_TOKEN` | token de verificação do webhook (segredo) |
| `WHATSAPP_APP_SECRET` | segredo do app p/ validar `x-hub-signature-256` (segredo) |
| `WHATSAPP_API_VERSION` | versão da Graph API (padrão `v21.0`) |
| `WHATSAPP_COUNTRY_CODE` | prefixo E.164 para números sem código do país (padrão `55`) |
| `WORKER_POLL_INTERVAL_MS` | intervalo do poll da fila (padrão 5000) |
| `WHATSAPP_SEND_MAX_PER_CYCLE` | máx. de envios por ciclo do worker (padrão 20) |
| `WHATSAPP_SEND_INTERVAL_MS` | pausa entre envios no worker (padrão 250) |

### Banco e migrations

```bash
npm run db:migrate      # aplica migrations pendentes (usa DATABASE_URL)
npm run db:validate     # valida o schema Prisma
```

Testes criam/aplicam migrations no banco `petflow_test` automaticamente
(`tests/helpers/global-setup.ts`).

### Bootstrap do primeiro administrador

```bash
# com as variáveis BOOTSTRAP_* definidas no .env ou no ambiente:
npm run bootstrap:admin
```

- Idempotente: não duplica empresa/usuário já existentes.
- Sem senha padrão: a senha vem de `BOOTSTRAP_ADMIN_PASSWORD` e não é
  versionada. Recuperação de acesso: reexecutar o comando com as variáveis
  adequadas ou redefinir a senha via SQL direto no banco.

## Inicialização (3 terminais)

```bash
npm run dev:api      # NestJS em http://localhost:3001 (rota: /api/...)
npm run dev:web      # Next.js em http://localhost:3000 (proxy /api → 3001)
npm run dev:worker   # worker: processa a fila de envios do WhatsApp (Etapa 6)
```

## Layout de testes

```
tests/
  helpers/        infraestrutura compartilhada (app de teste, reset do banco,
                  setup do Vitest, mocks)
  integration/    casos de teste (Vitest + Supertest) — um arquivo por domínio
```

O Vitest é configurado em `config/vitest.config.ts`
(`include: tests/**/*.test.ts`, `globalSetup` e `setupFiles` em
`tests/helpers/`).

## Comandos utilitários

```bash
npm run setup:dev               # onboarding local completo (uma vez)
npm run db -- reset|studio|seed|status   # utilitário de banco (scripts/db.mjs)
npm run validate                # lint → typecheck → test → build → db:validate
```

## Comandos de verificação

```bash
npm run lint         # ESLint em todo o monorepo (config/eslint.config.mjs)
npm run typecheck    # TypeScript em todos os workspaces
npm test             # Vitest (testes em tests/integration/)
npm run build        # build de todos os workspaces
npm run db:validate  # valida o schema Prisma (requer DATABASE_URL no .env ou no ambiente)
npm run db:seed:demo -- --company=<slug|id|email-do-admin>  # popula empresa VAZIA com dados de demonstração
```

Atenção: **`npm run build` e `npm run dev:web` não devem rodar ao mesmo
tempo** — ambos escrevem em `apps/web/.next` e o cache fica corrompido
(erro `Cannot find module './NNNN.js'`). Se acontecer: pare o `dev:web`,
apague `apps/web/.next` e reinicie o `dev:web`.

## Health check

```bash
curl http://localhost:3001/health
# {"status":"ok","service":"petflow-api","timestamp":"...","uptimeSeconds":...}
```

Observação: o health fica fora do prefixo `/api` por decisão registrada na
Etapa 1; os demais endpoints ficam em `/api/...`.

## Produtos e estoque (Etapa 2)

- Endpoints, filtros e permissões: `docs/architecture/API.md`.
- Testes de estoque (incluindo concorrência) rodam no `petflow_test` via
  `npm test`; a migration é aplicada automaticamente no setup dos testes.
- Saldo é sempre calculado no servidor (transação + lock); não existe
  endpoint para "setar" saldo diretamente.

## Vendas e PDV (Etapa 3)

- Endpoints, payloads e permissões: `docs/architecture/API.md`.
- `/pdv` busca produtos via `GET /api/products?search=&status=ACTIVE`;
  o carrinho é estado local — valores exibidos são calculados para UX, mas
  o servidor recalcula tudo na finalização.
- `clientRequestId` (UUID por intenção de venda) é reutilizado em caso de
  falha de rede e regenerado após o sucesso — assim o retry não duplica a
  venda e o clique duplo recebe 409.
- Testes de vendas (transações, concorrência, cancelamento) rodam no
  `petflow_test` via `npm test`; a migration é aplicada no setup.

## Caixa e financeiro (Etapa 4)

- Endpoints, payloads e permissões: `docs/architecture/API.md`.
- Vendas, cancelamentos e movimentações manuais exigem sessão de caixa
  aberta (409) — no frontend o `/pdv` verifica
  `GET /api/cash/sessions/current` (404 = caixa fechado) e exibe banner
  com link para `/caixa`.
- Saldo esperado/diferença e resumo financeiro são calculados no
  servidor; `inCash` separa dinheiro físico (saldo do caixa) das demais
  formas de pagamento (resumo financeiro).
- Testes do caixa (`tests/integration/cash.test.ts`) rodam no `petflow_test` via
  `npm test`; a migration é aplicada no setup. `tests/integration/sales.test.ts`
  abre uma sessão de caixa no `beforeAll`.

## Clientes e serviços (Etapa 5)

> **2026-10-19:** o módulo Pets foi retirado do produto (migration
> `20261019180000_remove_pets_module`). Referências a pets abaixo são
> histórico; a tabela `Pet` ficou só como legado no banco.

- Endpoints, payloads e permissões: `docs/architecture/API.md`.
- Escrita de clientes é liberada a qualquer usuário autenticado;
  escrita de serviços exige papel `ADMIN` (catálogo/preços).
- Anti-duplicidade de cliente é checada na aplicação (409 com nome +
  contato iguais a um ativo) — nome de serviço é único no banco
  (`(companyId, nameKey)`).
- `/pdv` envia `clientId` opcional no payload da venda; sem seleção,
  vende rápido (comportamento da Etapa 3 preservado).
- Testes novos em `tests/integration/clients.test.ts`,
  `tests/integration/services.test.ts` (+ casos em `tests/integration/sales.test.ts`) rodam no
  `petflow_test` via `npm test`; a migration é aplicada no setup.

## WhatsApp (Etapa 6)

- Endpoints, payloads e permissões: `docs/architecture/API.md`.
- Provedor padrão em dev/teste é `mock` (`WHATSAPP_PROVIDER=mock`);
  para falar com a Meta real, preencha no `.env` local
  `WHATSAPP_PROVIDER=meta` + `WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` (e configure a
  empresa em `/whatsapp`). **Nunca** commite esses valores.
- Webhook Meta (`GET/POST /api/webhooks/whatsapp`): em dev local exige
  túnel público (ngrok/etc.) apontando para a API; a assinatura
  `x-hub-signature-256` é validada sobre o corpo bruto (`rawBody`).
- Worker: `npm run dev:worker` processa a fila (poll
  `WORKER_POLL_INTERVAL_MS`, até `WHATSAPP_SEND_MAX_PER_CYCLE`
  envios/ciclo com `WHATSAPP_SEND_INTERVAL_MS` entre eles). Sem
  worker rodando, mensagens ficam `PENDING` (comportamento esperado).
- Testes novos em `tests/integration/whatsapp.test.ts` (provedor mock
  determinístico) rodam no `petflow_test` via `npm test`; a migration
  é aplicada no setup.

## Dashboard e relatórios (Etapa 7)

- Endpoints, parâmetros e semântica: `docs/architecture/API.md`.
- Período sempre em **UTC**: `from`/`to` em `YYYY-MM-DD`, janela
  inclusiva dia a dia, padrão de 30 dias, máximo de 366; o fuso e as
  regras são constantes em `@petflow/shared`
  (`REPORT_TIMEZONE`, `REPORT_*_RANGE_DAYS`).
- Relatórios exigem apenas sessão (MEMBER pode ler); nenhum cálculo
  é feito no navegador; `companyId` enviado pelo cliente é ignorado.
- CSV: `format=csv` em vendas, alertas e movimentações de estoque
  (teto 5000 linhas, ignora paginação, células iniciadas por
  `=`, `+`, `-`, `@` neutralizadas com apóstrofo). Os demais
  relatórios retornam JSON.
- Páginas novas: `/dashboard` e `/relatorios` (abas de vendas,
  estoque, caixa, clientes e WhatsApp). Barras dos gráficos são CSS
  puro — o projeto não usa biblioteca de charts.
- Migração da etapa: `20261010002727_etapa7_report_indexes` (apenas
  índices `(companyId, createdAt)` em `Client`/`Pet`).
- Testes novos em `tests/integration/reports.test.ts` rodam no `petflow_test`
  via `npm test`; a migration é aplicada no setup.

## Agendamentos (Etapa 8)

- Endpoints, conflito e lembretes: `docs/architecture/API.md`.
- Escopo aprovado na conversa (sem prompt oficial): agenda diária,
  conflito de horário da **empresa inteira**, lembretes pela fila
  WhatsApp existente; serviços em vendas/PDV ficaram de fora.
- Sem `AdminGuard`: membros criam/editam agendamentos; configuração
  de lembrete (template/antecedência) continua em `/whatsapp` como
  ADMIN.
- Horário sempre no servidor: envie `startLocal`
  (`YYYY-MM-DDTHH:mm`) + `utcOffsetMinutes`
  (`-getTimezoneOffset()`); `startAt`/`endAt` são recalculados e o
  passado é recusado (tolerância 60 s).
- Conflito → **409** quando outra janela `SCHEDULED`/`CONFIRMED`
  sobrepõe; fim-início exato é livre; cancelado/concluído/no-show
  não bloqueia.
- Lembretes: configure em `/whatsapp` um template **aprovado com
  exatamente 3 variáveis** + antecedência (5..40320 min) e
  consentimento `OPTED_IN` do cliente; a fila é a mesma da Etapa 6
  (`WhatsAppMessage` com `origin=SERVICE_REMINDER`, chave
  `appointment-reminder:<id>`) — o worker não mudou.
- Páginas novas: `/agenda`, `/agenda/novo`, `/agenda/[id]`,
  `/agenda/[id]/editar`; home ganhou card "Agendamentos";
  dashboard/relatórios exibem contagens por status
  (`summary.services`, `clients.services`).
- Migração da etapa: `20261010115308_etapa8_appointments` (enum +
  `Appointment` + campos de lembrete em `WhatsAppConfig`).
- Testes novos em `tests/integration/appointments.test.ts` (45) rodam no
  `petflow_test` via `npm test`; a migration é aplicada no setup.

## Assinaturas e billing (Etapa 9)

- Endpoints, regras de caixa e guards: `docs/architecture/API.md`.
- Escopo aprovado na conversa (sem prompt oficial): assinaturas de
  clientes **e** billing da empresa no SaaS ("Ambos"), pagamento
  sempre pela caixa existente (sem gateway).
- Escrita de planos/assinaturas de cliente é `AdminGuard`; leitura é
  sessão; billing (`PUT`/`renew`/`cancel`) também é ADMIN.
- Renovação/criação com `registerPayment` **exigem caixa aberto**
  (409) — mesmo comportamento de vendas da Etapa 4; o preço sempre
  vem do plano, nunca do cliente.
- Cancelamento: motivo 3..500 obrigatório (assinatura de cliente);
  duplo cancelamento/renovação de assinatura cancelada → 409.
- Catálogo global do billing (`TenantPlan`) vem seedado pela
  migration (essencial/profissional/completo); a escrita desse
  catálogo não tem endpoint nesta etapa (pendência: papel de
  plataforma).
- Páginas novas: `/planos`, `/assinaturas`, `/assinaturas/nova`,
  `/assinaturas/[id]`, `/faturamento`; home ganhou cards
  "Assinaturas" e "Faturamento".
- Migração da etapa: `20261010131027_etapa9_subscriptions` (enums +
  `SubscriptionPlan`/`Subscription`/`TenantPlan`/`TenantSubscription`
  + `CashMovement.subscriptionId` + seed de planos globais).
- Testes novos: `tests/integration/subscriptions.test.ts` (18) e
  `tests/integration/billing.test.ts` (12) rodam no `petflow_test` via `npm test`;
  a migration é aplicada no setup.

## Estrutura rápida

Ver `docs/architecture/ARCHITECTURE.md` e o `README.md` na raiz.

## Padrões

- TypeScript estrito em todos os projetos.
- Erros tratados de forma explícita (filtro global de exceções na API).
- Logs estruturados do NestJS (`Logger`).
- Nunca commitar `.env` ou credenciais reais.
