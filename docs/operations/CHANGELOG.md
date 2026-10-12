# Changelog — PetFlow

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

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
- Exportações CSV: prefixos `petflow_*` → `akylla_*` (servidor em
  `reports.service.ts` e nomes de fallback em `/relatorios`); asserção
  correspondente atualizada em `tests/reports.test.ts` (mesma cobertura).
- Moeda no comprovante impresso (`Receipt.tsx`, `lib/print.ts`)
  padronizada em BRL via `formatBrl()` (antes `R$ x.xx` com ponto).
- Textos de nicho removidos de módulos genéricos (card "Clientes e
  animais" → "Clientes"; "banho e tosa" → "atendimentos"; placeholder de
  template neutro). Exemplos do CLI `bootstrap-admin` genéricos.

### Preservado (de propósito)

- Identificadores internos `@petflow/*`, cookie `petflow_session`,
  `service: "petflow-api"`, provedor mock "PetFlow Mock", prefixo de
  comprovante `PF-`, bancos/tabelas/migrations, pasta legada
  `automação do whatsapp/`, seed de demonstração. Nenhum módulo excluído;
  nenhum item removido da navegação (análise em
  `docs/akylla/IDENTIDADE_E_NAVEGACAO.md`).

### Verificado

- `lint` 0 erros · `typecheck` OK · **380/380 testes aprovados** · `build`
  OK · `db:validate` OK (linha de base da Etapa 1 reproduzida sem falhas).

## [Não categorizado] - 2026-10-10 - Seed de demonstração

### Adicionado

- **`apps/api/src/cli/seed-demo.ts`** (`npm run db:seed:demo --
  --company=<slug|id|email>`): popula uma empresa vazia com dados
  realistas de demonstração em **uma única transação** — 6 categorias,
  5 fornecedores, 32 produtos (com entradas de estoque e alertas de
  estoque mínimo), 24 clientes, 26 pets, 8 serviços, 4 planos de
  assinatura, usuário membro, ~44 vendas em 7 sessões de caixa
  fechadas + a sessão aberta do dia (itens, movimentos de estoque
  OUT, lançamentos `SALE`/`SALE_CANCELMENT`, taxas de maquininha,
  contagens de fechamento com diferença), 20 agendamentos (passado e
  futuro, inclui `NO_SHOW`/`CANCELLED`), 8 assinaturas (ATIVA/EXPIRADA/
  CANCELADA com pagamentos no caixa), assinatura do tenant (plano
  Profissional), 3 templates + 14 consentimentos + 12 mensagens
  WhatsApp (inclui `FAILED` com tentativas e `PENDING` futura) e
  config do WhatsApp.
- Guard de segurança: só roda em empresa **vazia** (aborta se já houver
  produtos/clientes), e todos os valores (totais, saldos esperados,
  diferença de contagem, `startLocal`×`startAt`) são conferidos por
  integridade antes da entrega.
- Comando na raiz: `db:seed:demo` (scripts `seed:demo` no workspace
  `@petflow/api`).

## [Não categorizado] - 2026-10-10 - Cadastro aberto de contas

### Adicionado

- **Cadastro aberto** (`/cadastro`, link "Cadastre-se" na tela de
  login): o visitante informa nome da empresa, seu nome, email e senha
  → cria uma **empresa nova (tenant) + usuário administrador** e entra
  automaticamente no sistema (cookie de sessão na resposta).
- Endpoint público `POST /api/auth/register` (HTTP 201): só responde
  quando `REGISTRATION_ENABLED=true` (senão 404), rate limit por IP
  (`register|ip`, mesmo `LoginRateLimiter`), email único global (409
  "Este email já está cadastrado" — preserva o login, que exige email
  sem conta duplicada), slug da empresa gerado do nome com sufixo
  único (`pet-shop-registro-2`, …), senha 8..72 com hash bcrypt 12.
- Flag `REGISTRATION_ENABLED` em `apps/api/src/config/env.ts`
  (padrão: desabilitado), documentada no `.env.example` e habilitada
  no `.env` local.
- Refatoração: criação de sessão extraída para
  `AuthService.createSession()` (reutilizada por login e registro).
- Frontend: página `/cadastro` com validação (campos, senha 8..72,
  confirmação) e erros de campo/servidor; link de cadastro no `/login`.
- Testes: `tests/register.test.ts` (6) — criação + auto-login + login
  posterior, slug único, 409 de email, 400 de política, flag
  desabilitada e rate limit; suíte completa: **380/380 testes em 18
  arquivos**.

### Segurança (decisão registrada)

- Cadastro público cria tenant sem verificação de email nem
  anti-abuso (rate limit por IP é a única proteção) — em produção,
  avaliar verificação de email/captcha antes de habilitar; flag
  desligada por padrão.

## [Não categorizado] - 2026-10-10 - Redefinição de senha pelo painel

### Adicionado

- **Fluxo "Definir nova senha"** (`/redefinir-senha`, link na tela de
  login): o usuário digita o email do seu usuário e a senha que quer
  usar — pensado para o primeiro acesso/recuperação local sem
  dependência de SMTP.
- Endpoint `POST /api/auth/reset-password` (público): só responde
  quando `PASSWORD_RESET_ENABLED=true` (senão 404), com rate limit
  próprio (`reset|ip|email`, mesmo `LoginRateLimiter` do login),
  política de senha 8..72 (schema `resetPasswordSchema` em
  `@petflow/shared`, reaproveitando o novo `passwordFieldSchema`), 404
  para usuário inativo/inexistente, 400 quando o email pertence a
  várias contas e **revogação de todas as sessões abertas** do usuário
  na mesma transação da troca de hash.
- Flag `PASSWORD_RESET_ENABLED` em `apps/api/src/config/env.ts`
  (padrão: desabilitado), documentada no `.env.example` e habilitada
  no `.env` local.
- Frontend: página `/redefinir-senha` (email + nova senha + confirmação,
  estados de sucesso/erro) e link "Não consegue entrar? Defina sua
  senha" em `/login`.
- Testes: `tests/password-reset.test.ts` (7) — troca + login novo/
  antigo, sessões revogadas, 404/400, flag desabilitada e rate limit;
  `tests/setup-env.ts` habilita a flag nos testes. Suíte completa:
  **374/374 testes em 17 arquivos**.

### Segurança (decisão registrada)

