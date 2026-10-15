# Changelog — Akylla Gestão

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

> **Escopo:** este changelog cobre a era do **Akylla Gestão** (adaptação e
> roteiro das Etapas 0–12, a partir de 2026-10-12). O histórico anterior à
> adaptação não é mantido aqui — está preservado no histórico do Git.

## [Akylla Gestão] - 2026-10-15 - Débitos de design D-1, D-2, D-3, D-5 e D-7

Sexta entrega única autorizada. Primeira execução de código desde a
Etapa 12. **Só frontend** — nenhum arquivo de backend, teste ou
migration alterado.

Executa o lote "uma tarde" do `upgrade/MELHORIAS_DESIGN.md` §0 e §Sequência,
que o próprio catálogo classifica como *correção de débito, não
melhoria: podem ser executados assim que autorizados, sem design
review*.

### Adicionado

- **`apps/web/src/app/not-found.tsx`** — página 404 própria com caminho
  de volta. Fecha o caso que o catálogo aponta: recurso de outra
  empresa **deve** responder 404 (regra permanente) e antes caía na
  página branca do Next.
- **`apps/web/src/app/error.tsx`** — boundary de erro global. Mensagem
  genérica em produção; `error.message` só em dev; `error.digest`
  sempre exibido; botão `reset`. Não vaza stack em produção.
- **`apps/web/src/app/loading.tsx`** — esqueleto de carregamento
  reaproveitando `Skeleton.tsx` já existente, com `role="status"` e
  `aria-label`.

### Alterado

- **`globals.css` — D-1:** `color: var(--foreground)` referenciava uma
  variável **que nunca foi definida**; a cor do texto caía no default
  do browser. Criado o token `--color-foreground: #0f172a` no `@theme`
  (slate-900; ~17:1 sobre o `--color-background`).
- **`globals.css` — D-2:** `--font-sans` usava a string literal
  `"Inter"` enquanto o `next/font` injetava a variável `--font-inter`
  no `<html>` **sem que ninguém a lesse**. Agora
  `var(--font-inter), ui-sans-serif, system-ui, ...` — a fonte
  otimizada pelo Next passa a ser a usada de fato.
- **`globals.css` — D-3:** removido o bloco `.sidebar-scroll`, morto
  desde que a sidebar foi substituída pela topbar (opção B).
  **Preservados** os tokens `--color-sidebar*` (§0, linhas 16-21) —
  são usados pela topbar escura e pelo drawer mobile. O catálogo os
  listava junto, mas inspeção confirmou uso ativo.
- **D-7 — contraste (WCAG AA):** regra "texto só nos stops 700+"
  aplicada em **7 ocorrências** de texto informativo:
  - `dashboard/page.tsx` ×2 (`text-primary-600`, `text-amber-600`)
  - `assinaturas/nova/page.tsx` ×2 (`text-amber-600`)
  - `relatorios/page.tsx` (`text-amber-600`)
  - `whatsapp/mensagens/[id]/page.tsx` (`text-amber-500` → era rótulo
    `<dt>`)
  - `shell/Header.tsx` ×2 (ícones `AlertTriangle`/`CalendarClock`
    a 16px sobre fundo claro: 2.15:1 reprovava até no mínimo 3:1 de
    WCAG 1.4.11)

### Preservado (não eram violações)

| Local | Valor | Motivo |
|---|---|---|
| `Header.tsx:712` | `text-primary-400` | avatar sobre a topbar **escura** (`bg-primary-500/20` sobre `#0f172a`) — âmbar claro sobre fundo escuro é o correto |
| `StatCard.tsx:8,10` | `text-amber-600`, `text-primary-600` | **cor de ícone** (`iconBackgrounds`), não texto — 3.19:1, acima do mínimo 3:1 de WCAG 1.4.11 para componentes não-texto |

### Não alterado nesta entrega

- **D-4** (32 `<table>` inline) e **D-6** (faltam `Table`, `Modal`,
  `Select`, `Toast`, `Tabs`) — dependem do componente `Table`
  (`MELHORIAS_DESIGN.md` §2.1), lote "uma semana".
- Limites de *loading* por rota: 31/39 páginas são client-side com
  `useEffect`, então o `loading.tsx` de raiz cobre o segmento raiz;
  skeletons por tela é §3.2 do catálogo.

### Verificação

- `npm run validate` **verde**: lint · typecheck · **538/538** ·
  build · `db:validate`.
- Rota `/_not-found` agora renderiza o componente próprio.
- **Nenhum teste de backend alterado** — a suíte permanece em 538.

---

## [Akylla Gestão] - 2026-10-14 - Documentação técnica consolidada (29 seções)

Quinta entrega única autorizada. `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md`
passa de 841 para **1503 linhas** e de 23 para **29 seções**, virando
a **fonte única consolidada do projeto** — pronta para leitura por
outra IA.

### Alterado

- **Cabeçalho e §1**: estado atualizado (538/538 · 26 controllers ·
  28 models · 32 enums · 39 páginas · 13 migrations · CI ativa ·
  2 vulnerabilidades em produção). Novo **§1.1 Resumo executivo** para
  quem lê pela primeira vez.
- **§2 Stack**: árvore do monorepo atualizada (`config/`, `scripts/`,
  `tests/`, `backup/`, `upgrade/`, `.github/`); todos os comandos
  (`validate`, `db --`, `db:deploy`); tabela de **CI/CD** com o
  placeholder do `cd.yml` apontado por linha.
- **§17 Testes**: explícito o que os 538 testes **não** cobrem
  (componentes React, rewrites do Next, navegador) e que a validação
  E2E de interface é manual.
- **§21 Pendências**: reorganizada em "bloqueiam produção" (L1, L4,
  L7, L8, L9, L13) / "degradam a operação" (L2, L3, L5, L6, L10, L12,
  L14) / "menores", cada uma com ponteiro para a solução.

### Adicionado

- **§24 Módulo importação de planilhas CSV** — rotas, 5 tipos,
  fluxo completo de `upload` (detecção de delimitador, normalização
  de cabeçalho, formato BR de decimal, deduplicação por empresa,
  limite de plano só com assinatura `ACTIVE`, dry run, transação
  única), relatório, segurança e tela.
- **§25 Entregas fora do roteiro** — as 5 entregas de outubro com
  commits, pastas `backup/` e `upgrade/`.
- **§26 Catálogo de melhorias** (backend/segurança/operação/produto)
  — 29 ideias P0–P3 em tabelas com "que lacuna fecha".
- **§27 Catálogo de design** — 7 débitos medidos (D-1..D-7) com
  **tabela de contraste WCAG** e os valores reais (2.15 / 2.49 / 3.19
  reprovados, 5.02 aprovado), + 8 categorias de melhoria, regras de
  ouro e sequência.
- **§28 Plano do primeiro cliente** — veredito comercial, semanas
  1–3, modelo de piloto e **critério go/no-go de 9 verificações**.
- **§29 Mapa de documentos** — índice das fontes (ops, akylla,
  upgrade, backup) e as regras permanentes do `AGENTS.md`.
- **Índice de navegação** no topo separando o que é **Fato** (§1–§25)
  do que é **Proposta** (§26–§28).

### Preservado

- Numeração das seções §1–§23 **inalterada** — são referenciadas por
  `CHANGELOG.md`, `IMPLEMENTATION_CHECKLIST.md`,
  `MELHORIAS.md`, `REDESIGN_PAINEL.md` e `DIRETRIZES_OPENCODE.md`.
  As novas entraram como §24–§29.

### Alterado (referências)

- `docs/README.md` e `README.md`: contagem 23 → 29 seções.

### Verificação

