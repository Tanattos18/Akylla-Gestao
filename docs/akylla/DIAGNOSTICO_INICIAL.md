# Akylla Gestão — Diagnóstico inicial do repositório (Etapa 0)

**Data:** 12/10/2026
**Modo:** somente leitura. Nenhum arquivo do código foi alterado, nenhuma
dependência instalada, nenhuma migration executada, nenhum commit, nenhum deploy.
**Único arquivo criado:** este documento (`docs/akylla/DIAGNOSTICO_INICIAL.md`),
que é o entregável exigido pela Etapa 0 de
`PASSO_A_PASSO_OPENCODE_AKYLLA.md`.

Legenda de classificação usada abaixo:

- **[C]** confirmado no código (inspecionei o arquivo citado).
- **[D]** descrito na documentação, mas **não** confirmado nesta inspeção.
- **[T]** testado — só é marcado o que foi **executado nesta sessão**.
- **[NT]** não testado / não re-executado nesta sessão.

> Atenção à regra 7 das diretrizes: nada aqui pode ser afirmado como "testado"
> sem execução real. A documentação do PetFlow afirma 380/380 testes aprovados
> em 10/10/2026, mas **esta sessão não executou os testes** (ver §7). Portanto
> os módulos estão classificados como **documentados como testados [D/NT]**,
> não como testados.

---

## 1. Estado do repositório e do ambiente

| Item | Estado verificado |
|---|---|
| Git | Branch `main`, **um único commit** `9e08aeb` ("chore: importa base tecnica do PetFlow como fundacao do Akylla Gestao") — o histórico do PetFlow **não** foi preservado neste repositório [C] |
| Remoto | `origin` → `https://github.com/Tanattos18/Akylla-Gestao.git` [C] |
| Trabalho pendente | 1 arquivo untracked: `docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md`; working tree limpa [C] |
| `node_modules` | **ausente** em todas as workspaces; `dist/` e `.next/` ausentes [C] |
| Node/npm | Node v24.21.0, npm 11.19.0 (engines exige >=20) [C] |
| Banco | PostgreSQL 17 **em execução** em localhost:5432 [C]; existência dos bancos `petflow`/`petflow_test` **não verificada** [NT] |
| `.env` local | presente; contém `DATABASE_URL`, `BOOTSTRAP_*`, flags. **Não contém** `APP_ORIGINS` (default `http://localhost:3000`) nem `WHATSAPP_*` (default `mock`) — a API sobe com defaults [C] (valores não exibidos) |
| Pasta legada | `automação do whatsapp/` versionada no Git (28 arquivos), projeto Express/BullMQ/Redis **independente**, com próprio `prisma/schema.prisma` e `.env` local **não versionado** [C] |
| Arquivos rastreados | 236 no total |

Consequência prática: **nenhuma verificação (lint/typecheck/test/build/db:validate)
pode ser executada antes de `npm ci`** — que é uma instalação de dependências,
portanto fora do escopo desta etapa. A linha de base de verificação ficou para
a Etapa 1 (ver §8).

---

## 2. Arquitetura atual confirmada no código

Monorepo npm workspaces (`package.json:6-9`) com 5 workspaces:

| Workspace | Stack confirmada |
|---|---|
| `apps/api` | NestJS 11 + Prisma 5 + Zod (pipe por-parâmetro, sem ValidationPipe global) [C] |
| `apps/web` | Next.js 15 (App Router, tudo client-side) + Tailwind 4 [C] |
| `apps/worker` | Node puro + Prisma — fila WhatsApp em Postgres (poll + claim atômico), sem Redis [C] |
| `packages/shared` | Schemas/DTOs Zod compartilhados; constante `APP_NAME = "PetFlow"` [C] |
| `packages/whatsapp` | Abstração de provedor (`meta`/`mock`), E.164, backoff, opt-out [C] |
| `packages/config` | tsconfig base |
| `database/` | Um único `schema.prisma` + 9 migrations versionadas |
| `tests/` | 18 arquivos de integração Vitest + Supertest, 380 casos `it()` [C — contagem] |