- O fluxo **não envia token por e-mail** (sem infra SMTP): a proteção é
  a flag de ambiente (desabilitada por padrão) + rate limit. Em
  produção, manter a flag desabilitada e implementar redefinição com
  token enviado por e-mail — **pendência registrada** em
  `PROJECT_STATUS.md`.

## [Etapa 9] — 2026-10-10 — Assinaturas e gestão comercial

### Adicionado

- **Escopo**: assinaturas recorrentes de clientes do pet shop (planos,
  criação, renovação via caixa e cancelamento com motivo) + billing da
  própria empresa no SaaS (catálogo de planos globais e assinatura do
  tenant). Sem prompt oficial em `Etapas_projeto/` — escopo definido e
  **aprovado na conversa** com o proprietário (opções "Ambos" e
  "pagamento via caixa/venda existente"); decisões registradas:
  pagamento sempre em dinheiro no caixa (sem gateway), cancelamento
  com motivo obrigatório para assinatura de cliente e opcional para o
  billing, catálogo global do billing sem escrita via API nesta etapa.
- Schemas Zod E9 (`@petflow/shared`, seção "Etapa 9"):
  `subscriptionStatusSchema`/`tenantSubscriptionStatusSchema`
  (ACTIVE/EXPIRED/CANCELLED) + labels,
  `SUBSCRIPTION_MIN/MAX_DURATION_DAYS` (1/3650),
  `TENANT_PLAN_DEFAULT_DURATION_DAYS=30`, `create/updateSubscriptionPlanSchema`
  (reaproveita `nameField`/`priceFieldSchema`), `listSubscriptionPlansQuerySchema`,
  `createSubscriptionSchema` (`clientId`, `planId`, `startAt` opcional ISO,
  `registerPayment`), `cancelSubscriptionSchema` (reason 3..500),
  `listSubscriptionsQuerySchema`, `updateTenantSubscriptionSchema` e
  `cancelTenantSubscriptionSchema` (reason opcional, máx. 500).
- Migration `20261010131027_etapa9_subscriptions`: enums
  `SubscriptionStatus` e `TenantSubscriptionStatus`; modelos
  `SubscriptionPlan` e `Subscription` (tenant-scoped, FK `Restrict`,
  índices por empresa e `[clientId]`), `TenantPlan` e
  `TenantSubscription` (**globais por decisão documentável** —
  `TenantSubscription.companyId` `@unique`, exceção à regra "todo
  modelo tem companyId"); `CashMovement.subscriptionId` (coluna
  aditiva, FK `SetNull` + índice `[companyId, subscriptionId]`);
  seed dos 3 `TenantPlan` iniciais (essencial 79,90 / profissional
  149,90 / completo 249,90, 30 dias, ids fixos) na própria migration;
  aplicada em `petflow` (dev); `npm run db:validate` OK.
- Módulo `apps/api/src/subscriptions` (`SubscriptionsModule`):
  - `GET/POST /api/subscription-plans` (POST 201, AdminGuard; nome
    único por empresa → 409), `GET /:id`, `PATCH /:id` e
    `PATCH /:id/status` (escrita ADMIN; cross-tenant → 404).
  - `GET /api/subscriptions` (paginação + `status`/`clientId`/`search`)
    e `GET /:id` (expiração lazy de assinaturas vencidas nas leituras).
  - `POST /api/subscriptions` (201, AdminGuard): valida cliente ativo e
    plano ativo; `registerPayment` cria `CashMovement` IN/MANUAL em
    transação após `lockOpenCashSession` (caixa fechado → 409).
  - `POST /:id/renew` (201): exige caixa aberto; estende o período a
    partir de `max(now, endAt)`, incrementa `renewalCount`, grava
    `lastPaymentAt` e registra movimento de caixa vinculado; assinatura
    cancelada → 409.
  - `POST /:id/cancel` (201): motivo 3..500; `updateMany` com guarda de
    status → 409 em dupla corrida.
- Módulo `apps/api/src/billing` (`BillingModule`): `GET /api/billing/plans`
  (catálogo global ativo), `GET /api/billing/subscription` (404 se não
  existir; expiração lazy), `PUT /api/billing/subscription` (AdminGuard;
  upsert = troca de plano reinicia o período e reativa), `POST
  .../renew` (201; cancelada → 409) e `POST .../cancel` (201; duplo →
  409). Escrita do catálogo global não exposta (pendência de papel de
  plataforma); sem gateway/limites de uso (pendência registrada).
- Frontend: `/planos` (CRUD ADMIN de planos de cliente), `/assinaturas`
  (lista com filtros de status/busca e paginação), `/assinaturas/nova`
  (formulário com cliente/plano/opção de pagamento no caixa),
  `/assinaturas/[id]` (detalhe, pagamentos, renovar e cancelar),
  `/faturamento` (situação da assinatura da empresa + troca/renovação/
  cancelamento de plano), cards "Assinaturas" e "Faturamento" na home e
  badge do rodapé/cabeçalho para "Etapa 9 — Assinaturas"; DTOs novos em
  `apps/web/src/lib/types.ts`.
- Testes: `tests/subscriptions.test.ts` (18) e `tests/billing.test.ts`
  (12) — CRUD de planos, validações, 404 cross-tenant, caixa fechado
  (409), renovação/cancelamento, upsert/renew/cancel do billing e
  guards ADMIN; `resetDatabase` cobre os modelos novos. Suíte completa:
  **367/367 testes em 16 arquivos**.

## [Etapa 8] — 2026-10-10 — Agendamentos

### Adicionado

- **Escopo**: módulo de agendamentos com agenda diária, conflito de
  horário da empresa inteira, transições de status e cancelamento com
  motivo, lembretes automáticos pela fila WhatsApp existente (worker
  sem alteração) e integração com dashboard/relatórios. Sem prompt
  oficial em `Etapas_projeto/` — escopo definido e **aprovado na
  conversa** com o proprietário; decisões registradas: conflito
  empresa-inteira, serviços em vendas/PDV fora da etapa, lembretes
  incluídos e `durationMinutes` obrigatório.