- 34 arquivos `.md`, 64 links relativos — **0 quebrados**.
- UTF-8 limpo (0 U+FFFD; único match de `Ã` é o `NÃO` legítimo).

---

## [Akylla Gestão] - 2026-10-14 - Plano executável: primeiro cliente pagante

Quarta entrega única autorizada. Transforma as ideias dos catálogos
`upgrade/` em **plano de execução testável**. Nenhum item do plano foi
executado — apenas o documento foi criado.

### Adicionado

- **`docs/operations/CHECKLIST_PRIMEIRO_CLIENTE.md`** — roteiro de 3
  semanas até o primeiro cliente **pago em produção**:
  - **Semana 1 (poder hospedar):** definir hosting, fechar o
    `cd.yml` (placeholders em `cd.yml:40` e `:75`), backup com
    **restore testado**, monitoramento e alerta.
  - **Semana 2 (poder confiar):** zerar `npm audit --omit=dev`
    (`next`→16.4.1, `vitest`), endpoint LGPD de anonimização
    (`apps/api/src/lgpd/`, hoje inexistente), D-7 do contraste,
    termos de uso e política de privacidade com aceite registrado.
  - **Semana 3 (poder cobrar):** E2E real do Mercado Pago em sandbox
    (assinatura `ACTIVE` por **pagamento real**, não pelo mock), seed
    neutro (fecha L11) e roteiro comercial de migração ensaiado.
- Cada item traz **comando ou arquivo concreto** e **critério de
  aceite testável**; o documento fecha com **critério go/no-go de 9
  verificações**, modelo comercial de piloto (setup + 90 dias, sem
  recorrente no cliente 1) e tabela de riscos aceitos.

### Alterado

- **`docs/README.md`**: checklist indexado em "Estado atual do
  produto".
- **`docs/operations/PROJECT_STATUS.md`**: bloco de Próximos passos
  aponta o plano como plano de execução proposto, aguardando
  autorização.
- **`docs/operations/IMPLEMENTATION_CHECKLIST.md`**: seção "Fora do
  roteiro — Plano: primeiro cliente pagante" com os itens `[ ]`
  pendentes.

### Verificação

- Links relativos verificados (0 quebrados).
- Nenhum arquivo de código alterado; nenhum item do plano executado.

### Estado

**Aguardando autorização** para iniciar a Semana 1 (regra 2 do
`AGENTS.md`).

---

## [Akylla Gestão] - 2026-10-14 - Catálogo de melhorias e pasta de backup

Terceira entrega única autorizada pelo proprietário (fora do roteiro
0–12). Cria a base de decisão para evolução do produto — **nenhum
código de aplicação alterado**, nenhuma ideia executada.

### Adicionado

- **`upgrade/MELHORIAS.md`** — catálogo com **29 ideias** de melhoria
  em 6 categorias (segurança e compliance, operação e resiliência,
  desempenho e escala, qualidade e testes, produto e UX, plataforma e
  DX). Cada item traz função, o que melhora **neste projeto** (com
  arquivo ou limitação L1–L14 real), ponto de partida e prioridade
  P0–P3, mais tabela-resumo e sequência sugerida.
- **`upgrade/MELHORIAS_DESIGN.md`** — catálogo de **design de
  interface** (tokens/CSS, componentes, movimento/JS, a11y,
  responsividade, estados, dados e visualização, performance
  percebida, impressão), no mesmo formato. Inclui regras de ouro
  (servidor manda; dinheiro não otimiza UI; acessível por padrão;
  `prefers-reduced-motion`).
- **`backup/README.md`** — estrutura e regras de uso da pasta de
  cópias de segurança locais (dump/restore, drill obrigatório, nada
  sensível no Git).

### Achados medidos no frontend (catálogo de design, §0)

Inspeção de `apps/web/` produziu 7 débitos concretos, **D-1 a D-7**:

| | Achado |
|---|---|
| D-1 | `color: var(--foreground)` em `globals.css:39` — variável nunca definida |
| D-2 | fonte: `--font-inter` injetada no `<html>` mas não lida; CSS usa a string `"Inter"` |
| D-3 | CSS e comentários de sidebar mortos (topbar opção B removeu a sidebar) |
| D-4 | 32 `<table>` escritos inline nas páginas |
| D-5 | nenhum `loading.tsx`/`error.tsx`/`not-found.tsx` no App Router |
| D-6 | `components/ui/` sem `Table`, `Modal`, `Select`, `Toast`, `Tabs` |
| D-7 | **contraste reprovado**: `text-amber-500`/branco = 2.15, `text-success-500`/branco = 2.49, `text-amber-600`/branco = 3.19 (AA = 4.5), em 194 usos de `text-primary`/`text-amber` |

### Alterado

- **`.gitignore`**: `/backup/*` ignorado com exceção de
  `!/backup/README.md` (mesmo padrão do `.env.example`). Testado:
  dump `.sql` simulado fica ignorado, o README não.
- **`docs/README.md`**: seção "Fora de `docs/` — pastas da raiz"
  indexando as duas pastas novas; `MELHORIAS.md` ganhou linha de
  escopo apontando o catálogo de design.

### Verificação

- 33 arquivos `.md`, 60 links relativos — **0 quebrados**.
- UTF-8 validado byte a byte nos arquivos novos (0 U+FFFD, 0 mojibake).
- Nenhum arquivo sensível versionado.

### Preservado

- Nenhum arquivo existente sobrescrito; `automação do whatsapp/`
  intocado; `AGENTS.md` intocado.

---

## [Akylla Gestão] - 2026-10-14 - Documentação: correção de erros factuais e banners

Segunda entrega única autorizada pelo proprietário (fora do roteiro
0–12). Auditoria da documentação encontrou erros factuais; este registro
os corrige nos documentos de **estado atual** e sinaliza os entregáveis
**datados**. Nenhum código de aplicação foi alterado.

### Alterado — fatos corrigidos

- **`docs/architecture/API.md`**: nova seção **Financial** (rotas reais
  de `financial.controller.ts`, incl. `AdminGuard` em `reverse`/`cancel`);
  webhook WhatsApp `/api/whatsapp/webhook` → **`/api/webhooks/whatsapp`**;
  templates: `PATCH /:id/approval` removido (não existe) e `status`
  corrigido para `ACTIVE`/`INACTIVE`; consents: `POST /consents`
  removido (não existe); adicionado `GET /templates/:id`.
- **`docs/architecture/DATABASE.md`**: roles `ADMIN`/`STAFF` →
  **`ADMIN`/`MEMBER`** (enum real `UserRole`); heading
  "Migrations e seeds" → "Migrations e dados iniciais".
- **`docs/architecture/ARCHITECTURE.md`**: worker descrito como stub →
  implementado (Etapa 6, fila WhatsApp); `database/` sem pasta de seeds.
- **`docs/operations/PROJECT_STATUS.md`**: evidências 509/509 →
  **538/538**; "CI e deploy" → só deploy/CD pendente.
- **`docs/operations/DEVELOPMENT.md`**: path do webhook corrigido.
- **`docs/akylla/CHECKLIST_PRE_PRODUCAO.md`**: `login-rate.limit.ts` →
  `login-rate-limit.ts`; linha "nenhum endpoint de upload" corrigida
  (existe `FileInterceptor` ≤ 5 MB em `imports`); defaults de
  `PASSWORD_RESET_ENABLED`/`REGISTRATION_ENABLED` agora refletem o
  `.env.example`; alvo do upgrade de vitest corrigido.
- **`README.md`**: "12 de 12 etapas" → **Etapas 0–12 (13 etapas)**;
  evidências 490 → 538; mapa de páginas com `/importacoes`.