Pontos arquiteturais relevantes [C]:

- **Acesso ao banco exclusivamente pela API.** O frontend não fala com
  Postgres/Supabase, logo **não há RLS a configurar** — o isolamento de tenant
  é 100% responsabilidade da autorização no backend (requisito 5 da diretrize
  §3 satisfeito por arquitetura, não por RLS).
- **Sessão HttpOnly**: cookie `petflow_session` (default em
  `apps/api/src/config/env.ts:8`), token `randomBytes(32)`, apenas o hash
  SHA-256 persistido em `Session` (`auth.service.ts:143-155`); bcrypt 12 rounds.
- **`companyId` vem somente da sessão.** `AuthGuard` monta
  `request.auth = { userId, companyId: session.user.companyId, role, sessionId }`
  (`common/guards/auth.guard.ts:59-64`). Grep em `apps/api/src` por
  `companyId` vindo de body/query/params: **0 ocorrências** [C]. O frontend
  jamais envia `companyId` (2 ocorrências no web são campos de resposta).
- **Autorização**: `AdminGuard` por endpoint/classe (~30 endpoints de escrita
  restrita a ADMIN); MEMBER opera o dia a dia (vendas, estoque entradas/saídas,
  clientes, agenda, leitura).
- **Prefixo** `/api` (exceto `/health`); Next faz proxy por rewrite
  `/api/:path*` → `localhost:3001` (`next.config.ts:6-13`), o que mantém o
  cookie same-origin.
- **Consistência transacional**: `$transaction` com lock `FOR UPDATE` e ordem
  fixa (caixa → produtos ordenados) em vendas; bloqueio de estoque negativo em
  duas camadas; idempotência de venda por `clientRequestId` (unique → 409);
  estornos com `updateMany` condicional.
- **CSV com escape anti-injeção de fórmula** (`common/utils/csv.ts:3-9`:
  prefixo `'` em `=+-@`, aspas, teto 5000 linhas).

---

## 3. Módulos e estado de validação

| Módulo | Onde | Código | Testes |
|---|---|---|---|
| Auth (login/logout/me, sessão, rate limit) | `apps/api/src/auth` | [C] | [D/NT] `auth.test.ts` (11) |
| Registro aberto + redefinição de senha | `auth.controller.ts` (`/register`, `/reset-password`) | [C] | [D/NT] `register.test.ts` (6), `password-reset.test.ts` (7) |
| Empresas/Usuários/perfis | `apps/api/src/users` | [C] | [D/NT] `users.test.ts` (10) |
| Categorias/Fornecedores/Produtos | `apps/api/src/{categories,suppliers,products}` | [C] | [D/NT] `catalog.test.ts` (14), `products.test.ts` (19) |
| Estoque (entradas/saídas/ajustes/saldo) | `apps/api/src/stock` | [C] | [D/NT] `stock.test.ts` (20) |
| Vendas/PDV | `apps/api/src/sales` | [C] | [D/NT] `sales.test.ts` (32) |
| Caixa e movimentos financeiros | `apps/api/src/cash` | [C] | [D/NT] `cash.test.ts` (37) |
| Clientes | `apps/api/src/clients` | [C] | [D/NT] `clients.test.ts` (20) |
| **Pets** (específico pet shop) | `apps/api/src/pets` | [C] | [D/NT] `pets.test.ts` (12) |
| **Serviços** (catálogo genérico) | `apps/api/src/services` | [C] | [D/NT] `services.test.ts` (13) |
| **Agendamentos** (genérico; `petId` opcional) | `apps/api/src/appointments` | [C] | [D/NT] `appointments.test.ts` (45) |
| **WhatsApp** (config/templates/consents/messages/webhook) | `apps/api/src/whatsapp` + `packages/whatsapp` + `apps/worker` | [C] | [D/NT] `whatsapp.test.ts` (61) |
| **Assinaturas de clientes do negócio** (`SubscriptionPlan`/`Subscription`) | `apps/api/src/subscriptions` | [C] | [D/NT] `subscriptions.test.ts` (18) |
| **Billing SaaS da plataforma** (`TenantPlan`/`TenantSubscription`) | `apps/api/src/billing` | [C] | [D/NT] `billing.test.ts` (12) |
| Dashboard/relatórios + CSV | `apps/api/src/reports` | [C] | [D/NT] `reports.test.ts` (41) |
| Health | `apps/api/src/health` | [C] | [D/NT] `health.test.ts` (2) |
| Frontend (38 rotas em `apps/web/src/app`) | todos os módulos acima com UI | [C] | [D/NT] apenas `next build` |