- Schemas Zod E8 (`@petflow/shared`, seção "Etapa 8"):
  `appointmentStatusSchema` + labels, `APPOINTMENT_BLOCKING_STATUSES`
  (SCHEDULED/CONFIRMED) e `APPOINTMENT_TERMINAL_STATUSES`
  (COMPLETED/CANCELLED/NO_SHOW), `APPOINTMENT_REMINDER_VARIABLE_COUNT=3`,
  `APPOINTMENT_REMINDER_LEAD_MIN/MAX/DEFAULT` (5/40320/1440),
  `localDateTimeField` (YYYY-MM-DDTHH:mm + calendário real),
  `createAppointmentSchema`, `updateAppointmentSchema` (partial),
  `updateAppointmentStatusSchema` (CONFIRMED|COMPLETED|NO_SHOW),
  `cancelAppointmentSchema` (motivo 3..500) e
  `listAppointmentsQuerySchema` (paginação + `from`/`to` +
  `status`/`clientId`/`petId`/`serviceId`/`search` +
  `checkReportPeriod`); `updateWhatsAppConfigSchema` ganha
  `reminderTemplateId` e `reminderLeadMinutes` (5..40320).
- Migration `20261010115308_etapa8_appointments`: enum
  `AppointmentStatus`; modelo `Appointment` (FK `Restrict` para
  `Company`/`Client`/`Pet`/`Service` e `createdByUserId`;
  `cancelledByUserId` `SetNull`; índices `[companyId, startLocal]`,
  `[companyId, status, startAt]`, `[clientId]`, `[petId]`);
  `WhatsAppConfig.reminderTemplateId` (FK → `WhatsAppTemplate`,
  `SetNull`) + `reminderLeadMinutes Int @default(1440)` e relação
  `reminderConfigs` no template; aplicada em `petflow` (dev);
  `npm run db:validate` OK.
- Módulo `apps/api/src/appointments` (`AppointmentsModule`, prefixo
  `/api`, somente sessão autenticada — **sem `AdminGuard`**: membro
  também agenda):
  - `POST /api/appointments` (201): `startAt`/`endAt` calculados no
    servidor a partir de `startLocal` + `utcOffsetMinutes` (convenção
    leste-positivo, ±840 min); recusa horário no passado (tolerância
    de 60 s); valida cliente ativo, pet do cliente e serviço ativo.
  - `GET /api/appointments`: filtros `from`/`to` sobre `startLocal`
    (comparação lexicográfica da hora de parede), `status`, `clientId`,
    `petId`, `serviceId` e `search` (nome de cliente/pet/serviço);
    ordenação por `startAt` ascendente; paginação.
  - `GET /api/appointments/:id` (404 cross-tenant), `PATCH /:id`
    (campos parciais; reagendamento recalcula `startAt`/`endAt`;
    apenas status não-terminal).
  - `PATCH /:id/status` (CONFIRMED/COMPLETED/NO_SHOW; terminal → 409;
    enum com CANCELLED → 400) e `POST /:id/cancel` (201; motivo
    obrigatório; cancela via `updateMany` com guarda de status →
    dupla corrida 409).
  - **Conflito de empresa inteira**: transação com
    `SELECT id FROM "Company" WHERE id = $1 FOR UPDATE` (mesmo
    padrão da sessão de caixa) + sobreposição em SCHEDULED/CONFIRMED
    (`startAt < endAt AND endAt > startAt`) → 409; fim-início exato
    permitido; cancelados/concluídos/no-show não bloqueiam; a edição
    exclui o próprio registro (sobreposição consigo mesmo é aceita).
- **Lembrete automático** (`syncReminder` em `appointments.service.ts`,
  reutilizando a fila WhatsApp e o worker da Etapa 6 sem mudanças):
  chave de idempotência `appointment-reminder:<id>` única por empresa
  (`@@unique([companyId, idempotencyKey])`), `origin: SERVICE_REMINDER`,
  `nextAttemptAt = máx(agora, startAt − antecedência)`; variáveis
  `[pet ou tutor, nome do serviço, "dd/mm/aaaa às HH:mm"]` derivadas
  do horário local; elegibilidade revalidada a cada mutação (config ≠
  `DISCONNECTED` + `phoneNumberId` + template selecionado da mesma
  empresa ativo, `APPROVED` e com exatamente 3 variáveis, cliente
  ativo com telefone em E.164, consentimento `OPTED_IN`, horário
  futuro); reagendar atualiza a pendente (sem duplicar), cancelar →
  `Agendamento cancelado`, concluir/no-show → `Agendamento encerrado`,
  inelegível → cancela sem criar; corrida `P2002` é ignorada; falha de
  lembrete só gera log e nunca derruba o CRUD.
- `GET/PUT /api/whatsapp/config` com `reminderTemplateId` e
  `reminderLeadMinutes`; o PUT rejeita (400) template de outra
  empresa ou com número de variáveis ≠ 3 — aprovação é revalidada no
  enfileiramento.
- Relatórios E8: `GET /api/reports/summary` ganha `services`
  (contagens por status, zero-fill, por `startAt` no período) e
  `modules.servicesRealized` passa a `{available: true, reason: null}`;
  `GET /api/reports/clients` substitui `servicesRealized` por
  `services`.
- Frontend: `/agenda` (visão por dia com navegação ←/Hoje/→ e date
  picker, filtros de status/busca, paginação), `/agenda/novo`,
  `/agenda/[id]` (transições e cancelamento com motivo) e
  `/agenda/[id]/editar`; `components/AppointmentForm.tsx` (clientes
  ativos, pets dependentes do cliente, serviço sugere duração,
  `datetime-local`, offset do navegador no envio); `lib/types.ts`
  (bloco "Etapa 8", `AppointmentDto`, `ServicesCounts`,
  `WhatsAppConfigDto` com campos de lembrete), `lib/format.ts`
  (`localDayKey`, `todayLocal`, `shiftDay`, `formatDayTitle`,
  `formatLocalTime`, `formatLocalDateShort`, `defaultStartLocal`);
  home com card "Agendamentos" disponível; badge "Etapa 8 —
  Agendamentos"; `/whatsapp` com select de template de lembrete
  (aprovados com exatamente 3 variáveis) e antecedência em minutos;
  `/dashboard` e `/relatorios` exibindo contagens reais de
  agendamentos.
- Testes: `tests/appointments.test.ts` com **45 testes** (criação e
  validações 400, conflito/frenteiras/não-bloqueio/isolamento de
  empresa, lista com filtros e paginação, edição e reagendamento,
  transições de status, cancelamento e lembretes com
  consentimento/template/aprovação/antecedência); `resetDatabase`
  com `appointment.deleteMany()` antes de pet/client/service e
  `whatsAppConfig` antes de `whatsAppTemplate` (novo FK); asserts de
  `servicesRealized` atualizados em `tests/reports.test.ts`;
  **total 337/337 aprovados (14 arquivos)**.

