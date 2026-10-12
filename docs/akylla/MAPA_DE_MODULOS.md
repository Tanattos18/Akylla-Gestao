# Akylla Gestão — Mapa de módulos (Etapa 4)

**Data:** 12/10/2026
**Natureza:** análise e documentação exclusivamente. Nenhum código, teste,
schema, migration, dado ou configuração foi alterado; nenhum módulo foi
excluído, ocultado, renomeado ou migrado.
**Estado do Git ao iniciar:** `main` @ `546b178`, working tree limpo.

---

## 1. Escopo, método e critérios

**Objetivo (roteiro, Etapa 4):** separar os recursos comuns de gestão dos
recursos exclusivos de pet shop, classificando **cada módulo** em quatro
categorias:

1. **Núcleo comum do Akylla**
2. **Módulo opcional futuro genérico**
3. **Específico de pet shop**
4. **Obsoleto ou duplicado** (sem exclusão sem aprovação)

**Método:** cada módulo foi conferido **no código real** antes de receber
categoria — inventário completo de 22 controllers, 25 models do Prisma,
38 páginas, 3 componentes e 19 arquivos de teste; leitura dos schemas Zod
(`packages/shared`), guards e relações do schema Prisma; validação de
genericidade por **evidência** (campos, relações e fluxos), não por nome.
São usadas as marcas **[Código]** (confirmado por leitura) e **[Teste]**
(coberto por suíte aprovada — base 436/436 em 12/10/2026).

**Hipótese inicial aprovada (Decisão 1 do proprietário):** núcleo inicial =
empresas/usuários, clientes, fornecedores, produtos/categorias, estoque,
vendas, financeiro básico, dashboard/relatórios, configurações; opcionais
genéricos = agenda, serviços, assinaturas de clientes, WhatsApp; pet shop =
pets, fluxos dependentes de animais, variáveis de lembrete ligadas a pets,
seed Mundo Pet. Cada item abaixo foi validado no código antes de registrar
a decisão definitiva.

---

## 2. Matriz de classificação

**Legenda de categoria:** N = Núcleo comum · O = Opcional futuro genérico ·
P = Específico de pet shop · X = Obsoleto/duplicado.