- **Achado novo:** `npm audit --omit=dev` reporta **2 vulnerabilidades
  em produção** (`postcss` transitivo do `next`, alta) — a doc dizia
  "todas em dev-dependências". Corrigido em `CHECKLIST_PRE_PRODUCAO.md`
  (L1) e `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md` (§21).
- **`docs/AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md`**: contagens
  (538/538 em 24 arquivos, 13 migrations, 39 páginas), migration
  `import_batch` na tabela, financeiro com estados `OPEN`/`PAID`/
  `CANCELLED` e rotas reais, upload documentado, webhook corrigido,
  papéis `ADMIN`/`MEMBER`, typecheck nos workspaces `apps/*`.

### Alterado — redução de duplicação

- **Fonte única das contagens correntes** = `PROJECT_STATUS.md`;
  `AKYLLA_COMPLETA` §17 e `CHECKLIST_PRE_PRODUCAO` §9 agora apontam
  para ela em vez de competir com o número.
- **`docs/README.md`**: AUDITORIA_MULTIEMPRESA não aparece mais em duas
  seções; entregáveis datados (Etapas 8–12 + redesign + importação)
  completam a tabela; seções separadas em "Produto (sempre atual)" e
  "Entregáveis de etapa".

### Alterado — banners de obsolescência

Banner curto no topo de: `PLANO_IMPORTACAO.md` (status
"AGUARDANDO APROVAÇÃO" → implementado), `PLANO_DE_ADAPTACAO.md`,
`MAPA_DE_MODULOS.md`, `MODELO_FINANCEIRO.md`, `PDV.md`,
`PLANO_BILLING.md` (enforcement implementado), `AUDITORIA_MULTIEMPRESA.md`,
`PLANO_MODULARIZACAO.md`, `REDESIGN_PAINEL.md`.

### Alterado — nomenclatura

- **Rename:** `docs/akylla_gestao_diretrizes_opencode.md` →
  **`docs/AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md`** (padrão do repositório);
  7 referências atualizadas (`DIAGNOSTICO_INICIAL`, `PLANO_DE_ADAPTACAO`,
  `PRD` ×2, `PASSO_A_PASSO` ×2, `docs/README.md`). Banner no topo
  indicando que o §10 (plano 0–5) foi superado pelo roteiro 0–12.

### Verificação

- 51 links relativos verificados em 30 arquivos `.md` — **0 quebrados**.
- `npm run validate` completo: lint OK · typecheck OK · 538/538 ·
  build OK · db:validate OK.

### Preservado

- Histórico do CHANGELOG; `automação do whatsapp/`; conteúdo dos
  entregáveis datados (apenas banner e correções pontuais, sem reescrita).

---

## [Akylla Gestão] - 2026-10-14 - Reorganização estrutural do repositório

Tarefa autorizada pelo proprietário como entrega única (fora do roteiro
0–12). Fecha a migração de layout iniciada anteriormente e deixa a raiz,
o código e a documentação consistentes.

### Adicionado

- **`config/`** — `eslint.config.mjs` e `vitest.config.ts` movidos da
  raiz; o ESLint ganha bloco de globals para os scripts ESM de
  `scripts/`. Scripts da raiz apontam via `--config`.
- **`scripts/`** — `setup-dev.mjs` (`npm run setup:dev`: cria `.env`,
  `npm ci`, `db:generate`, `db:migrate`, `bootstrap:admin`),
  `db.mjs` (`npm run db -- reset|studio|seed|status`) e `validate.mjs`
  (`npm run validate`: lint → typecheck → test → build → db:validate).
- **`.github/`** — `workflows/ci.yml` (lint, typecheck, test com service
  container PostgreSQL 17, build, `db:validate` em push/PR),
  `workflows/cd.yml` (placeholder de staging/production) e
  `dependabot.yml` (npm + github-actions, semanal).
- **`tests/helpers/` + `tests/integration/`** — layout de testes
  organizado por papel; `helpers/global-setup.ts` e
  `helpers/setup-env.ts` passam a ser o `globalSetup`/`setupFiles` do
  Vitest; `helpers/mercadopago-mock.ts` recebe o
  `MockMercadoPagoProvider`.

### Alterado

- **Imports dos testes**: os 24 arquivos de `tests/integration/` ainda
  apontavam para o layout antigo (`./helpers/app`, `../apps/...`) —
  corrigidos para `../helpers/app` e `../../apps/...` (53 imports).
- **`apps/api/package.json`**: `@petflow/whatsapp` declarado em
  `dependencies` (era usado em 6 arquivos sem declaração) e `@types/node`
  em devDependencies.
- **API — organização**: `login-rate.limit.ts` → `login-rate-limit.ts`;
  `clientNameKey` extraído de `clients.service.ts` para
  `common/utils/client-name-key.ts` (remove import cruzado
  `whatsapp-templates → clients`); `tenant-limits.{module,service}.ts`
  saem de `billing/` para o módulo próprio `src/tenant-limits/`;
  imports de `crypto` padronizados em `node:crypto`.
- **`MockMercadoPagoProvider`** sai de
  `apps/api/src/billing/mercadopago-provider.ts` para
  `tests/helpers/mercadopago-mock.ts` (código de teste não é mais
  compilado no build de produção).
- **`.gitignore`**: cobre `.env.*` (exceto `!.env.example`), `.idea/` e
  `.vscode/` — antes, um `.env.production` seria versionado.
- **Documentação**: caminhos de teste atualizados em 14 documentos para
  `tests/integration/` e `tests/helpers/`; `database/README.md` com as
  13 migrations (última `import_batch`) e sem a pasta `seeds/`
  inexistente; `PLANO_IMPORTACAO.md` indexado em `docs/README.md`;
  CI descrita no `README.md`, `DEVELOPMENT.md`,
  `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md` e na limitação L7 do
  `CHECKLIST_PRE_PRODUCAO.md`; `PROJECT_STATUS.md` com a nova entrega.

### Removido

- **`.env.local.example`** — redundante com `.env.example` (mesmas 29
  chaves); `setup-dev.mjs` usa apenas `.env.example`.
- **`eslint.config.mjs`, `vitest.config.ts` e os 26 arquivos de teste
  da raiz** (para `config/` e `tests/`).
- **Pastas vazias** `tests/e2e`, `tests/fixtures`, `tests/unit`.

### Corrigido

- **`cd.yml`** — `needs: [ci]` referenciava um job inexistente no mesmo
  workflow (o CI é outro arquivo); removido. O gate de deploy passa a
  ser o approval do Environment.

---

## [Akylla Gestão] - 2026-10-14 - Importação de planilhas (CSV)

Nova capacidade autorizada fora do roteiro 0–12, conforme
`docs/akylla/PLANO_IMPORTACAO.md` (decisões D1–D8 aprovadas).

### Adicionado

- **Modelo `ImportBatch`** + enums `ImportType` (CATEGORY, SUPPLIER,
  PRODUCT, CLIENT, SERVICE) e `ImportStatus` (COMPLETED, FAILED);
  migration aditiva `20261014114855_import_batch`.
- **Módulo da API** `apps/api/src/imports`:
  `GET /api/imports/template` (modelo CSV), `POST /api/imports`
  (upload multipart, `type` + `dryRun`) e `GET /api/imports`
  (histórico paginado) — todos `AdminGuard`, sem rota pública.
- **Regras de importação** em `imports.service.ts`: transação por lote
  (falha → rollback + `FAILED` fora da transação), skip de duplicidade
  por tipo (SKU/código de barras em produtos — nome não bloqueia),
  categoria/fornecedor referenciados por nome na planilha de produtos
  (inexistente → erro na linha, sem auto-criação — D7), estoque inicial
  gera `StockMovement IN`, delimitador `,`/`;` detectado, BOM UTF-8 e
  preços em formato BR, limites de 5 MB / 5000 linhas / 100
  `errorDetails`.