## [Etapa 7] — 2026-10-09 — Dashboard e relatórios

### Adicionado

- **Escopo**: dashboard gerencial e relatórios com **agregação
  server-side** sobre os dados reais das Etapas 1–6 — nenhum dado
  fictício; serviços realizados ficam explicitamente indisponíveis
  até a Etapa 8; sem nova dependência de biblioteca de gráficos
  (barras CSS/Tailwind).
- Schemas Zod compartilhados (`@petflow/shared`, seção "Etapa 7"):
  `reportDateField` (YYYY-MM-DD + calendário real — `2026-02-30`
  rejeitado), `checkReportPeriod` (`from ≤ to`, máximo
  `REPORT_MAX_RANGE_DAYS=366` dias), período padrão
  `REPORT_DEFAULT_RANGE_DAYS=30`, `reportFormatSchema` (`json|csv`),
  `dashboardSummaryQuerySchema`, `salesReportQuerySchema`,
  `stockAlertsReportQuerySchema`, `stockMovementsReportQuerySchema`,
  `cashReportQuerySchema`, `clientsReportQuerySchema`,
  `whatsappReportQuerySchema`.
- **Período em UTC** (`REPORT_TIMEZONE="UTC"`): janela inclusiva
  `T00:00:00.000Z`–`T23:59:59.999Z` do `from` ao `to`, documentada
  e coberta por testes de fronteira.
- Módulo `apps/api/src/reports` (`ReportsModule`, prefixo `/api`,
  sob `AuthGuard` global — leitura exige apenas sessão, sem
  `AdminGuard`):
  - `GET /api/reports/summary` — vendas (concluídas/canceladas,
    líquido, bruto, descontos, ticket médio com `null` quando não há
    vendas), vendas por dia e por forma de pagamento (SQL puro),
    caixa (sessão aberta com saldo esperado, entradas/saídas
    `inCash` e totais), estoque (baixo/sem estoque), clientes e pets
    novos, WhatsApp por status e `modules.servicesRealized`
    (`available: false` + motivo).
  - `GET /api/reports/sales` — totais separados concluídas ×
    canceladas (filtro `status` afeta só a lista; `paymentMethod`
    afeta os totais), lista paginada, `format=csv`.
  - `GET /api/reports/stock/alerts` — produtos sem estoque
    (`qty=0`) ou no mínimo (`qty>0` e `qty ≤ minimumStock`),
    excluindo inativos; paginação e `format=csv`.
  - `GET /api/reports/stock/movements` — totais por tipo (zero-
    fill), filtros `productId`/`type`/período, paginação e
    `format=csv`.
  - `GET /api/reports/cash` — `inCash` vs todos, estornos por
    origem, sessões fechadas no período (diferenças) e sessão
    aberta.
  - `GET /api/reports/clients` — clientes/pets novos por período e
    pets por espécie.
  - `GET /api/reports/whatsapp` — status atual (aceitação da API
    não é entrega), falhas agrupadas por motivo.
- Helper CSV (`apps/api/src/common/utils/csv.ts`): aspas, CRLF e
  neutralização de injeção (célula iniciada por `=`, `+`, `-`, `@`
  recebe apóstrofo); limite `REPORT_CSV_MAX_ROWS=5000`, CSV ignora
  paginação; exportação disponível em vendas, alertas e
  movimentações de estoque (Content-Disposition com filename
  `petflow_*_YYYY-MM-DD.csv`).
- Frontend: `/dashboard` (período editável, KPIs de vendas, caixa,
  estoque, clientes, WhatsApp, vendas por dia em barras CSS, por
  forma de pagamento e card "Módulo não disponível" de serviços),
  `/relatorios` (abas vendas, estoque — alertas/movimentos —,
  caixa, clientes, WhatsApp; filtros, paginação e botões CSV),
  `lib/format.ts` (BRL, datas UTC), `downloadCsv()` em `lib/api.ts`;
  home com cards "Dashboard" e "Relatórios"; badge "Etapa 7".
- Migration aditiva `20261010002727_etapa7_report_indexes`: índices
  `@@index([companyId, createdAt])` em `Client` e `Pet` para as
  agregações por período (nenhum dado alterado); aplicada em
  `petflow`; `npm run db:validate` OK.
- Testes: `tests/reports.test.ts` com **41 testes** (agregações,
  fronteiras de data UTC, default de 30 dias, validações 400,
  filtros/paginação, alertas, caixa `inCash` vs todos + estornos,
  espécies, WhatsApp status/falhas, isolamento multiempresa,
  permissões MEMBER/401, CSV com anti-injeção e estado vazio com
  `ticketAverage: null`).

## [Etapa 6] — 2026-10-09 — Integração com WhatsApp

### Adicionado

- **Escopo**: integração com a **WhatsApp Business Cloud API** (Meta) como
  camada de provedor de mensagens — sem scraping, Selenium ou QR code;
  fila de envio em PostgreSQL processada pelo `apps/worker` (sem
  Redis/BullMQ); a pasta `automação do whatsapp/` permanece intocada.
- Schema Prisma: enums `WhatsAppConfigStatus`, `WhatsAppTemplateStatus`,
  `WhatsAppTemplateCategory`, `WhatsAppConsentStatus`,
  `WhatsAppConsentSource`, `WhatsAppMessageStatus`,
  `WhatsAppMessageOrigin`, `WhatsAppAttemptResult` + modelos
  `WhatsAppConfig`, `WhatsAppTemplate`, `WhatsAppConsent`,
  `WhatsAppMessage`, `WhatsAppSendAttempt`, `WhatsAppWebhookEvent`
  (todos com `companyId` + índices multiempresa; FKs `Restrict`);
  migration `20261009232055_etapa6_whatsapp_integration` aplicada em
  `petflow` e `petflow_test`; `npm run db:validate` OK.
- Pacote `packages/whatsapp` (`@petflow/whatsapp`):
  `phone.ts` (`toE164`, `isE164` com validação E.164), `errors.ts`
  (`WhatsAppProviderError`, `classifyHttpStatus` — 429/408/5xx =
  TRANSIENT, `nextBackoffMs` com backoff exponencial 5s·2^n (cap 300s),
  `isOptOutText` para palavras de descadastro), `provider.ts`
  (`MetaCloudProvider` com injeção de `fetchImpl`, headers de assinatura
  e scrub de credenciais em erros/log; `MockWhatsAppProvider` com
  `failureMode`/`failureTimes`/`sendCount` para testes determinísticos;
  `createWhatsAppProvider`).