| # | Módulo | Cat. | Localização (API / UI / Models / Testes) | Evidência e justificativa | Dependências | Destino recomendado |
|---|---|---|---|---|---|---|
| 1 | Autenticação e sessão | **N** | `auth` (5 rotas, `@Public` em login/registro/reset) / `/login`, `/cadastro`, `/redefinir-senha` / `Session`, `User` / `auth`, `register`, `password-reset`, `health` | **[Código]** cookie HttpOnly + hash SHA-256, rate limit por IP, `AuthGuard` global; **[Teste]** 35 testes | Nenhum de nicho | Manter integralmente (identidade interna adiada — decisão Etapa 1) |
| 2 | Empresas e usuários | **N** | `users` (AdminGuard) + `Company` via `auth/me` / `/usuarios` / `Company`, `User` / `users` | **[Código]** papéis ADMIN/MEMBER, escopo por `companyId`; **[Teste]** users + tenancy-audit | Sessão (módulo 1) | Manter; **lacuna:** não existe edição de dados da empresa (ver §7, D1) |
| 3 | Clientes | **N** | `clients` (6 rotas) / `/clientes`, `/clientes/[id]` / `Client` / `clients` | **[Código]** genérico (nome, contatos, CPF opcional, endereço, notas, status); duplicidade por nome+telefone e homônimos; **[Teste]** 20 testes + cross-tenant | Cross-links para pets (módulo 11) | Manter; adaptações de rótulo na Etapa 5 |
| 4 | Fornecedores | **N** | `suppliers` (5 rotas) / `/fornecedores` / `Supplier` / `catalog` | **[Código]** nome/documento/contatos, sem nicho; **[Teste]** catálogo + 403/404 | Produtos (módulo 6) | Manter integralmente |
| 5 | Categorias | **N** | `categories` (5 rotas) / `/categorias` (sem card; atalho em produtos) / `Category` / `catalog` | **[Código]** nome normalizado/único por empresa; **[Teste]** catalog | Produtos | Manter integralmente |
| 6 | Produtos | **N** | `products` (6 rotas) + `ProductForm` / `/produtos` (+novo/[id]/editar) / `Product` / `products` | **[Código]** SKU/barcode únicos por empresa, preço/estoque decimal, unidade genérica; **[Teste]** 19 testes | Categorias, fornecedores, estoque | Manter integralmente |
| 7 | Estoque | **N** | `stock` (entradas/saídas/ajustes/saldo) / `/produtos/[id]` / `StockMovement` / `stock` | **[Código]** saldo recalculado no servidor, transação, histórico imutável, ajuste = ADMIN; **[Teste]** 20 testes | Produtos; vendas (baixa automática) | Manter integralmente |
| 8 | Vendas / PDV | **N** | `sales` (criar/listar/detalhe/cancelar) / `/pdv`, `/vendas`, `/vendas/[id]`, `Receipt` / `Sale`, `SaleItem` / `sales` | **[Código]** recálculo no servidor, snapshot de itens, idempotência (`clientRequestId`), cancelamento auditável; **[Teste]** 30+ testes | Produtos, estoque, caixa, clientes (opcional), assinaturas (origem de pagamento) | Manter integralmente |
| 9 | Caixa (fluxo por turno) | **N** | `cash` (sessões, movimentos, estorno) / `/caixa`, `/caixa/*` / `CashSession`, `CashMovement` / `cash` | **[Código]** abertura/fechamento, IN/OUT, origens MANUAL/SALE/SALE_CANCELMENT/REVERSAL, estorno auditável; **[Teste]** 37 testes | Vendas; assinaturas de clientes (§5) | Manter; é a base do **financeiro básico** (AP/AR novo na Etapa 8) |
| 10 | Financeiro da empresa cliente | **N** (base existente) + **construção futura** | Caixa (acima) + `/financeiro` (relatório de fluxo) / `CashSession`, `CashMovement` / `cash`, `reports` | **[Código]** hoje = apenas caixa por sessão; AP/AR **não existe** (grep `payable\|receivable\|dueDate` = 0 — PLANO §9) **[Teste]** caixa coberto | Caixa; vendas; **futuro:** AP/AR (Etapa 8) | Manter base; criar AP/AR na Etapa 8 com migration autorizada; **nunca** confundir com billing (§5) |
| 11 | Pets | **P** | `pets` (5 rotas) / `/pets` (sem card; atalhos em clientes) / `Pet`, enums `PetSpecies`/`PetSex` / `pets` | **[Código]** domínio exclusivo de animais (espécie/raça/sexo/peso); FK Restrict em `Appointment.petId`; **[Teste]** 12 testes | Clientes; agenda (pet opcional); relatórios/dashboard (módulo 16); seed (módulo 20) | **Não excluir.** Decisão de destino na Etapa 10 (ocultar da navegação comum × flag de segmento) |
| 12 | Agenda (agendamentos) | **O** | `appointments` (6 rotas) + `AppointmentForm` / `/agenda` (+novo/[id]/editar) / `Appointment` / `appointments` | **[Código]** `petId` **opcional** (`schema.prisma` L371) e cliente/serviço/data bastam; serve salões, oficinas, clínicas; conflito por horário; lembrete WhatsApp; **[Teste]** 40+ testes | Clientes; serviços; pets (opcional); WhatsApp (lembretes); relatórios (contagem por status) | Opcional genérico. Adaptações: rótulos; **variável "{{1}} tutor/pet"** do lembrete precisa virar genérica (módulo 17) |
| 13 | Serviços (catálogo) | **O** | `services` (6 rotas) / `/servicos` (card na home) / `Service` / `services` | **[Código]** nome/duração/preço/status — sem qualquer campo de nicho; usado pela agenda; **[Teste]** 13 testes | Agenda | Opcional genérico; rótulo "catálogo de serviços" já aplicado na Etapa 2 |
| 14 | Assinaturas de clientes (recorrência) | **O** | `subscription-plans` + `subscriptions` / `/assinaturas`, `/planos` / `SubscriptionPlan`, `Subscription` / `subscriptions` | **[Código]** cliente + plano + vigência; pagamento gera `CashMovement` na caixa (`registerPayment`, renovação); **sem** campo de pet; **[Teste]** 18 testes | Clientes; caixa (§5); conceptualmente **separado** do billing (§5) | Opcional genérico. Adaptações: rótulos; reforçar separação conceitual (Etapa 11) |
| 15 | Billing SaaS da Akylla | **N** (plataforma) | `billing` (AdminGuard) / `/faturamento` / `TenantPlan`, `TenantSubscription` / `billing` | **[Código]** assinatura **da empresa no SaaS**, não do cliente final; sem CashMovement; **[Teste]** 12 testes | Planos SaaS globais (§5) | Manter como plataforma; enforcement de limites na Etapa 11 |
| 16 | Dashboard e relatórios | **N** | `reports` (7 rotas) / `/dashboard`, `/relatorios` / — (consultas) / `reports` | **[Código]** agregações no servidor com `companyId` (inclusive SQL crudo), CSV protegido; **[Teste]** relatórios + tenancy-audit | Todos os módulos; **dependência de nicho:** indicadores "pets" (módulo 21) | Manter; na Etapa 9 substituir indicadores de nicho por genéricos |
| 17 | WhatsApp (config, templates, consentimentos, mensagens, fila, webhook) | **O** | `whatsapp` (config/consents/messages/templates + webhook `@Public`) / `/whatsapp`, `/whatsapp/mensagens`, `/whatsapp/templates` / `WhatsAppConfig`, `WhatsAppTemplate`, `WhatsAppConsent`, `WhatsAppMessage`, `WhatsAppMessageAttempt`, `WhatsAppWebhookEvent` / `whatsapp` | **[Código]** canal genérico de mensagens opt-in; webhook assinado; worker com fila por tenant; **[Teste]** 46 testes | Agendamentos (lembretes); clientes (consentimento); template de lembrete exige 3 variáveis com rótulo "{{1}} tutor/pet" (módulo 21) | Opcional genérico. Adaptações: generalizar rótulo do lembrete; manter consentimento/privacidade |
| 18 | Configurações | **N** — **parcialmente inexistente** | Sem controller de edição de `Company`; sem página `/configuracoes` / `Company` / `auth`, `users` | **[Código]** só `GET /auth/me` devolve a empresa; nenhum endpoint de atualizar dados da empresa (PLANO §5 já registrava "endpoint de edição de Company (novo)") | Módulo 1 (sessão) | Núcleo comum **a construir** — ver dúvida **D1** (§7) |
| 19 | Infraestrutura/qualidade | **N** | `health`, helpers de teste, `tests/*`, seeds de teste / `/health` / — / 19 arquivos | **[Código]/[Teste]** suíte 436/436 | Nenhum | Manter; estender a AP/AR |
| 20 | Seed demonstrativo "Mundo Pet" | **P** | `apps/api/src/cli/seed-demo.ts` (npm `db:seed:demo`) / — / popula todos os modelos / — | **[Código]** dados de demonstração exclusivos de pet shop | Todos os módulos | Reescrever com dados de comércio variado (etapa futura, com aprovação) |
| 21 | Elementos de nicho transversais | **P** | Lembrete "{{1}} tutor/pet" (`whatsapp-config.service.ts` L86-88, `appointments.service.ts` `syncReminder`); indicadores `newPets`/`petsBySpecies` (`reports.service.ts` L105/155/670-689; `dashboard` "pet(s) cadastrado(s)" L295-297; `relatorios` L872-908) / UI dashboard+relatórios / `Pet` / `reports`, `appointments`, `whatsapp` | **[Código]** dependências reais de pets fora do módulo pets; **[Teste]** reports/appointments/whatsapp | Módulos 11, 12, 16, 17 | Generalizar na Etapa 9 (indicadores) e Etapa 10 (lembrete); **não** alterar agora |
| 22 | Pasta legada `automação do whatsapp/` | — (fora do monorepo) | raiz / — / nenhum / — | **[Código]** não participa de lint/build/testes do monorepo | Nenhuma | **Preservada intocada permanentemente** (regra permanente) |
| 23 | Obsoleto ou duplicado | **Nenhum identificado** | — / — / — / — | Varredura de controllers/páginas/models: sem módulo duplicado nem órfão (o badge "Etapa 9" da UI foi removido na Etapa 2) | — | Nada a fazer |