- **Checagem única de limites de plano (D8):** assinatura `ACTIVE` com
  `clientLimit`/`productLimit` excedidos → 403 "Limite do plano …";
  sem assinatura não há limite (regra preservada).
- **Schemas** `importTypeSchema`, `importUploadFormSchema`,
  `importReportSchema`, `importBatchSchema`, `listImportsQuerySchema`
  e templates em `@petflow/shared`.
- **UI `/importacoes`** (`apps/web/src/app/importacoes/page.tsx`):
  download do modelo, upload com dry-run, resultado com tabela de
  erros e histórico paginado; item "Importações" na navegação apenas
  para ADMIN (`Header.tsx`).
- **Testes** `tests/integration/imports.test.ts` (29 cenários: autorização, validação
  de arquivo, as 5 entidades, idempotência, dry-run, limites de plano,
  BOM/`;`, tenancy A×B, histórico); `resetDatabase` agora apaga
  `ImportBatch` antes de `user`.
- **413** para arquivo > 5 MB (`LIMIT_FILE_SIZE` tratado em
  `AllExceptionsFilter`).

### Dependências

- `csv-parse` e `multer` (workspace `@petflow/api`) + `@types/multer`
  (raiz) — justificativa: parse CSV robusto (delimiter/BOM/aspas) e
  upload multipart suportado nativamente pelo Nest.

## [Akylla Gestão] - 2026-10-13 - Reorganização da documentação

### Removido

- Pasta histórica de prompts de escopo do projeto anterior (8 arquivos)
  e o PRD do projeto anterior.
- Todas as menções à marca antiga nos documentos; `CHANGELOG.md` e
  `IMPLEMENTATION_CHECKLIST.md` reescritos cobrindo apenas a era Akylla
  (Etapas 0–12).

### Adicionado

- `docs/requirements/PRD.md` novo: PRD do **Akylla Gestão**, derivado das
  diretrizes do produto e do mapa de módulos aprovados.

### Alterado

- Marca padronizada como **Akylla Gestão** em `README.md`, `AGENTS.md`,
  `docs/README.md`, `PROJECT_STATUS.md`, docs de arquitetura e
  entregáveis de etapa.
- `package.json` (raiz): `name` e `description` atualizados para o
  produto atual.

### Nota

- Identificadores técnicos legados permanecem **no código** por decisão
  registrada e são documentados como compatibilidade técnica: cookie
  `petflow_session`, pacotes `@petflow/*`, bancos `petflow`/`petflow_test`,
  `service: "petflow-api"` e prefixo de comprovante `PF-`.
- Pasta `automação do whatsapp/` **não foi alterada** (base histórica
  preservada conforme `AGENTS.md`).

## [Akylla Gestão] - 2026-10-12 - Organização dos READMEs

### Alterado

- `database/README.md`: reescrito para Akylla (layout atual, 12
  migrations, bootstrap/seed via CLI da API, link para DATABASE.md);
  removidas referências legadas à marca anterior e ao texto "Etapa 0 sem
  tabelas".
- `README.md` (raiz): seção Documentação explicita papéis — raiz =
  vitrine do produto, `docs/README.md` = índice técnico; enxugada a
  tabela (lista completa no índice).
- `docs/README.md`: título e convenções deixam claro o papel de cada
  README.

### Removido

- `database/seeds/README.md` e pasta `database/seeds/` vazia (seeds
  reais são CLI: `bootstrap:admin` / `db:seed:demo`).
- `database/prisma/migrations/README.md` (boilerplate desatualizado;
  migrations documentadas em `database/README.md` e `DATABASE.md`).

### Nota

- `automação do whatsapp/README.md` preservado (base histórica).

## [Akylla Gestão] - 2026-10-12 - Organização da documentação

### Adicionado

- `docs/README.md`: índice único da documentação, organizado por
  finalidade (estado atual, produto, arquitetura, operação, histórico
  das etapas, requisitos) com ordem de leitura sugerida.

### Alterado

- `README.md`: status corrigido para 12/12 etapas; tabela de
  documentação atualizada (PDV, checklist pré-produção, doc técnica
  completa); link para o índice.
- `docs/akylla/REDESIGN_PAINEL.md`: estado atual (topbar B) no topo;
  proposta de sidebar marcada como histórica; §12 documenta a
  evolução fase 1 → fase 2 (opção B).
- `docs/AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md` §16: seção de layout
  global (topbar B) antes do mapa de páginas.

## [Akylla Gestão] - 2026-10-12 - Layout B: topbar única (sem sidebar)

### Alterado

- **Layout global trocado para o paradigma B** (topbar escura única,
  sem sidebar), decisão do proprietário entre as opções apresentadas.
- `Header.tsx` reescrito como **TopNav**: barra escura (slate-900) com
  logo, links diretos (Início, Dashboard), **menus dropdown agrupados**
  (Operação, Estoque, Relacionamento, Gestão, Administração), busca
  global (produtos/clientes/pets/serviços/vendas), sino de
  notificações e menu de perfil — tudo no mesmo chrome superior.
- **Menu mobile**: painel acordeão sob a topbar (mesmos grupos e
  filtros de módulo/permissão).
- Breadcrumb em barra fina sob a topbar (desktop).
- `AppShell`: conteúdo full-width com `max-w-[1440px]` centralizado;
  removido padding lateral da sidebar e estado de colapso.
- Removido `Sidebar.tsx` (substituído pelo topbar; nenhum
  funcionalidade perdida).

### Validações

- lint 0 · typecheck OK · 509/509 testes · build OK.

## [Akylla Gestão] - 2026-10-12 - Continuação da reformulação do painel

### Alterado

- **Busca global** do header agora inclui **pets** e **serviços** além
  de produtos, clientes e vendas (receiptCode).
- **Notificações** recarregadas ao abrir o sino (além do load inicial do
  shell) — contagem sempre atual no clique.
- `/produtos` e `/clientes` leem `?search=` da URL na carga inicial —
  "Ver todos os resultados" da busca global pré-preenche o filtro da
  página de listagem.

### Validações

- lint 0 · typecheck OK · 509/509 testes · build OK.

## [Akylla Gestão] - 2026-10-12 - Reformulação profissional do painel

### Alterado

- **Sidebar** reorganizada em 6 grupos (somente páginas reais): Visão
  geral (Início, Dashboard) · Operação (PDV, Vendas, Caixa, Financeiro,
  Serviços, Agenda) · Estoque e compras (Produtos, Categorias,
  Fornecedores) · Relacionamento (Clientes, Pets, WhatsApp,
  Assinaturas) · Gestão (Relatórios) · Administração (Usuários,
  Faturamento, Planos). Removida entrada duplicada "Estoque" →
  `/produtos`. Destaque de página ativa (`aria-current`).
- **Sidebar recolhível** no desktop (260 px ↔ 72 px, só ícones) com
  persistência em `localStorage` (`akylla:sidebar-collapsed`); drawer
  mobile com overlay e botão fechar.
- **Header** com busca global (debounce 300 ms → produtos, clientes,
  vendas por receiptCode com navegação aos detalhes), sino de
  notificações (estoque sem saldo / abaixo do mínimo + contas a
  receber/pagar vencidas, com links), menu de perfil (nome, papel,
  sair) e botão hambúrguer no mobile. Data no canto (xl+).
- **Dashboard** com KPIs de gestão: Vendas, Recebido, Pago, A receber
  (destaca vencidas), A pagar, Saldo do caixa; faixa compacta
  (pedidos, canceladas, ticket médio, clientes novos, vencidas,
  resultado); alertas de estoque baixo e contas vencidas; próximos
  agendamentos (14 dias, SCHEDULED/CONFIRMED); atividades recentes
  (últimas vendas); atalhos (PDV, produto, agenda, clientes, caixa,
  relatórios); saúde do caixa com recebido/pago; WhatsApp. Período,
  combo chart e donut mantidos.