- Schemas Zod compartilhados (`@petflow/shared`, seção "Etapa 6"):
  config (phoneNumberId/wabaId/displayName/apiVersion/countryCode),
  template (nome, corpo com variáveis `{{n}}`, linguagem
  `pt_BR`/`en_US` via regex `/^[a-z]{2}([_-][A-Z]{2})?$/`), consentimento
  (telefone E.164 obrigatório), mensagem (template + variáveis
  validadas contra `templateVariableCount()`) e cancelamento — com
  labels PT-BR.
- `apps/api/src/whatsapp/` (módulo `WhatsAppModule`, 5 controllers):
  - `GET/PUT /api/whatsapp/config` (leitura; escrita ADMIN; nunca
    retorna access token), `POST /whatsapp/config/health` (teste de
    credencial com sanitização de token), `PATCH /whatsapp/config/status`
    (ativar/desconectar).
  - `GET/POST /api/whatsapp/templates` (catálogo + criação com contagem
    de variáveis), `PATCH /whatsapp/templates/:id/approval` (ADMIN),
    `PATCH /whatsapp/templates/:id/status`.
  - `GET/POST /api/whatsapp/consents` e `GET/PUT
    /whatsapp/consents/:clientId` (opt-in/opt-out auditável por
    cliente+empresa; escrita ADMIN; bloqueio de envio sem consentimento
    OPTED_IN).
  - `GET /api/whatsapp/messages` (filtros status/busca + paginação),
    `GET/POST /whatsapp/messages` (enfileiramento validado no servidor —
    cliente, template aprovado, consentimento, variáveis; idempotente
    por `clientRequestId`), `POST /whatsapp/messages/:id/cancel`.
  - Webhook (`@Public`, `whatsapp/webhook`): `GET` verificação Meta
    (retorna challenge em `text/plain`), `POST` com verificação
    `x-hub-signature-256` (HMAC-SHA256 com `WHATSAPP_APP_SECRET` sobre
    `req.rawBody`), processamento idempotente por `wamid`
    (`WhatsAppWebhookEvent`), atualização de status
    (sent/delivered/read/failed com retry TRANSIENT), resposta
    `REPLY` "SAIR" → opt-out automático (`OPTED_OUT`, source `REPLY`).
- Configuração de ambiente (`apps/api/src/config/env.ts`):
  `WHATSAPP_PROVIDER` (meta|mock, padrão mock em dev/test),
  `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`,
  `WHATSAPP_APP_SECRET`, `WHATSAPP_API_VERSION`,
  `WHATSAPP_COUNTRY_CODE` (prefixo, padrão 55) — credenciais apenas em
  `.env` local, nunca em docs/Git.
- **`WhatsAppProviderService`**: resolve credenciais do banco
  (`WhatsAppConfig` por empresa) com fallback de env; `setProviderConfig()`
  para injeção de provedor nos testes; `describe()` sem segredos.
- **`apps/worker`** (fila em Postgres):
  `src/env.ts` (zod + dotenv fallback `../../.env`;
  `WORKER_POLL_INTERVAL_MS=5000`, `WHATSAPP_SEND_MAX_PER_CYCLE=20`,
  `WHATSAPP_SEND_INTERVAL_MS=250`),
  `src/whatsapp/processor.ts` (`processDueMessages`: claim atômico com
  `updateMany` (PENDING→SENDING, guarda de corrida), cache de config por
  ciclo, cancelamento por opt-out/desconexão, transação attempt+update,
  backoff exponencial com `nextAttemptAt`, classificação TRANSIENT vs
  PERMANENT — TRANSIENT reagenda (`RETRY`), esgotado `MAX_ATTEMPTS=3` →
  `FAILED`; cap de envios por ciclo), `src/main.ts` (loop com guarda
  `running`, heartbeat a cada 60s, SIGINT/SIGTERM), `package.json`
  (deps: `@petflow/whatsapp`, `@prisma/client`, `dotenv`, `zod`).
- Frontend (`apps/web`): badge "Etapa 6 — Integração com WhatsApp";
  rotas `/whatsapp` (status + credenciais + testar conexão +
  desconectar/reconectar), `/whatsapp/templates` (criar, aprovação,
  ativar/inativar), `/whatsapp/mensagens` (lista com filtros, envio com
  variáveis dinâmicas, cancelar), `/whatsapp/mensagens/[id]` (detalhe +
  tentativas de envio); seção "Consentimento WhatsApp" em
  `/clientes/[id]` (badge, origem, botões de opt-in ADMIN e descadastro
  com confirmação); card "Automação WhatsApp" disponível na home
  (roadmap da home reordenado: WhatsApp → Dashboard → Agendamentos).
- Testes: **`tests/whatsapp.test.ts` com 61 testes** (unit: E.164,
  classificação HTTP, backoff, opt-out; integração: config/health com
  sanitização de token, templates, consentimento com isolamento
  multiempresa, enfileiramento com validações completas e
  idempotência, fila com claim concorrente, backoff, cancelamentos e
  rate limit, webhook com challenge, assinatura inválida 403,
  idempotência anti-regressão, opt-out por REPLY). `tests/setup-env.ts`
  com env de teste E6 e limpeza em cascata das tabelas WhatsApp.

### Alterado

- `app.module.ts` registra `WhatsAppModule`; `main.ts` e
  `tests/helpers/app.ts` habilitam `rawBody` (necessário para a
  assinatura HMAC do webhook).
- Roadmap (README e home): **Etapa 6 = WhatsApp (Concluída)**,
  **Etapa 7 = Dashboard (Próxima)**, Etapa 8 = Agendamentos,
  Etapa 9 = Assinaturas — conforme prompt oficial da Etapa 6 (o README
  anterior, com 6=Agendamentos e 7=WhatsApp, foi corrigido; havia linha
  duplicada na tabela).
- Total de testes: 190 → **251**.

## [Etapa 5] — 2026-10-09

### Adicionado

- Schema Prisma: modelos `Client`, `Pet` e `Service` (+ enums
  `PetSpecies` e `PetSex`), campo opcional `Sale.clientId` (FK
  `SetNull`, índice `(companyId, clientId)`) e migration aditiva
  `20261009222638_etapa5_clients_pets_services` aplicada em `petflow` e
  `petflow_test`; sem quebra de dados existentes.
