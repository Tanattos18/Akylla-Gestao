# Changelog — Akylla Gestão

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

> **Escopo:** este changelog cobre a era do **Akylla Gestão** (adaptação e
> roteiro das Etapas 0–12, a partir de 2026-10-12). O histórico anterior à
> adaptação não é mantido aqui — está preservado no histórico do Git.

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
- **Testes** `tests/imports.test.ts` (29 cenários: autorização, validação
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
- Testes: `tests/tenant-limits.test.ts` (7 — sem assinatura, ativa no
  Essencial bloqueia 4º usuário, cliente limite ajustado, Completo sem
  trava, EXPIRED/CANCELLED sem trava, isolamento cross-tenant) e
  `tests/mercadopago.test.ts` (12 — checkout admin/member/anon, plano
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
- `tests/company-modules.test.ts` (**+13 testes**): listagem padrão
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
- `tests/reports.test.ts` (**+3 testes**): **empresa vazia** (summary,
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
- `tests/financial.test.ts` (**+30 testes**): criação e validações
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

- `tests/stock.test.ts` (+2): **requisição repetida** de movimento gera
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

- `tests/clients.test.ts` (+2): criação de cliente somente com nome
  (CPF/telefone/email não obrigatórios) e **inativação preserva histórico
  de vendas** (venda com cliente → inativar → ficha com `_count.sales` e
  venda consultável).
- `tests/catalog.test.ts` (+4): fornecedor somente com nome, busca por
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

- `tests/tenancy-audit.test.ts` (+56 cenários Empresa Alfa × Empresa Bravo):
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
  correspondente atualizada em `tests/reports.test.ts` (mesma cobertura).
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