- `AppShell` gerencia colapso/drawer e padding dinâmico do conteúdo;
  main com padding responsivo (`px-4` → `xl:px-8`).

### Notas

- Remote real: `Tanattos18/Akylla-Gestao.git` (remoto anterior
  descontinuado).
- Nenhuma API, regra de negócio, migration ou permissão alterada.
- Validações: lint 0 · typecheck OK · 509/509 testes · build OK.

## [Akylla Gestão] - 2026-10-12 - Documentação — Módulo PDV

### Adicionado

- `docs/akylla/PDV.md`: **documento funcional do Ponto de Venda** —
  fluxo da tela `/pdv`, API (`POST/GET /api/sales`,
  `POST /api/sales/:id/cancel`), regras de negócio (preço no servidor,
  idempotência por `clientRequestId`, lock de caixa → produtos,
  snapshot de itens), modelo de dados (`Sale`/`SaleItem`), comprovante e
  impressão de cupom, integração com caixa/estoque/financeiro,
  permissões (cancelar = ADMIN), garantias de testes e limitações
  conhecidas (L1–L9, sem NFC-e/adquirente/conciliação).

## [Akylla Gestão] - 2026-10-12 - Redesign do painel de gestão (implementado)

### Adicionado

- Sidebar escura (slate-900) + Header com breadcrumb + AppShell
  (`components/shell/`) — rotas de auth sem shell.
- Design tokens `@theme` Tailwind v4: primária amber, sidebar, sucesso
  teal, fonte Inter via `next/font/google`.
- Componentes UI (`components/ui/`): Card, Button, Input/Textarea/
  Select, Badge, StatCard, EmptyState, Skeleton, **ComboChart** (barras
  + linha SVG), **DonutChart** (distribuição %), **Progress**.
- Dashboard redesenhado inspirado no `DimersonJr/dashboard-supermercado`
  (Power BI): 6 KPIs (Vendas, Pedidos, Ticket médio, Clientes novos, A
  receber, A pagar), combo chart (vendas/dia + ticket médio/dia), donut
  de formas de pagamento, saúde do caixa (entradas vs saídas), widgets
  (Catálogo, Estoque, Agenda, WhatsApp).
- `formatBrlCompact` para eixos de gráfico; alias `@/*` no tsconfig web.

### Alterado

- Migração `teal-*` → `primary-*` em 56 arquivos (~232 ocorrências).
- `docs/akylla/REDESIGN_PAINEL.md` marcado como IMPLEMENTADO (R1–R6).

## [Akylla Gestão] - 2026-10-12 - Documentação — Redesign do painel (proposta)

### Adicionado

- `docs/akylla/REDESIGN_PAINEL.md`: **proposta visual do painel de
  gestão** — layout com sidebar fixa escura + header com breadcrumb/data/
  avatar + dashboard redesenhado (KPIs, gráfico de atividade, widgets,
  atividade recente). Diagnóstico do estado atual (sem sidebar, sem
  design system, teal inline em ~40 arquivos), design tokens
  (`@theme` Tailwind v4 com cor primária amber), componentes a criar
  (`components/ui/`), plano de implementação em 5 fases e 6 decisões de
  aprovação (R1–R6) aguardando proprietário. **Nenhum código alterado.**

## [Akylla Gestão] - 2026-10-12 - Etapa 12 — Qualidade, segurança e preparação para produção

### Adicionado

- `docs/akylla/CHECKLIST_PRE_PRODUCAO.md`: **entregável da etapa** —
  evidências de qualidade (lint 0 · typecheck OK · **509/509 testes** ·
  build OK · db:validate OK), revisão de segurança (segredos, logs,
  auth, autorização, tenant, uploads, exportações, webhooks), limitações
  conhecidas classificadas (L1–L14, preexistentes), ambientes
  (dev/teste/produção), variáveis de ambiente sem segredos, estimativa
  de custos de hospedagem (R$ 55–250/mês conforme opção), checklist de
  itens obrigatórios antes da comercialização e **decisão recomendada:
  não declarar pronto para produção** (faltam backups com restore
  testado, LGPD, CI, monitoramento, E2E Mercado Pago e resolução de
  vulnerabilidades de dev-dependencies).

### Notas

- Nenhuma regressão introduzida pela adaptação (509 testes verdes).
- 8 vulnerabilidades `npm audit` preexistentes — todas em
  dependências de desenvolvimento (vitest/esbuild/postcss/tinypool);
  correção exige upgrade do vitest (breaking change, janela dedicada).
- Roteiro Akylla Gestão (Etapas 0–12) **concluído**. Deploy proibido
  sem aprovação explícita do proprietário.

## [Akylla Gestão] - 2026-10-12 - Etapa 11 — Planos e assinatura SaaS

### Adicionado

- `docs/akylla/PLANO_BILLING.md`: **entregável da etapa** — separação
  billing-SaaS × assinaturas de negócio, estado atual dos modelos,
  lacunas, avaliação de gateway, proposta de limites e plano de
  implementação. Decisões D1–D4 registradas pelo proprietário.
- **Decisão D1 — planos do seed mantidos** (Essencial R$ 79,90/3 usuários ·
  Profissional R$ 149,90/10 usuários · Completo R$ 249,90/ilimitado;
  30 dias). Não publicados fora do sistema.
- **Decisão D2 — todos os limites** (`userLimit`/`clientLimit`/
  `productLimit` em `TenantPlan`, `NULL` = ilimitado): Essencial
  3/200/100; Profissional 10/1000/500; Completo ilimitado. Migration
  `database/prisma/migrations/20261012173450_tenant_plan_limits` aplica
  colunas + UPDATE dos planos seed.
- **Decisão D3 — enforcement só com assinatura ACTIVE** (status quo):
  `TenantLimitsService` (`apps/api/src/billing/tenant-limits.service.ts`)
  verifica limites no `create` de Users/Clients/Products apenas quando a
  empresa tem `TenantSubscription` com status `ACTIVE`; sem assinatura,
  expirada ou cancelada — nenhum bloqueio. 403 com nome do plano e
  limite atingido. Módulo `TenantLimitsModule` injetado em
  UsersModule/ClientsModule/ProductsModule.
- **Decisão D4 — gateway Mercado Pago (sandbox)**: SDK oficial
  `mercadopago` (npm workspace `@petflow/api`); provider
  `mercadopago-provider.ts` (mock/Failing/Sdk) com override para testes;
  `MercadoPagoService` (`POST /api/billing/checkout` cria preapproval e
  vincula `gateway`/`gatewaySubscriptionId` na assinatura, status
  `EXPIRED` até webhook confirmar pagamento); webhook
  `POST /api/webhooks/mercadopago` (`@Public` + assinatura HMAC
  `x-signature` verificada com `MERCADOPAGO_WEBHOOK_SECRET`, idempotente
  por `gatewaySubscriptionId`); `GET /api/billing/gateway` descreve
  ambiente e presença de credenciais. Sem `MERCADOPAGO_ACCESS_TOKEN`, o
  checkout retorna 400 com mensagem explícita (nunca cobra por engano).
- Env vars (`MERCADOPAGO_ENV`/`_ACCESS_TOKEN`/`_PUBLIC_KEY`/
  `_WEBHOOK_SECRET`) em `env.ts` e `.env.example` (sem segredos reais).
- Schema compartilhado `createCheckoutSchema` (`planId`, `payerEmail`).
- `TenantPlan.userLimit/clientLimit/productLimit` e
  `TenantSubscription.gateway/gatewaySubscriptionId @unique` no Prisma
  schema e no `planSelect`/`subscriptionSelect` do billing service.