---

## 3. Núcleo comum — consolidação

**Presente e validado no código:** empresas/usuários (2), clientes (3),
fornecedores (4), produtos (6) e categorias (5), estoque (7), vendas (8),
financeiro básico = caixa + futuros AP/AR (9-10), dashboard/relatórios (16),
autenticação/infraestrutura (1, 19) e billing da plataforma (15, anexo à
plataforma).

**Pendente de construção:** **configurações da empresa** (18) — ver D1.

## 4. Opcionais futuros genéricos — validação e adaptações

Todos confirmados **[Código]** como utilizáveis em outros segmentos:

| Módulo | Prova de genericidade | Adaptação necessária |
|---|---|---|
| Agenda (12) | `petId` opcional; fluxo cliente×serviço×horário | Rótulos; lembrete com variável de pet generalizada |
| Serviços (13) | sem campos de nicho | Nenhuma além de rótulo (já aplicado) |
| Assinaturas de clientes (14) | `Client`+`SubscriptionPlan`, pagamento → caixa | Rótulos; separação conceitual do billing (Etapa 11) |
| WhatsApp (17) | canal opt-in genérico, webhook assinado, fila por tenant | Rótulo "{{1}} tutor/pet" do template de lembrete |

Ativação/exibição inicial: a navegação (home `plannedModules`,
`page.tsx` L9) **já exibe** Serviços, Agenda, Assinaturas e WhatsApp —
manter nesta etapa; eventual ocultação/flag é decisão da Etapa 10 (§6).