Total de casos: **380** [C — contagem de `it(`/`test(`]. Documentação afirma
380/380 aprovados em 10/10/2026 [D — não re-executado aqui].

### Funcionalidades descritas na documentação e confirmadas no código

Recálculo de preços no servidor, bloqueio de estoque negativo, idempotência de
venda, cancelamento com devolução de estoque, estorno auditável, fechamento de
caixa com diferença calculada, escape de CSV, webhook com HMAC `timingSafeEqual`,
exclusão de escrita do catálogo global de billing via API — todos confirmados
pela inspeção direta [C].

### Lacunas funcionais reais em relação ao MVP do Akylla (diretrizes §4.1)

1. **Contas a pagar e contas a receber (AP/AR) não existem.** O módulo financeiro
   atual é **fluxo de caixa por sessão** (`CashSession`/`CashMovement`), sem
   vencimento, sem situação (aberto/vencido/pago), sem contraparte. A diretrize
   exige "contas a pagar, contas a receber e movimentações financeiras" —
   é uma **construção nova**, não uma adaptação [C].
2. **Planos e assinaturas da Akylla sem enforcement**: `TenantPlan` não tem
   campos de limite (usuários/registros/módulos) e nenhum service consulta
   `TenantSubscription` para bloquear uso — assinatura expirada não impede
   operar [C]. Não há gateway de pagamento (grep por stripe/mercadopago/asaas: 0) [C].
3. **Configurações da empresa** (dados da empresa, preferências regionais,
   troca de nome/slug) não têm endpoint/UI — `Company` só é criada no registro
   e nunca mais editável [C].
4. **Exportação CSV** existe só para vendas, alertas de estoque e movimentos de
   estoque — não para clientes, caixa ou assinaturas [C].
5. **Relatório de clientes** inclui "pets por espécie" e o dashboard exibe
   "pet(s) cadastrado(s)" — indicadores de nicho a substituir [C].

---

## 4. Funcionalidades reaproveitáveis (recomendação)

Reaproveitar **como estão** (núcleo genérico do Akylla):

- Autenticação por sessão HttpOnly + `Session` hasheada + rate limit [C]
- Multiempresa com `companyId` exclusivamente da sessão + `AdminGuard` [C]
- Empresas/Usuários/papéis ADMIN|MEMBER [C]
- Clientes (endereço, contatos, CPF opcional, inativação preservando histórico) [C]
- Fornecedores, Categorias, Produtos (SKU/barcode únicos por empresa, Decimal
  12,2 para preços e 12,3 para quantidades) [C]
- Estoque com saldo materializado, lock `FOR UPDATE`, histórico imutável,
  alerta de estoque mínimo [C]
- Vendas/PDV com snapshots de itens, idempotência, cancelamento auditável [C]
- Caixa/sessões/movimentos/estorno — serve como caixa do comércio [C]
- Dashboard/relatórios com agregação server-side e CSV protegido [C]
- Schemas Zod compartilhados + testes de integração com Postgres real [C]
- **Serviços** (`Service`: nome, duração, preço) — catálogo **genérico**, já
  serve para qualquer negócio de serviços [C]
- **Agendamentos** (`Appointment`: `petId` é **opcional**) — reutilizável para
  salões, oficinas, clínicas etc.; depende apenas de Cliente + Serviço [C]