- API NestJS (prefixo `/api`, sob `AuthGuard` global):
  - `clients`: `GET /clients` (busca por nome/telefone/mobile/email/CPF,
    filtros de status e paginação), `GET /clients/:id`,
    `GET /clients/:id/pets`, `POST`, `PATCH /:id`, `PATCH /:id/status`
    (escrita autenticada — operação diária, inclui MEMBER).
  - `pets`: `GET /pets` (busca por pet/raça/cor/responsável, filtros de
    responsável/espécie/status), `GET /pets/:id` (com responsável),
    `POST`, `PATCH /:id` (inclui troca de responsável validado),
    `PATCH /:id/status` (escrita autenticada).
  - `services`: `GET /services` (busca, ordenação por nome/preço,
    paginação), `GET /services/:id`, `POST`, `PATCH /:id`,
    `PATCH /:id/status` (escrita restrita a ADMIN — catálogo/preços).
- **Anti-duplicidade de clientes** (documentado no `ClientsService`):
  normalização server-side (`nameKey` = nome minúsculo com espaços
  colapsados, telefone só dígitos, email minúsculo) + pre-check na mesma
  transação — bloqueia apenas quando `nameKey` coincide **e** há telefone/
  mobile/email igual com um cliente `ACTIVE` (409
  `"Cliente possivelmente duplicado"`); nome sozinho nunca bloqueia
  (homônimos), contato sozinho nunca bloqueia (famílias) e `INACTIVE`
  não sinaliza duplicidade; sem unique duro de `nameKey` no banco (janela
  de corrida aceita e documentada).
- Serviços com `nameKey` único por empresa (`@@unique([companyId,
  nameKey])`, como categorias): nome repetido (case-insensitive,
  espaços colapsados) → 409; preço `Decimal(12,2)` obrigatório ≥ 0 e
  duração 1..1440 minutos quando informada.
- Integração venda–cliente: `POST /sales` aceita `clientId` opcional
  (validado `ACTIVE` e da mesma empresa; inativo/outros → 400); listagem
  e detalhe passam a retornar `client { id, name }`; snapshots e totais
  das vendas preservados.
- Schemas Zod compartilhados em `@petflow/shared`: `createClientSchema`,
  `updateClientSchema`, `listClientsQuerySchema`, `createPetSchema`,
  `updatePetSchema`, `listPetsQuerySchema`, `createServiceSchema`,
  `updateServiceSchema`, `listServicesQuerySchema`, enums
  `petSpecies`/`petSex`, labels e helpers `normalizePhone` (data de
  nascimento no futuro → 400; peso 0..999.99 kg).
- Frontend: `/clientes` (lista com busca, contagem de pets, formulário
  completo de cadastro/endereço, ativar/inativar),
  `/clientes/[id]` (ficha do responsável + gestão de pets com
  responsável), `/pets` (listagem global com filtros de
  espécie/responsável/status + cadastro/edição), `/servicos`
  (catálogo com busca/preço/duração, escrita só para ADMIN); `/pdv`
  ganha seletor opcional de cliente ("Venda rápida sem cliente" por
  padrão); `/vendas` e detalhe exibem o cliente; home marca "Clientes e
  animais" e "Serviços" como disponíveis (agendamentos separado "Em
  breve"); badge "Etapa 5".
- Testes de integração com PostgreSQL real: 49 novos testes
  (`clients.test.ts` 20, `pets.test.ts` 12, `services.test.ts` 13 e 4 em
  `sales.test.ts`), totalizando **190** — incluem normalização,
  duplicidade 409 vs. homônimos/famílias, permissões MEMBER/ADMIN,
  troca de responsável, isolamento multiempresa e venda com/sem cliente.
- Validação E2E manual: **40/40 verificações** (CRUD de clientes/pets/
  serviços, normalizações, 409 de duplicidade, validações 400, venda com
  cliente, venda rápida sem cliente e páginas 200).

### Regras de negócio registradas

- Cliente duplicado = mesmo nome normalizado **e** mesmo contato ativo;
  nomes iguais sem contato e contatos iguais com nomes diferentes são
  permitidos (famílias/homônimos).
- Leitura de clientes/pets/serviços exige sessão; escrita de clientes e
  pets é operação diária (MEMBER), escrita de serviços é de catálogo
  (ADMIN).
- Vínculo de venda com cliente é opcional e validado no servidor
  (cliente ativo da mesma empresa); PDV continua suportando venda
  rápida sem cliente.
- Pet sempre pertence a um responsável ativo da mesma empresa; troca de
  responsável validada; desativação nunca apaga histórico (vendas
  mantêm o snapshot/`SetNull`).

### Preservado

- Pasta `automação do whatsapp/` intacta; contratos da Etapa 4 (caixa,
  `inCash`, 404 em `current`) inalterados; vendas sem `clientId`
  continuam válidas.

## [Etapa 4] — 2026-10-09

### Adicionado

- Schema Prisma: modelos `CashSession` e `CashMovement` (+ enums
  `CashSessionStatus`, `CashMovementType`, `CashMovementOrigin`), campo
  `Sale.cashSessionId` (FK `SetNull`) e migration
  `20261009212628_etapa4_cash_finance` aplicada em `petflow` e
  `petflow_test`; ledger imutável com único `(origin, saleId)`.
- API NestJS (prefixo `/api`, sob `AuthGuard` global, módulo `cash`):
  - `POST /cash/sessions` e `POST /cash/sessions/:id/close` (ADMIN),
    `GET /cash/sessions/current` (404 sem sessão aberta),
    `GET /cash/sessions`, `GET /cash/sessions/:id/summary`.
  - `POST /cash/movements` (ADMIN) e `GET /cash/movements` (filtros
    período/sessão/tipo/origem + paginação).
  - `POST /cash/movements/:id/reversal` (ADMIN) — estorno auditável.
  - `GET /cash/summary` — resumo financeiro por período/sessão calculado
    no servidor (vendas, manuais, cancelamentos, estornos, entradas,
    saídas, líquido).
- Uma **única sessão aberta por empresa**: abertura serializada com
  `SELECT ... FOR UPDATE` na `Company` (duplicidade → 409); fechamento
  calcula `expected = inicial + Σ(IN inCash) − Σ(OUT inCash)` e
  `difference = contado − expected` no servidor.