## 5. Faturamento SaaS da Akylla × financeiro da empresa cliente

| Aspecto | Billing SaaS (Akylla) | Financeiro do cliente |
|---|---|---|
| Models | `TenantPlan`, `TenantSubscription` | `CashSession`, `CashMovement`, `SubscriptionPlan`/`Subscription` (futuro: AP/AR) |
| API/UI | `billing` · `/faturamento` | `cash`, `subscriptions` · `/caixa/*`, `/financeiro`, `/assinaturas`, `/planos`, `/pdv` |
| Quem paga | A **empresa** (tenant) paga à Akylla | Os **clientes finais** pagam à empresa |
| Dinheiro | **Não** gera `CashMovement`; sem gateway | Gera `CashMovement` na sessão de caixa aberta (criação com `registerPayment`, renovação) |
| Global/tenant | `TenantPlan` é catálogo global (comportamento intencional, AUDITORIA C2) | 100% escopado por `companyId` |
| Testes | `billing.test.ts` (12) | `cash` (37), `subscriptions` (18) |
| Próxima etapa | Enforcement de limites — **Etapa 11** | AP/AR — **Etapa 8** |

Conceitualmente separados desde a decisão 7 da Etapa 1; **nenhuma
mistura** foi encontrada no código **[Código]**.

## 6. Decisões futuras registradas (sem implementação)

### 6.1 Navegação
- Hoje: grade de cards da home (`plannedModules`, `apps/web/src/app/page.tsx`
  L9: Produtos, PDV, Caixa, Clientes, Serviços, WhatsApp, Dashboard,
  Relatórios, Agenda, Assinaturas, Faturamento) + links internos
  (categorias, fornecedores, usuários, pets).
- Futuro (PLANO §8, decisão da **Etapa 10**): navegação agrupada por área
  derivada de lista de módulos; **ocultação na UI não é controle de
  acesso** — o backend já isola por tenant/guards (Etapa 3) e qualquer
  bloqueio de módulo desabilitado deve ser feito no servidor.

### 6.2 Destino dos módulos de pet shop (Etapa 10)

**Etapa 10 executada e decidida:** plano de modularização em
`docs/akylla/PLANO_MODULARIZACAO.md`; **D2 confirmada pelo proprietário
(2026-10-12)** — nenhuma exclusão; pets permanece como módulo opcional de
nicho fora da navegação inicial; agenda/serviços/WhatsApp/assinaturas
reutilizados como genéricos; o rótulo "{{1}} tutor/pet" do lembrete foi
generalizado para "{{1}} cliente" (API + UI, sem mudança de
comportamento); seed "Mundo Pet" reescrito apenas em etapa futura com
aprovação explícita.

### 6.3 Ativação por segmento — opções, dependências e impacto (Decisão 2: somente documentar)