- **Assinaturas de clientes** (`SubscriptionPlan`/`Subscription`) — recorrência
  **do negócio cliente**, corresponde ao conceito "assinaturas de negócio da
  empresa cliente" das diretrizes §6; basta renomear rótulos [C]
- **Billing da plataforma** (`TenantPlan`/`TenantSubscription`) — esqueleto
  correto para o billing da Akylla, já separado do financeiro do cliente [C]
- Integração WhatsApp (fila em Postgres, sem Redis) — módulo opcional futuro
  útil para qualquer segmento (confirmação de pedido, lembrete) [C]

Reaproveitar **parcialmente / adaptar**:

- **Dashboard e relatórios**: remover contadores de pets e relabelar
  "serviços realizados" como genérico [C].
- **`seed-demo.ts`**: dados 100% de pet shop ("Mundo Pet", banho e tosa) —
  reescrever com dados de variedades/roupas quando aprovado [C].
- **Assinaturas/billing**: adicionar campos de limite e enforcement no backend
  (Etapa 11) [C].

---

## 5. Elementos específicos de pet shop (matriz preliminar)

| Elemento | Dependências | Recomendação |
|---|---|---|
| Modelo/UI de **Pets** (`/pets`, `PetSpecies`, espécie/raça/peso) | Client, Appointment, relatórios (pets por espécie), dashboard, seed | **Módulo opcional** — manter código, ocultar da navegação comum [C] |
| **Agendamentos** | Pet (opcional), Cliente, Serviço | **Genérico** — manter; opcionalmente tornar pet opcional já é o caso no schema [C] |
| **Serviços** | Appointment, planos | **Genérico** — manter [C] |
| **WhatsApp + lembretes de agendamento** | Appointment (origem `SERVICE_REMINDER`), template com 3 variáveis (uma delas "pet") | **Genérico com adaptação** — lembrete reutilizável; texto das variáveis/placeholder "pet" a generalizar [C] |
| **Assinaturas de clientes** | Client, CashMovement | **Genérico** — renomear rótulos para não sugerir plano de banho [C] |
| Textos de marca "PetFlow" / "gestão para pet shops" / emoji pata | layout, login, cadastro, faturamento, Receipt, CSV filenames | **Substituir na Etapa de identidade** (~18 linhas visíveis + constantes) [C] |
| Pasta legada `automação do whatsapp/` | nenhum do monorepo (projeta independente) | **Preservar intocada** (regra AGENTS.md 12) [C] |

Identificadores internos com nome PetFlow que **não** devem ser renomeados em
massa sem plano próprio: pacotes `@petflow/*` (~45 arquivos de import),
`APP_NAME`, cookie `petflow_session`, prefixo de CSV `petflow_*`,
`service: "petflow-api"` no health, `PF-XXXXXXXX` no código de comprovante,
bancos `petflow`/`petflow_test` [C].

---

## 6. Riscos técnicos e de segurança

### Bloqueantes / altos

1. **Verificações não executáveis hoje**: sem `node_modules`, lint, typecheck,
   testes, build e `db:validate` não rodam. Toda a base de qualidade é
   **documental**, não verificada nesta sessão [C/NT].
2. **Histórico Git perdido**: o repositório Akylla contém um único commit
   squashed; os hashes citados em `PROJECT_STATUS.md` (PetFlow) não existem
   aqui. Revert granular e auditoria de mudanças ficam mais difíceis [C].
3. **`TenantSubscription` sem enforcement** — risco comercial (uso sem
   assinatura válida) e risco de anunciar recurso inexistente [C].
4. **Redefinição de senha sem token de e-mail** e **cadastro aberto sem
   verificação de e-mail/captcha** — aceitáveis em dev com flags, perigosos em
   produção [C].

### Médios

5. Rate limit de login **in-memory** (`Map`) — não escala com múltiplos
   processos/instâncias [C].
6. `OriginCheckMiddleware` aplicado **somente** às rotas `auth`, não global [C].
7. `GET /api/billing/plans` é a única rota de negócio sem `@Auth()` no handler
   (protegida pelo guard global, mas depende dessa implantação) [C].