- **Vendas e cancelamentos exigem caixa aberto** (409 `"Caixa fechado:
  abra o caixa para ..."`); na mesma transação a venda grava
  `cashSessionId` e cria lançamento `SALE` (`inCash` = venda em
  dinheiro); cancelamento cria lançamento `SALE_CANCELMENT` único.
- Movimentações manuais (`IN`/`OUT`, `origin = MANUAL`, `inCash = true`)
  com sessão aberta; saída exige justificativa (mín. 3).
- Estorno: apenas `MANUAL` não estornado na sessão aberta; cria
  `REVERSAL` do tipo oposto e marca o original (`reversedAt` via
  `updateMany` condicional — duplo estorno → 409); estorno de venda → 400.
- Schemas Zod compartilhados em `@petflow/shared`:
  `openCashSessionSchema`, `closeCashSessionSchema`,
  `createCashMovementSchema`, `reversalCashMovementSchema`,
  `listCashMovementsQuerySchema`, `cashSummaryQuerySchema`, enums e
  labels.
- Frontend: `/caixa` (situação, abertura, movimentações recentes e form
  de entrada/saída), `/caixa/fechar` (saldo esperado vs. contado),
  `/caixa/movimentos` (filtros + estorno com motivo),
  `/caixa/sessoes` (histórico com totais/diferença), `/financeiro`
  (resumo por período); `/pdv` exibe banner "Caixa fechado" e bloqueia a
  finalização; home marca "Caixa e financeiro" como disponível.
- Testes de integração com PostgreSQL real: 37 novos testes
  (`cash.test.ts`), totalizando 141 — incluem integração com vendas
  (`inCash` CASH vs. Pix), cancelamento único, estorno (400/403/409),
  fechamento com diferença, resumo por período, isolamento multiempresa
  e 4 aberturas concorrentes (exatamente 1 sucesso).
- `tests/sales.test.ts` passa a abrir caixa no `beforeAll` (regra nova).
- Validação E2E manual: 30/30 verificações (venda com caixa fechado 409,
  abertura, `inCash` nas duas formas de pagamento, saída sem justificativa
  400, cancelamento único, duplo estorno 409, resumo, fechamento com
  diferença −2.50, duplo fechamento 409, reabertura e páginas 200).

### Regras de negócio registradas

- Uma única sessão de caixa aberta por empresa; vendas, cancelamentos e
  movimentações manuais exigem sessão aberta.
- Saldo esperado e diferença calculados sempre no servidor; data sempre
  do servidor (sem backdating).
- Apenas dinheiro físico (`inCash`) compõe o saldo do caixa; demais
  formas de pagamento entram no resumo financeiro.
- Lançamentos nunca são editados/apagados: estorno cria lançamento
  compensatório com auditoria (autor, data, motivo).

## [Etapa 3] — 2026-10-09

### Adicionado

- Schema Prisma: modelos `Sale` e `SaleItem` (+ enums `PaymentMethod`,
  `SaleStatus`) e migration `20261009205135_etapa3_sales_pdv` aplicada em
  `petflow` e `petflow_test`.
- API NestJS (prefixo `/api`, todos sob `AuthGuard` global):
  - `sales`: `POST /sales` (criação), `GET /sales` (histórico com filtros
    de status, código e período), `GET /sales/:id` (detalhe),
    `POST /sales/:id/cancel` (ADMIN).
- Criação de venda em **transação única**: lock `FOR UPDATE` dos produtos
  em ordem determinística, recálculo de preços/totais com os valores do
  banco (nunca do cliente), gravação da venda + itens (snapshot de nome,
  SKU, unidade, preço e quantidade), baixa de estoque e movimentos `OUT`
  com `reference` = código do comprovante.
- Prevenção de venda duplicada: `clientRequestId` com
  `@@unique([companyId, clientRequestId])` → reenvio/duplo clique
  respondem 409 sem alterar estoque; código de comprovante `PF-XXXXXXXX`
  único por empresa.
- Cancelamento de venda (ADMIN): motivo obrigatório (mín. 3), marca
  `CANCELLED` com autor/data via `updateMany` condicional (segundo
  cancelamento → 409, nunca devolve estoque duas vezes) e devolve o saldo
  com movimentos `IN` compensatórios; venda concluída nunca é apagada.
- Schemas Zod compartilhados em `@petflow/shared`: `createSaleSchema`,
  `createSaleItemSchema`, `cancelSaleSchema`, `listSalesQuerySchema`,
  enums e labels de pagamento/status.
- Frontend: `/pdv` (busca de produtos por nome/SKU/código de barras,
  carrinho com quantidades, desconto, formas de pagamento
  Dinheiro/Cartão/Pix/Outro, finalização com confirmação, comprovante
  imprimível em nova janela), `/vendas` (histórico com filtros de status,
  código e período + paginação), `/vendas/[id]` (detalhe com itens,
  comprovante, cancelamento com motivo e confirmação); home exibe
  "Vendas e PDV" como módulo disponível.
- Testes de integração com PostgreSQL real: 28 novos testes
  (`sales.test.ts`), totalizando 104 — incluem adulteração de totais,
  reenvio idempotente, concorrência, snapshots, cancelamento único e
  isolamento multiempresa.
- Validação E2E manual: 25/25 verificações (venda com desconto
  recalculada, estoque baixado/devolvido, 409 em reenvio e
  recancelamento, páginas `/pdv`, `/vendas` e detalhe).

### Regras de negócio registradas

- Backend sempre recalcula preços e totais; valores enviados pelo frontend
  são ignorados.
- Venda, itens e baixa de estoque em uma única transação; estoque negativo
  nunca é permitido.
- Vendas concluídas são preservadas (cancelamento lógico com auditoria).

## [Etapa 2] — 2026-10-09

### Adicionado

- Schema Prisma: modelos `Category`, `Supplier`, `Product` e `StockMovement`
  (+ enums `RecordStatus`, `ProductUnit`, `StockMovementType`) e migration
  `20261009194843_etapa2_products_stock` aplicada em `petflow` e
  `petflow_test`.
- API NestJS (prefixo `/api`, todos sob `AuthGuard` global):
  - `categories`: `GET /categories`, `GET /categories/:id`,
    `POST`, `PATCH /:id`, `PATCH /:id/status` (escrita: ADMIN).
  - `suppliers`: mesmo padrão de categorias.
  - `products`: `GET /products` (busca por nome/SKU/barcode, filtros por
    categoria/fornecedor/status/estoque baixo, paginação ≤100),
    `GET /products/:id`, `POST`, `PATCH /:id`, `PATCH /:id/status` (escrita:
    ADMIN).
  - `stock`: `POST /stock/entries`, `POST /stock/exits` (autenticados),
    `POST /stock/adjustments` (ADMIN, justificativa obrigatória),
    `GET /stock/balance/:productId`, `GET /stock/movements` (histórico
    paginado), `GET /stock/low-stock` (alertas).