| Opção | Descrição | Impacto de schema (futuro, exige autorização) | Dependências |
|---|---|---|---|
| A | Campo em `Company` (ex.: lista/json de módulos ativos) | 1 migration aditiva (coluna nullable/default) | Guard por módulo no backend; navegação derivada |
| B | Tabela `CompanyModule` (`companyId` + módulo + status) | 1 migration aditiva + model novo + índices | Idem; mais extensível (histórico/futuros planos) |
| C | Derivar dos limites do `TenantSubscription` (campos de plano) | Depende do modelo da **Etapa 11** (pode não exigir tabela nova) | Acopla módulos ao billing; enforcement no backend |

**Decisão (2026-10-12): opção B — IMPLEMENTADA na própria Etapa 10 com
autorização do proprietário.** Migration aditiva
`20261012154010_company_module` (enums `BusinessModule` e
`CompanyModuleStatus` + tabela `CompanyModule`); `ModuleGuard` bloqueia
rotas de módulos `DISABLED` com 403 no servidor; API
`GET`/`PATCH /api/company-modules`; home oculta cards de módulos
desativados. Detalhes e pendências em `PLANO_MODULARIZACAO.md` §4.

## 7. Dúvidas remanescentes e decisões que dependem do proprietário

| # | Questão | Situação |
|---|---|---|
| **D1** | **"Configurações" do núcleo inicial não existe como módulo** (sem endpoint/página de edição de `Company`). Classificado como núcleo comum **a construir**. Em qual etapa construir? Candidatas: Etapa 5 (cadastros) ou etapa própria posterior | **Aguardando decisão** |
| **D2** | Destino final de pets/lembrete-pet/seed → **Etapa 10** | **CONFIRMADA (2026-10-12)** — recomendações do PLANO §3 aceitas; nenhuma exclusão; lembrete generalizado |
| **D3** | Mecanismo de ativação por segmento → **Etapa 10** (opções em §6.3) | **DECIDIDA (2026-10-12): opção B (`CompanyModule`)** — implementada na Etapa 10 (migration aditiva + guard + API + home) |
| **D4** | Classificação de agenda/serviços/assinaturas/WhatsApp como **opcionais genéricos** mantém ambos os documentos (roteiro item 3 × PLANO §5) coerentes — confirmar a leitura na aprovação desta matriz | **Aguardando aprovação** |
| Nenhum módulo precisou ser marcado **inconclusivo**: todos receberam categoria com evidência de código. |

## 8. Inventário completo × matriz (conferência)

- **22/22 controllers considerados:** appointments, auth, billing, cash,
  categories, clients, health, pets, products, reports, sales, services,
  stock, subscription-plans, subscriptions, suppliers, users,
  whatsapp/config, whatsapp/consents, whatsapp/messages,
  whatsapp/templates, webhooks → itens 1-19 da matriz.
- **25/25 models considerados:** Company, User, Session, Category,
  Supplier, Client, Pet, Service, Appointment, Product, StockMovement,
  Sale, SaleItem, CashSession, CashMovement, SubscriptionPlan,
  Subscription, TenantPlan, TenantSubscription, WhatsAppConfig,
  WhatsAppTemplate, WhatsAppConsent, WhatsAppMessage,
  WhatsAppMessageAttempt, WhatsAppWebhookEvent → itens 1-21.
- **38/38 páginas consideradas:** home, agenda (4), assinaturas (3),
  cadastro, caixa (4), categorias, clientes (2), dashboard, faturamento,
  financeiro, fornecedores, login, pdv, pets, planos, produtos (4),
  redefinir-senha, relatorios, servicos, usuarios, vendas (2),
  whatsapp (4).
- **3/3 componentes:** AppointmentForm (agenda), ProductForm (produtos),
  Receipt (vendas).
- **19/19 arquivos de teste** mapeados por módulo (coluna "Testes").

## 9. Validações executadas (evidência de que nada mudou)

| Comando | Resultado |
|---|---|
| `git status` (após as edições de documentação) | apenas arquivos de doc alterados/criados — nenhum de código |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | **436/436 aprovados** (sem alteração em relação à Etapa 3) |

Banco/migrations: **nenhuma alteração**. Dependências: **nenhuma**.
Identificadores internos e pasta legada: **intocados**.