8. Sem CI — a qualidade depende de execução manual [D].
9. LGPD: dados pessoais (CPF, endereço, telefone) sem endpoints de
   exportação/exclusão do titular e sem política de retenção [C].
10. Sem backups/monitoramento/deploy definidos; custos de hospedagem não
    estimados [D].
11. `resetDatabase` nos testes e `prisma migrate deploy` no `global-setup`
    **reconstroem o banco de teste** a cada execução — ok para testes, jamais
    rodar contra banco de produção [C].

### Baixos

12. Formatação de dinheiro no comprovante impresso usa `.toFixed(2)` (ponto
    decimal) em vez de pt-BR (`print.ts:18-19,64-66`) [C].
13. Verificação do webhook usa comparação simples (não `timingSafeEqual`) no
    `verify_token` GET — aceitável para bootstrap [C].
14. Duplicidade de cliente com janela de corrida aceita (sem unique duro de
    `nameKey`) — limitação já registrada no PetFlow [D].
15. Navegação sem sidebar/header de links: o menu de facto é a grade da home
    (`app/page.tsx`) — ocultar módulo = editar esse arquivo [C].

---

## 7. Comandos executados nesta etapa (evidência real)

Executados (todos somente leitura):

| Comando | Resultado |
|---|---|
| `git status` / `git log --oneline -15` / `git ls-files` | 1 commit `9e08aeb`; 236 arquivos; 1 untracked (`docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md`) |
| Leitura de `package.json`, workspaces, `vitest.config.ts`, `tests/*`, `.gitignore`, `.env.example` | conforme §1 e §7 |
| Contagem de casos de teste (`it(`/`test(`) | **380** em 18 arquivos |
| `Test-Path node_modules` (raiz e apps) | **False** — dependências não instaladas |
| `node --version` / `npm --version` | v24.21.0 / 11.19.0 |
| `Get-Service postgresql*` + `Test-NetConnection localhost:5432` | PostgreSQL 17 **Running**, porta 5432 **aberta** |
| Grep de `companyId` no backend (entrada do cliente) | 0 ocorrências |
| Grep de gateway de pagamento | 0 ocorrências |

**Não executados** (motivo): `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build`, `npm run db:validate` — exigem `npm ci`/`npm install`
(instalação de dependências, proibida na Etapa 0). Nenhum valor de segredo foi
exibido; `.env` inspecionado apenas por nomes de variáveis.

---

## 8. Proposta de etapas e arquivos prováveis de alteração

> **Divergência a decidir (regra: parar e perguntar):** os dois documentos usam
> numerações diferentes. `akylla_gestao_diretrizes_opencode.md` §10 define
> Etapas 0–5 (macro); `PASSO_A_PASSO_OPENCODE_AKYLLA.md` define Etapas 0–12
> (operacional, mais granular). **Recomendação:** adotar o passo a passo 0–12
> como sequência de execução e mapear as diretrizes 1–5 sobre ele
> (identidade≈E1–2, multiempresa≈E3, MVP≈E4–9, experiência≈E12, planos≈E11).