- Testes: `tests/integration/tenant-limits.test.ts` (7 — sem assinatura, ativa no
  Essencial bloqueia 4º usuário, cliente limite ajustado, Completo sem
  trava, EXPIRED/CANCELLED sem trava, isolamento cross-tenant) e
  `tests/integration/mercadopago.test.ts` (12 — checkout admin/member/anon, plano
  inexistente, sem credenciais, webhook assinado ativa, idempotência,
  cancelamento, gateway desconhecido, tipo diferente, describe).
  Suíte completa: **509 testes, 23 arquivos, 0 falhas**.

### Alterado

- `UsersService.create`/`ClientsService.create`/`ProductsService.create`
  chamam `limits.assertCanCreate` antes do insert.
- `BillingController` ganha `POST /checkout` e `GET /gateway`
  (ambos `AdminGuard`); `BillingModule` registra `MercadoPagoService` e
  `MercadoPagoWebhookController`; importa `PrismaModule`.
- `docs/architecture/DATABASE.md` e `docs/architecture/API.md`
  atualizados (novas colunas, rotas e comportamentos).

### Notas

- Cobrança recorrente real **não ativada**: sandbox por padrão; ativação
  exige testes E2E em sandbox com cartão de teste do Mercado Pago +
  aprovação do proprietário (instrução 7 da Etapa 11).
- Escrita do catálogo global de planos continua pendente (exige papel de
  plataforma — fora do escopo desta etapa).
- UI `/faturamento` ainda não exibe limites/uso — pendência registrada.

## [Akylla Gestão] - 2026-10-12 - Etapa 10 — Módulos de pet shop (modularização)

### Adicionado

- `docs/akylla/PLANO_MODULARIZACAO.md`: **entregável da etapa** — plano
  de modularização com impacto e reversão, baseado em mapeamento de
  dependências com evidência `file:line` (rotas, tabelas, FKs Restrict,
  testes, relatórios). Recomendação por módulo: **pets** = opcional de
  nicho, fora da navegação inicial (sem exclusão); **agenda, serviços,
  WhatsApp e assinaturas de clientes** = reutilizar de forma genérica;
  **seed "Mundo Pet"** = reescrever com dados de comércio variado após
  aprovação (etapa futura).
- **Ativação por segmento — decisão D3 = opção B, implementada**
  (autorização do proprietário em 2026-10-12): migration aditiva
  `database/prisma/migrations/20261012154010_company_module` (enums
  `BusinessModule`/`CompanyModuleStatus` + tabela `CompanyModule`,
  `@@unique([companyId, module])`); **`ModuleGuard`** (APP_GUARD após
  `AuthGuard`) retorna 403 para rotas de módulos `DISABLED`
  (`@RequireModule` em pets, services, appointments, whatsapp
  config/templates/consents/messages, subscriptions e
  subscription-plans; webhook permanece `@Public`); API
  `GET /api/company-modules` (sessão) e `PATCH /api/company-modules`
  (`AdminGuard`, upsert); home oculta cards de módulos desativados
  (`plannedModules` com `module` + fetch em `/api/company-modules`).
  Ausência de linha = módulo ativo (nenhuma empresa existente muda de
  comportamento); núcleo nunca é desativável. `DATABASE.md` e `API.md`
  atualizados.
- `tests/integration/company-modules.test.ts` (**+13 testes**): listagem padrão
  (5 módulos ACTIVE), AdminGuard (400 inválido, 403 para MEMBER),
  upsert idempotente, bloqueio 403 das rotas do módulo desativado,
  isolamento cross-tenant, núcleo nunca bloqueado, webhook público
  assinado não recebe 403 de módulo e agenda acessível com WhatsApp
  desativado; `resetDatabase` apaga `companyModule`.

### Alterado

- **Rótulo do lembrete generalizado** (MAPA item 21, escopo da Etapa 10):
  mensagem de erro da API (`whatsapp-config.service.ts:88`) e ajuda da UI
  (`whatsapp/page.tsx:373`) agora descrevem `{{1}}` como **cliente** em
  vez de "tutor/pet". O comportamento de `{{1}}`
  (`pet?.name || client.name`) e a exigência de 3 variáveis
  (`APPOINTMENT_REMINDER_VARIABLE_COUNT`) não mudaram — só o texto.
  Grep `tutor` em `apps/`, `packages/` e `tests/` = 0.
- `docs/akylla/MAPA_DE_MODULOS.md`: §6.2, §6.3 e §7 atualizados —
  **D2 CONFIRMADA** (nenhuma exclusão) e **D3 DECIDIDA: opção B**
  (implementada na etapa).

### Decisões do proprietário (2026-10-12)

- **D2 — confirmada**: recomendações por módulo do plano (nenhuma
  exclusão; seed reescrito só em etapa futura com nova aprovação).
- **D3 — opção B escolhida** (tabela `CompanyModule` + guard no
  backend), implementada nesta etapa com migration aditiva autorizada.

## [Akylla Gestão] - 2026-10-12 - Etapa 9 — Dashboard e relatórios

### Adicionado

- `docs/akylla/DICIONARIO_INDICADORES.md`: **entregável da etapa** —
  dicionário completo dos indicadores (definição exata, fórmula, fonte
  no banco, período, estado vazio e consulta SQL de rastreabilidade),
  cobrindo os 4 exigidos pelo roteiro (**faturamento** =
  `reports/summary.sales.net`; **receita recebida** =
  `financial/summary.paidInTotal`; **contas vencidas** =
  `overdueReceivables/Payables`; **saldo de caixa** =
  `openSession.expectedBalance` e `cash/summary.net`), a separação
  conceitual entre eles e a separação billing-SaaS × financeiro do
  cliente, mais as regras de CSV/paginação/gráficos.
- `tests/integration/reports.test.ts` (**+3 testes**): **empresa vazia** (summary,
  vendas, clientes, `financial/summary` e `cash/summary` zerados sem
  inventar números, `ticketAverage: null`); **CSV com caracteres
  especiais** (acentos, vírgulas, aspas duplas escapadas, quebra de
  linha, fórmulas `=`/`@` e fórmula **após espaço inicial** neutralizadas
  com apóstrofo); **coerência indicadores × dados-fonte** (vendas,
  clientes, estoque, WhatsApp, títulos AP/AR e entradas de caixa
  conferidos contra o banco via Prisma).

### Alterado

- **Indicadores de nicho removidos (genéricos)**: `clients.newPets` sai
  do `summary` do dashboard; `newPets` e `petsBySpecies` saem de
  `GET /api/reports/clients` — substituídos pelos já existentes
  `newClients` (clientes novos), vendas e estoque (PLANO §9). UI: card
  "Novos clientes" do `/dashboard` e aba Clientes do `/relatorios`
  perderam "Novos pets"/"Novos pets por espécie"; DTOs
  (`DashboardSummaryDto.clients`, `ClientsReportDto`) atualizados.
  Modelos `Pet`/`PetSpecies` intactos (destino na Etapa 10).
- `apps/api/src/common/utils/csv.ts`: proteção de injeção agora também
  neutraliza sinal de fórmula **após espaço inicial** (`" =1+1"`),
  mantendo a cobertura original de `= + - @ TAB CR`.
- `docs/architecture/API.md`: prefixo de arquivo CSV corrigido para
  `akylla_*`, descrição da neutralização atualizada, seção de
  relatórios sem menção a pets e link para o dicionário.

### Verificado

- `lint` 0 → `typecheck` OK → **477/477 testes** (20 arquivos; +3
  novos, 5 assertions atualizados para o fim do nicho) → `build` OK →
  `db:validate` OK (nenhuma migration na etapa).