- Saldo **materializado** em `Product.stockQuantity` (Decimal 12,3),
  atualizado na mesma transação do movimento, com lock pessimista
  (`SELECT ... FOR UPDATE`) contra concorrência; histórico imutável
  (sem endpoints de edição/exclusão).
- Schemas Zod compartilhados em `@petflow/shared` (criação/edição de
  catálogo, produto, movimentações e queries com paginação).
- Frontend: `/produtos` (lista com busca, filtros, paginação e alerta de
  estoque baixo), `/produtos/novo`, `/produtos/[id]` (detalhe, saldo,
  histórico e formulários de entrada/saída/ajuste),
  `/produtos/[id]/editar`, `/categorias`, `/fornecedores`; home exibe
  "Produtos e estoque" como módulo disponível.
- Testes de integração com PostgreSQL real: 53 novos testes
  (`catalog.test.ts`, `products.test.ts`, `stock.test.ts`), totalizando
  76 — incluem isolamento multiempresa e concorrência de movimentações.

### Regras de negócio registradas

- Unidades: `UNIDADE`, `KG`, `G`, `L`, `ML`, `CAIXA`, `PACOTE`, `ROLLO`;
  quantidades Decimal(12,3); preços Decimal(12,2) não negativos.
- Saída/ajuste negativo que resultaria em saldo negativo é rejeitado (400).
- Ajustes exigem justificativa (mín. 3 caracteres) e papel ADMIN.
- Alerta de estoque baixo: produto `ACTIVE` com `minimumStock > 0` e
  `stockQuantity <= minimumStock`.
- SKU (maúsculas) e código de barras únicos por empresa quando preenchidos;
  nome de categoria único por empresa (case-insensitive via `nameKey`).
- Categoria/fornecedor de produto validados contra a empresa autenticada;
  recursos de outra empresa respondem 404.

### Preservado

- Pasta `automação do whatsapp/` intacta; proteções da Etapa 1 ativas.

## [Etapa 1] — 2026-10-09

### Adicionado

- Schema Prisma com modelos `Company`, `User` e `Session` (+ enums de status
  e papel) e migration `20261009185907_etapa1_auth_tenancy` aplicada nos
  bancos `petflow` (dev) e `petflow_test` (testes).
- Autenticação por sessão com cookie `HttpOnly` (token aleatório armazenado
  como SHA-256 na tabela `Session`), com expiração e revogação; senha com
  `bcryptjs` (12 rounds).
- Endpoints: `POST /api/auth/login`, `POST /api/auth/logout`,
  `GET /api/auth/me`, `GET|POST /api/users`,
  `PATCH /api/users/:id/status` (admin), `GET /api/health`.
- Guards globais `AuthGuard` + `AdminGuard`, decoradores `@Public`/`@Auth`,
  pipe `ZodValidationPipe` e middleware de verificação de `Origin`.
- Rate limit de login em memória (5 tentativas/15 min por IP+email,
  configurável via `AUTH_RATE_LIMIT_MAX`) e CORS com allowlist `APP_ORIGINS`.
- CLI `npm run bootstrap:admin`: criação idempotente de empresa + primeiro
  administrador via variáveis de ambiente (`BOOTSTRAP_*`).
- Frontend: `/login`, área protegida `/` com usuário/empresa e logout,
  `/usuarios` (listagem/criação/ativação de usuários, admin); proxy
  rewrites do Next (`/api/:path*` → `localhost:3001`).
- Testes de integração reais com PostgreSQL (`petflow_test`): 23 testes
  cobrindo login, sessão, logout, permissões, rate limit, normalização de
  email e isolamento multiempresa.

### Alterado

- Scripts da raiz: `build:shared` antecede `dev:api`, `build`, `typecheck` e
  `test` (evita `packages/shared/dist` desatualizado).
- Prefixo global da API `/api` (health fora do prefixo); `cookie-parser`
  registrado no bootstrap.

### Corrigido

- Injeção de dependência no runtime `tsx` (esbuild não emite
  `emitDecoratorMetadata`): `@Inject()` explícito nos providers com
  construtor injetado.
- Filtro global de exceções não embrulhava mais a resposta duas vezes
  (`message` sempre string; `issues` do Zod preservado).
- Schemas Zod de email fazem `trim`/`toLowerCase` antes da validação.

### Preservado

- Pasta `automação do whatsapp/` intacta; nenhum arquivo da Etapa 0 removido.

### Notas

- Nenhum segredo real em código/Git (`.env` local apenas, não versionado).
- Módulos de negócio permanecem fora do escopo (Etapa 2+).

## [Etapa 0] — 2026-10-09

### Adicionado

- Monorepo com npm workspaces (`apps/*`, `packages/*`).
- `apps/api`: aplicação NestJS mínima com `GET /health` e filtro global de
  exceções.
- `apps/web`: aplicação Next.js mínima com Tailwind CSS, layout de boas-vindas
  e listagem informativa dos módulos planejados (sem funcionalidades).
- `apps/worker`: processo stub de background tasks com heartbeat e shutdown
  gracioso.
- `packages/shared`: pacote com constantes e schemas Zod de base
  (paginação, formato de erro de API).
- `packages/config`: `tsconfig.base.json` compartilhado.
- `database/`: schema Prisma técnico (sem tabelas de negócio), pastas de
  migrations e seeds documentadas.
- `tests/health.test.ts`: testes Vitest + Supertest do health check e do 404
  tratado.
- Documentação: PRD, ARCHITECTURE, DATABASE (diretrizes), DEVELOPMENT,
  CHANGELOG, PROJECT_STATUS, IMPLEMENTATION_CHECKLIST e AGENTS.md.
- Configuração de ESLint 9 (flat config), Vitest e `.env.example`.

### Preservado

- Pasta `automação do whatsapp/` (base existente de automação WhatsApp)
  mantida intacta, sem alterações.
- Documento `PETFLOW — ETAPA 0.txt` (entrada do processo) mantido na raiz.

### Notas

- Nenhum módulo de negócio implementado (regra da Etapa 0).
- Nenhum segredo real presente nos arquivos criados.