| Etapa | Objetivo | Arquivos prováveis |
|---|---|---|
| **1 — Plano e linha de base** | `npm ci`; executar lint/typecheck/test/build/db:validate e registrar falhas preexistentes; criar `PLANO_DE_ADAPTACAO.md` | nenhum de código; `docs/akylla/PLANO_DE_ADAPTACAO.md` |
| **2 — Identidade Akylla** | Nome, textos, títulos, BRL/DD-MM-AAAA, ocultar pets/whatsapp da navegação comum | `apps/web/src/app/layout.tsx`, `login`, `cadastro`, `faturamento`, `page.tsx` (grade), `components/Receipt.tsx`, `lib/print.ts`, `packages/shared/src/index.ts` (`APP_NAME`), CSV filenames em `relatorios/page.tsx` + `reports.service.ts`, `health.controller.ts`, `README.md` |
| **3 — Auditoria multiempresa** | Re-executar testes de isolamento; criar Empresa A/B sintéticas; corrigir só o confirmado | `tests/*` (novos casos), `docs/akylla/AUDITORIA_MULTIEMPRESA.md` |
| **4 — Núcleo genérico** | Matriz de classificação aprovada; marcar pets/whatsapp como opcionais | `docs/akylla/MAPA_DE_MODULOS.md`; eventual flag/feature-toggles |
| **5–7 — Cadastros, produtos/estoque, vendas** | Adaptar rótulos, validar regras genéricas (SKU, homônimos, etc.) | `apps/api/src/{clients,products,stock,sales}`, `apps/web/src/app/{clientes,produtos,pdv}` |
| **8 — Financeiro básico (AP/AR)** | **Novo módulo**: contas a pagar/receber com vencimento, situação, vínculo de origem; separar do caixa | novo `apps/api/src/{accounts-payable,accounts-receivable}` (ou `finance`), schema Prisma + migration, `apps/web/src/app/financeiro` |
| **9 — Dashboard/relatórios** | Remover indicadores de nicho, dicionário de indicadores | `apps/api/src/reports/reports.service.ts`, `apps/web/src/app/{dashboard,relatorios}` |
| **10 — Módulos de pet shop** | Destino de pets/agenda/WhatsApp/assinaturas (ocultar vs opcional) — decisão do proprietário | `app/page.tsx`, rotas `/pets`, `/agenda`, `/whatsapp` |
| **11 — Planos e billing Akylla** | Campos de limite + enforcement no backend; separar billing da assinatura de negócio | `schema.prisma` (`TenantPlan`), `billing/*`, `common/guards` ou middleware de quota, `subscriptions/*` (só rótulos) |
| **12 — Qualidade/segurança/pré-produção** | Bateria completa + `CHECKLIST_PRE_PRODUCAO.md` | docs |

Não planejo: apagar código de pets/assinaturas, renomear pacotes `@petflow/*`
em massa (recomendo commit dedicado e separado, só com aprovação), tocar em
`automação do whatsapp/`, adicionar Redis/fila/pagos, inventar preços ou
limites de plano.

---

## 9. Decisões que dependem do proprietário

1. **Sequência**: adotar o passo a passo Etapas 1–12 (recomendado) ou a macro
   Etapas 0–5 das diretrizes?
2. **Linha de base (Etapa 1)**: autorizar `npm ci` e a execução de
   lint/typecheck/testes/build/`db:validate` para registrar o estado real antes
   de qualquer mudança?
3. **Módulos de pet shop**: ocultar da navegação mantendo o código (recomendado),
   transformar em módulo opcional com flag, ou manter visível na primeira versão?
4. **Assinaturas de clientes**: manter como recurso genérico "planos de clientes"
   (recomendado) ou ocultar no MVP?
5. **Renomear identificadores internos** (`@petflow/*` → `@akylla/*`,
   `petflow_session`, bancos): agora, em etapa dedicada, ou adiar indefinidamente
   (recomendado adiar para depois da Etapa 12, com plano próprio)?
6. **Contas a pagar/receber**: confirmar a construção do módulo AP/AR na
   Etapa 8 como prioridade do MVP (é o único módulo genuinamente novo).

---

## 10. Conclusão

A base do PetFlow é tecnicamente sólida e, em sua maior parte, **já é o núcleo
do Akylla Gestão**: multiempresa de verdade, autenticação por sessão,
cadastros, estoque, vendas, caixa, relatórios e um esqueleto separado de
billing SaaS. O trabalho de adaptação é majoritariamente **cosmético
(identidade/rótulos), de escopo (ocultar vertical de pet shop) e de duas
construções novas reais (financeiro AP/AR e enforcement de planos)** — não uma
reescrita.

A principal pendência desta Etapa 0 é que **nenhuma verificação automática pôde
ser executada** (dependências ausentes). Recomendo aprovar a Etapa 1 (linha de
base com `npm ci` + bateria de verificações) antes de qualquer alteração de
código.