## [Akylla Gestão] - 2026-10-12 - Etapa 8 — Financeiro básico (AP/AR)

### Adicionado

- `docs/akylla/MODELO_FINANCEIRO.md`: detalhamento prévio aprovado —
  inspeção do modelo atual, 6 conceitos separados (títulos → liquidação
  → caixa → fluxo previsto/realizado → billing), modelo `FinancialEntry`,
  transições de status só no servidor (`OVERDUE` derivado), escopo
  aditivo da migration e plano de reversão; decisões D1 (modelo único
  com `direction`), D2 (venda vira caixa, sem título liquidado), D3
  (origem `ACCOUNT`) e D4 (aprovação da migration) registradas.
- **Schema** (`database/prisma/schema.prisma`): enums
  `FinancialDirection`/`FinancialStatus`/`FinancialOrigin`;
  `CashMovementOrigin` ganha `ACCOUNT`; modelo `FinancialEntry`
  (`Decimal(12,2)`, contrapartes `SetNull`, `@@unique([companyId,
  origin, originId])`, `@@unique([companyId, clientRequestId])`,
  4 índices por empresa, `createdByUserId` `Restrict`); relações
  inversas em `Company`/`Category`/`Supplier`/`Client`/`CashMovement`/
  `User`.
- **Migration** `20261012164040_financial_entry` (aditiva: 3
  `CREATE TYPE`, `ALTER TYPE ... ADD VALUE 'ACCOUNT'`, `CREATE TABLE`,
  índices e FKs; coluna `clientRequestId` + unique index incluídos na
  migration); aplicada em `petflow` (dev) e `npm run db:validate` OK.
- **Schemas Zod** em `@petflow/shared`: `financialDirectionSchema`,
  `financialStatusSchema`, labels, `createFinancialEntrySchema`
  (description 2..200, `positivePriceFieldSchema`, `dateField`,
  contrapartes opcionais, `clientRequestId` 8..64),
  `updateFinancialEntrySchema` (parcial, sem `direction`/
  `clientRequestId`), `financialReasonSchema` (motivo 3..500),
  `listFinancialQuerySchema` (direção/status/search/período +
  paginação), `financialSummaryQuerySchema`; `cashMovementOriginSchema`
  e `cashMovementOriginLabels` ganham `ACCOUNT`.
- **Módulo API** `apps/api/src/financial` (`FinancialModule`, com
  `@Inject()` explícito): `POST /api/financial` (201; valida
  contrapartes da empresa → 400; `P2002` → 409), `GET /api/financial`
  (direção/status/período/search + paginação), `GET /financial/summary`
  (abertos, vencidos, liquidados e cancelados — calculado no
  servidor), `GET/PATCH /:id` (só `OPEN` → 409), `POST /:id/pay`
  (transação `OPEN → PAID` + `lockOpenCashSession` → 409 se fechado +
  movimento `ACCOUNT` `IN`/`OUT`), `POST /:id/reverse` e `POST
  /:id/cancel` (`AdminGuard`, motivo obrigatório → 400, duplo → 409);
  cross-tenant → 404.
- **UI** `/financeiro` com abas **Resumo | A pagar | A receber**:
  resumo ganha cards de títulos abertos/vencidos/liquidados no período;
  novo componente `apps/web/src/components/FinancialEntries.tsx`
  (criar/editar/liquidar, cancelar/estornar para admin, filtros por
  status, paginação, badge "Vencido"); DTOs financeiros em
  `apps/web/src/lib/types.ts`.
- `tests/integration/financial.test.ts` (**+30 testes**): criação e validações
  (valor/3 casas, zero, negativo, data fora de formato, contraparte
  inválida, idempotência `clientRequestId` → 409), liquidação e saldos
  (`/cash/summary` coerente, movimento `ACCOUNT`, membro pode liquidar,
  dupla liquidação → 409, caixa fechado → 409), cancelamento/estorno
  auditáveis (motivo registrado no banco, 400 sem motivo, 403 membro,
  409 em estado inválido, movimento `REVERSAL` compensatório), filtros
  por período/status, isolamento A×B (leitura/escrita/resumo → 404/0) e
  arredondamento/decimais (12,2, `toFixed(2)`).

### Corrigido

- `apps/api/src/financial/financial.service.ts`: no `summary`,
  `dueRange`/`paidRange` colidiam na chave do filtro (o `to`
  sobrescrevia o `from`), ignorando o limite inferior do período.
- `tests/helpers/app.ts`: `resetDatabase` agora apaga `FinancialEntry`
  antes de `user` (FK `Restrict` em `createdByUserId`) — sem isso
  nenhum teste iniciava após a nova tabela.

### Verificado

- `lint` 0 → `typecheck` OK → **474/474 testes** (20 arquivos; +30
  novos) → `build` OK → `db:validate` OK.

## [Akylla Gestão] - 2026-10-12 - Etapa 8 — detalhamento (aprovado)

### Adicionado (detalhamento; sem alteração de código)

- `docs/akylla/MODELO_FINANCEIRO.md`: detalhamento prévio exigido pelo
  roteiro — inspeção do modelo atual, 6 conceitos separados (títulos →
  liquidação → caixa → fluxo previsto/realizado → billing), modelo
  Prisma `FinancialEntry` (Decimal 12,2, contrapartes SetNull, unique
  `(companyId, origin, originId)`), transições de status só no servidor
  (`OVERDUE` derivado, não armazenado), relação com o caixa
  (`CashMovement` da venda = registro de recebimento), 6 testes
  planejados, escopo **aditivo** da migration e plano de reversão.
- **Decisões D1–D4** submetidas e aprovadas pelo proprietário:
  modelo único `direction`, venda só no caixa, origem `ACCOUNT`,
  aprovação da migration aditiva.

## [Akylla Gestão] - 2026-10-12 - Etapa 7 — Vendas e recebimentos

### Adicionado

- `docs/akylla/LIMITACOES_VENDAS.md`: **entregável** da etapa — fluxo
  validado item a item do roteiro com evidências `[Código]/[Teste]`,
  cobertura dos 7 testes exigidos e **lista explícita de 9 limitações**
  (sem fiscal/adquirente/conciliação, cancelamento total apenas, uma
  forma de pagamento por venda, venda exige caixa aberto, origem MANUAL
  em pagamentos de assinatura, estoque sem chave de idempotência, sem
  lote/validade, sem PDV offline, recibo comercial `PF-`).

### Verificado (sem alteração de código)

- Itens 1–9 do roteiro confirmados no código (recálculo no servidor,
  transação única venda+itens+estoque+caixa, snapshots, idempotência
  `clientRequestId`, cancelamento auditável com devolução única,
  nenhuma menção a fiscal/adquirente na UI).
- **Decisão de caixa: mantida abertura/fechamento por turno** (regra
  original; não alterada silenciosamente conforme roteiro).

### Verificado

- `lint` 0 · `typecheck` OK · **444/444 testes** (sem variação — etapa
  de conferência/entregável documental).

## [Akylla Gestão] - 2026-10-12 - Etapa 6 — Produtos, categorias e estoque

### Corrigido

- `apps/api/src/products/products.service.ts`: filtro `lowStock` da
  listagem agora exige `minimumStock > 0` (antes, produto com mínimo 0 e
  saldo 0 era listado como "estoque baixo", divergindo do endpoint
  `/stock/low-stock` e do flag `lowStock` por item).

### Adicionado

- `tests/integration/stock.test.ts` (+2): **requisição repetida** de movimento gera
  movimentos independentes, mantém saldo coerente e nunca deixa saldo
  negativo (terceira tentativa → 400); filtro `lowStock` exclui produtos
  **sem estoque mínimo configurado** (regressão da correção acima).

### Verificado (sem alteração de código)

- Unicidade de SKU/código de barras **por empresa** (`@@unique([companyId,
  sku])`/`[companyId, barcode]`) + testes de conflito;
- categoria/fornecedor de outra empresa rejeitados (400) + testes;
- recálculo de saldo no servidor dentro de transação com `FOR UPDATE`
  (saídas concorrentes aprovadas=1/rejeitadas=4);
- histórico auditável (autor, motivo, referência, data);
- bloqueio de saldo negativo (saída e ajuste);
- precisão decimal: preços 2 casas, quantidades 3 casas (`decimalField(3)`,
  aceita fracionárias);
- alerta de estoque mínimo: endpoint `low-stock`, flag por item e UI
  (banner + filtro + badges) com dados reais;
- rótulos de produtos/categorias/fornecedores sem textos de nicho;
- limitação registrada: movimentos de estoque **não têm chave de
  idempotência** (coluna nova exigiria migration — decisão futura).

### Verificado

- `lint` 0 · `typecheck` OK · **444/444 testes** (+2).

## [Akylla Gestão] - 2026-10-12 - Etapa 5 — Cadastros, clientes e fornecedores

### Alterado

- `apps/api/src/suppliers/suppliers.service.ts`: busca de fornecedores
  ampliada de apenas nome para **nome, email, telefone e documento**
  (paridade com clientes; roteiro, instrução 7 — filtros).

### Adicionado

- `tests/integration/clients.test.ts` (+2): criação de cliente somente com nome
  (CPF/telefone/email não obrigatórios) e **inativação preserva histórico
  de vendas** (venda com cliente → inativar → ficha com `_count.sales` e
  venda consultável).
- `tests/integration/catalog.test.ts` (+4): fornecedor somente com nome, busca por
  email/telefone/documento, paginação e **inativação preserva produtos
  vinculados**.

### Verificado (sem alteração de código)

- Formulários de clientes/fornecedores/categorias **genéricos**: apenas
  nome obrigatório; CPF validado quando preenchido (11 dígitos), nunca
  obrigatório; sem textos de nicho (`grep cachorro|gato|raça|tutor|banho|
  tosa` vazio).
- Duplicidade: bloqueia apenas nome+contato iguais entre ativos;
  homônimos e contatos compartilhados permitidos; inativos não bloqueiam.
- Inativação por status (sem DELETE): FKs `Restrict`/`SetNull` preservam
  vendas, produtos e histórico.
- Isolamento por tenant confirmado (tenancy-audit + CRUD próprio).
- Elementos de navegação de pets na tela de clientes diferidos para a
  **Etapa 10** (conforme MAPA_DE_MODULOS §6.2 — decisão do proprietário).

### Verificado

- `lint` 0 · `typecheck` OK · **442/442 testes** (+6).
- Commits por etapa (aprovado pelo proprietário): Etapa 4 e Etapa 5
  separados; push para `main`.

## [Akylla Gestão] - 2026-10-12 - Etapa 4 — Definição do núcleo genérico

### Adicionado

- `docs/akylla/MAPA_DE_MODULOS.md`: matriz de classificação dos 23 itens
  do inventário nas 4 categorias do roteiro (núcleo comum · opcional
  futuro genérico · específico de pet shop · obsoleto/duplicado), com
  localização, dependências (API/UI/models/testes), evidências
  `[Código]/[Teste]`, destino recomendado e conferência de completude
  (22/22 controllers, 25/25 models, 38/38 páginas, 19/19 arquivos de
  teste).
- Diferenciação billing SaaS da Akylla × financeiro da empresa cliente;
  registro das decisões futuras de navegação, destino do pet shop e
  **opções de ativação por segmento (somente documentação — Decisão 2)**.

### Notas

- Etapa de análise/documentação: **nenhum código, teste, schema,
  migration, dado ou configuração alterado**; nenhum módulo excluído,
  ocultado, renomeado ou migrado; nenhuma dependência adicionada.
- Pendências registradas: D1 (construção de "configurações da empresa" —
  etapa a definir), D2/D3 (destino do pet shop e ativação por segmento →
  Etapa 10), D4 (confirmação da leitura de opcionais genéricos).

### Verificado

- `lint` 0 · `typecheck` OK · **436/436 testes** (sem variação em
  relação à Etapa 3) · `git status` restrito a arquivos de documentação.
- Conclusão da etapa **pendente de revisão e aprovação da matriz pelo
  proprietário** (Etapa 5 não iniciada).

## [Akylla Gestão] - 2026-10-12 - Etapa 3 — Auditoria multiempresa e permissões

### Adicionado

- `tests/integration/tenancy-audit.test.ts` (+56 cenários Empresa Alfa × Empresa Bravo):
  identificação do tenant pela sessão, injeção de `companyId`
  (corpo/query/cabeçalho), leitura cruzada por ID (18 recursos), escrita
  cruzada com verificação pós-condição no banco, referências FK de outra
  empresa rejeitadas, relatórios/CSV por empresa, perfis ADMIN × MEMBER e
  ausência de dados de B em respostas de erro.
- `docs/akylla/AUDITORIA_MULTIEMPRESA.md`: relatório completo (escopo,
  matriz A×B, permissões, evidências, riscos e recomendações).

### Verificado

- Suíte completa **436/436 aprovados** (base 380 + 56 novos; nenhum teste
  existente alterado), `lint` 0, `typecheck` OK, `build` OK.
- **Nenhuma falha de isolamento entre empresas nem de autorização por
  perfil confirmada.** Comportamentos intencionais documentados (MEMBER na
  operação diária, planos SaaS globais, consentimento `OPTED_IN` restrito a
  ADMIN). Nenhuma correção de segurança implementada (etapa de auditoria).

## [Akylla Gestão] - 2026-10-12 - Etapa 2 — Identidade

### Alterado

- Produto renomeado visualmente para **Akylla Gestão** ("Gestão para
  pequenos negócios"): `layout.tsx` (título/metadados/subtítulo/rodapé;
  removidos o emoji de pata e o badge "Etapa 9"), `/login`, `/cadastro`,
  `/faturamento` (3 textos), cards da home ("Clientes", "Agendamentos",
  "Faturamento"), `Receipt.tsx`, fallbacks de impressão em `/pdv` e
  `/vendas/[id]`, log de boot da API e constante `APP_NAME`
  (`@petflow/shared`).
- Exportações CSV: prefixos padronizados em `akylla_*` (servidor em
  `reports.service.ts` e nomes de fallback em `/relatorios`); asserção
  correspondente atualizada em `tests/integration/reports.test.ts` (mesma cobertura).
- Moeda no comprovante impresso (`Receipt.tsx`, `lib/print.ts`)
  padronizada em BRL via `formatBrl()` (antes `R$ x.xx` com ponto).
- Textos de nicho removidos de módulos genéricos (card "Clientes e
  animais" → "Clientes"; "banho e tosa" → "atendimentos"; placeholder de
  template neutro). Exemplos do CLI `bootstrap-admin` genéricos.

### Preservado (de propósito)

- Identificadores internos `@petflow/*`, cookie `petflow_session`,
  `service: "petflow-api"`, nome legado do fixture do provedor mock,
  prefixo de
  comprovante `PF-`, bancos/tabelas/migrations, pasta legada
  `automação do whatsapp/`, seed de demonstração. Nenhum módulo excluído;
  nenhum item removido da navegação (análise em
  `docs/akylla/IDENTIDADE_E_NAVEGACAO.md`).

### Verificado

- `lint` 0 erros · `typecheck` OK · **380/380 testes aprovados** · `build`
  OK · `db:validate` OK (linha de base da Etapa 1 reproduzida sem falhas).

