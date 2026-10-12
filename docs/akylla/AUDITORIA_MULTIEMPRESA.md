# Akylla Gestão — Auditoria de isolamento multiempresa e permissões (Etapa 3)

**Data:** 12/10/2026
**Natureza:** auditoria e evidência — nenhuma correção, regra de negócio,
migration, schema ou interface foi alterado nesta etapa.
**Ambiente:** exclusivamente `petflow_test` (dados sintéticos); nenhum dado
real de clientes e nenhum teste contra produção.

---

## 1. Escopo e metodologia

**Objetivo:** verificar com evidências — não por suposição — se o isolamento
entre empresas (tenants) e as permissões por perfil (ADMIN/MEMBER) são
aplicados de ponta a ponta na API.

**Método (4 frentes):**

1. **Inspeção de implementação** de todos os controllers/services de
   negócio: de onde vem `companyId`, como são feitas leituras/escritas por
   ID, como são validadas referências entre recursos.
2. **Varredura estática por padrões perigosos** em `apps/api/src/**/*.service.ts`:
   - `findUnique`/`findFirst` por `id` **sem** `companyId` na janela;
   - `update`/`delete`/`updateMany`/`upsert` cujo `where` não derivava de
     registro já escopado;
   - `count`/`aggregate` e **SQL crudo** (`$queryRaw`) sem `companyId`;
   - `console.*`/`logger.*` que pudessem logar dados de tenant.
3. **Cenários HTTP reais** (supertest) contra a aplicação Nest completa com
   Prisma real (nada mockado), com **Empresa Alfa (A)** × **Empresa Bravo
   (B)**, cada uma com usuários e registros próprios, cobrindo injeção de
   `companyId`, leitura/escrita cruzada, relações, listagens, relatórios,
   CSV e perfis.
4. **Reuso dos cenários já existentes** na suíte (vários módulos já possuíam
   testes cross-tenant); estes são citados por arquivo:linha na matriz.

**Critérios de classificação:** falha de isolamento · falha de autorização
por perfil · comportamento intencional · inconclusivo.

## 2. Recursos e rotas examinadas

- **22 controllers / ~107 rotas** sob `prefix /api`:
  `appointments` (6), `auth` (5), `billing` (5), `cash` (9), `categories` (5),
  `clients` (6), `health` (1), `pets` (5), `products` (6), `reports` (7),
  `sales` (4), `services` (6), `stock` (6), `subscription-plans` (5),
  `subscriptions` (5), `suppliers` (5), `users` (3), `whatsapp/config` (4),
  `whatsapp/consents` (3), `whatsapp/messages` (4), `whatsapp/templates` (5),
  `webhooks` (2).
- **Guards:** `AuthGuard` **global** via `APP_GUARD`
  (`apps/api/src/app.module.ts:44`); `@Public()` apenas em `/health`,
  `POST auth/login`, `POST auth/register`, `POST auth/reset-password` e nos
  2 endpoints de webhook. `AdminGuard` aplicado em **38 endpoints de
  escrita**.
- **Identificação do tenant:** `request.auth.companyId` é preenchido
  **exclusivamente** a partir da sessão no banco (`AuthGuard`,
  `apps/api/src/common/guards/auth.guard.ts:59`); nenhum controller lê
  `companyId` de corpo, query, rota ou cabeçalho.
- **Schemas Zod** não usam `.strict()` → chaves desconhecidas (ex.:
  `companyId` enviado pelo cliente) são **removidas** antes do serviço.
- **Worker** (`apps/worker/src/whatsapp/processor.ts`): fila global de
  mensagens (infraestrutura de backend), mas toda resolução de dados usa
  `message.companyId` (L104) — escopo por tenant mantido.
- **Log:** a API não tem `console.log` de dados em runtime (apenas CLI de
  bootstrap/seed); `AllExceptionsFilter` só registra ≥500 com stack (sem
  bodies de requisição); o único `logger.warn` (appointments L519) loga
  somente ID + mensagem de erro.

## 3. Matriz de Empresa A × Empresa B

**Legenda:** ✔ = comportamento correto verificado nesta etapa
(`tests/tenancy-audit.test.ts`) · ✔(ex) = correto, evidência reaproveitada
de teste existente (arquivo:linha) · — = não aplicável.

### 3.1 Identificação e injeção de tenant

| Cenário (origem → operação) | Resultado | Evidência |
|---|---|---|
| A → `GET /auth/me` com `?companyId=B` e header `x-company-id: B` | 200, empresa A | tenancy-audit |
| A → `POST /categories`, `/clients`, `/users`, `/sales` com `companyId=B` no **corpo** | 201 e registro criado em **A** (prisma confirma) | tenancy-audit |
| A → listagens `?companyId=B` (clients, categories) | dados apenas de A | tenancy-audit |
| A → listagem com header `x-company-id: B` | dados apenas de A | tenancy-audit |
| A → `GET /reports/summary?companyId=B` | ignora parâmetro, dados de A | reports.test.ts:717,725 ✔(ex) |
| A → sem sessão | 401 | tenancy-audit ✔(ex) auth.test.ts |

### 3.2 Leitura cruzada por ID (A lê B)

| Recurso | Esperado | Evidência |
|---|---|---|
| categorias | 404 | tenancy-audit; catalog.test.ts:175 ✔(ex) |
| fornecedores | 404 | tenancy-audit; catalog.test.ts ✔(ex) |
| produtos | 404 | tenancy-audit; products.test.ts:272 ✔(ex) |
| clientes | 404 | tenancy-audit; clients.test.ts:257 ✔(ex) |
| `/clients/:id/pets` | 404 | tenancy-audit; clients.test.ts:362 ✔(ex) |
| pets | 404 | tenancy-audit; pets.test.ts:249 ✔(ex) |
| serviços | 404 | tenancy-audit; services.test.ts:207 ✔(ex) |
| agendamentos | 404 | tenancy-audit; appointments.test.ts:563 ✔(ex) |
| vendas (detalhe) | 404 | tenancy-audit; sales.test.ts:639 ✔(ex) |
| planos de assinatura | 404 | tenancy-audit; subscriptions.test.ts:235 ✔(ex) |
| assinaturas | 404 | tenancy-audit; subscriptions.test.ts:401 ✔(ex) |
| templates de WhatsApp | 404 | tenancy-audit |
| sessão de caixa (resumo) | 404 | tenancy-audit; cash.test.ts:539 ✔(ex) |
| saldo de produto | 404 | tenancy-audit; stock.test.ts:332 ✔(ex) |
| consentimento de WhatsApp | 200 sem dados (ver §7.3) | tenancy-audit; whatsapp.test.ts:611 ✔(ex) |
| mensagem de WhatsApp (detalhe) | 404 | whatsapp.test.ts:829 ✔(ex) |
| usuário (alterar status) | 404 | users.test.ts:196 ✔(ex) |
| **Simetria** B lê A (clientes, produtos) | 404 | tenancy-audit; sales.test.ts:553 ✔(ex) |

### 3.3 Escrita cruzada (A altera B) — todos 404 **e nada muda no banco**

| Operação | Evidência |
|---|---|
| `PATCH /categories/:id` e `/:id/status` | tenancy-audit (nome/status de B inalterados) |
| `PATCH /suppliers/:id` | catalog.test.ts:240 ✔(ex) |
| `PATCH /products/:id` e status | products.test.ts:263 ✔(ex) |
| `PATCH /services/:id` e `/:id/status` | tenancy-audit (inalterado) |
| `PATCH /clients/:id` e `/:id/status` | tenancy-audit (inalterado) |
| `PATCH /pets/:id/status`; troca de responsável | tenancy-audit; pets.test.ts:269 ✔(ex) |
| `PATCH /appointments/:id`, `/:id/status`, `POST :id/cancel` | tenancy-audit (status/horário de B inalterados) |
| `PATCH /subscription-plans/:id` e status | tenancy-audit (inalterado) |
| `POST /subscriptions/:id/renew` e `:id/cancel` | tenancy-audit (assinatura de B ACTIVE, renewalCount 0) |
| `POST /stock/exits` e `/adjustments` (produto de B) | tenancy-audit (estoque de B "5.000" inalterado) |
| `POST /stock/entries` (produto de B) | stock.test.ts:320 ✔(ex) |
| `POST /sales/:id/cancel` (venda de B) | sales.test.ts:647 ✔(ex) |
| caixa: resumo/fechar/movimentações/estorno de B | cash.test.ts:525-578 ✔(ex) |
| `PUT /whatsapp/consents/:clientId` de B → 404, nenhum registro criado | tenancy-audit; whatsapp.test.ts:611 ✔(ex) |
| `PATCH /whatsapp/templates/:id` de B | tenancy-audit (inalterado) |
| criação/envio/cancelamento de mensagem contra cliente/template de B | whatsapp.test.ts:671,464 ✔(ex) |
| config/status/health do WhatsApp de B | whatsapp.test.ts:352,384 ✔(ex) |
| billing: `PUT/renovar/cancelar` assinatura SaaS | billing.test.ts:186,118,260 ✔(ex) |
| usuários: criar/editar em/da outra empresa | users.test.ts ✔(ex) + injeção (§3.1) |

### 3.4 Referências (FK) cruzadas em criação — rejeitadas

| Operação (A cria com FK de B) | Resultado | Evidência |
|---|---|---|
| agendamento com `clientId` de B | 400 "Cliente não encontrado" | tenancy-audit |
| agendamento com `serviceId` de B | 400 "Serviço não encontrado" | tenancy-audit |
| agendamento com `petId` de B | 400 "Pet não encontrado" | tenancy-audit |
| produto com categoria/fornecedor de B | 400 | products.test.ts:166,176 ✔(ex) |
| venda com cliente de B / produto de B | 400 / 404 | sales.test.ts:707,291 ✔(ex) |
| pet com responsável de B | 400 | pets.test.ts:152 ✔(ex) |
| assinatura com plano/cliente de B | 404 | subscriptions.test.ts:300 ✔(ex) |
| mensagem com cliente de B | 404 | whatsapp.test.ts:671 ✔(ex) |
| entrada de estoque com produto de B | 404 | stock.test.ts:320 ✔(ex) |

### 3.5 Listagens, relatórios e exportações

| Cenário | Resultado | Evidência |
|---|---|---|
| resumo: A conta só vendas de A (2) / B só as de B (1) | ✔ | tenancy-audit; reports.test.ts:725 ✔(ex) |
| CSV de vendas de A: não contém código nem produto de B | ✔ | tenancy-audit (PF-AUDB01 e "Produto Sigiloso B" ausentes) |
| relatório de clientes: A não conta cliente criado hoje em B | ✔ | tenancy-audit (newClients=2, não 3) |
| listagens JSON, contagens, caixa, whatsapp | ✔ | reports.test.ts:807,923,982,1021,1080 ✔(ex) |
| procura por `receiptCode` de B vinda de A | vazia (único por empresa: `companyId+receiptCode`) | sales.test.ts ✔(ex) + inspeção |

### 3.6 Vazamento em erros, respostas e logs

| Verificação | Resultado |
|---|---|
| 6 respostas de negação cruzada (404/400) sem nomes, `companyId` ou dados de B | ✔ tenancy-audit (sec. 8) |
| Mensagens de erro são genéricas ("… não encontrado", "… ou de outra empresa") | inspeção + testes |
| Filtro de exceções não loga corpos; API sem `console.log` de dados; `logger.warn` só com ID | inspeção (§2) |
| Erros 500 (se ocorressem) só com stack interno, sem dados de tenant | inspeção do filtro |

## 4. Permissões e perfis identificados

**Perfis reais existentes (não inventados):** `ADMIN` e `MEMBER` por
empresa (`User.role`), verificados por `AdminGuard` (que também exige
sessão autenticada) + `AuthGuard` global.

| Política | Endpoints | Comportamento |
|---|---|---|
| **Somente ADMIN** (38 endpoints) | categorias/fornecedores/produtos/serviços CRUD+status; planos de assinatura CRUD+status; criação/renovação/cancelamento de assinaturas; usuários (todos); billing `PUT/renew/cancel`; caixa (abrir, fechar, movimentações, estorno); **somente** `stock/adjustments`; cancelar venda; WhatsApp config `PUT/health/status`, mensagens `POST/cancel`, templates `POST/PATCH/status` | MEMBER → **403** verificado (novo: category PATCH e product PATCH em tenancy-audit; existentes: catalog:127,207, products:192, cash:126,209,312, billing:118,260, users:124,191,218, stock:248, sales:575, subscriptions:184,271,329,505, whatsapp:332,367,476,539,586, services:124,238) |
| **MEMBER pode (intencional)** | clientes (CRUD), pets (CRUD), agenda (CRUD) — comentário explícito no controller (`appointments.controller.ts:29-33`); criar venda (PDV); `stock/entries` e `stock/exits`; todas as leituras da própria empresa; consentimento `OPTED_OUT` | verificado: criação de cliente e venda por MEMBER (tenancy-audit + clients:149, sales:203+); MEMBER segue sujeito ao isolamento (tenancy: leitura de B → 404) |
| **Regra interna** | `PUT consents` com `OPTED_IN` exige ADMIN dentro do serviço (`whatsapp-consents.service.ts:94-96`) — decisão de compliance registrada em comentário | comportamento intencional |
| **Públicas** (6) | `/health`, login, registro, reset de senha, 2 webhooks (assinatura `x-hub-signature-256`) | comportamento intencional |

**Conclusão por perfil:** nenhuma falha de autorização por perfil
encontrada — todas as rotas com `AdminGuard` retornam 403 para MEMBER e
todas as rotas sem guard têm comportamento documentado e intencional.

## 5. Testes executados e resultados

- **Novo:** `tests/tenancy-audit.test.ts` — **56 cenários** nomeados
  Empresa Alfa × Empresa Bravo em 8 blocos (identificação, injeção,
  leitura cruzada, escrita cruzada, referências, relatórios/CSV, perfis,
  vazamento em erros). Exercitam o backend real (app Nest + Prisma em
  `petflow_test`), sem mocks de comportamento.
- **Suíte completa (19 arquivos): 436/436 aprovados** — linha de base de
  **380/380** (Etapa 1/2) mantida integralmente + 56 novos = 436.
  **Nenhum teste existente foi alterado ou removido nesta etapa** (a única
  alteração em testes das Etapas 1-2 foi o prefixo de CSV em
  `reports.test.ts`, já aprovada na Etapa 2).
- Cobertura da matriz: todos os **14 grupos de recursos de negócio**
  possuem pelo menos uma verificação cross-tenant (novo ou citado).

## 6. Evidências de isolamento confirmado

1. **`companyId` só da sessão:** `AuthGuard` popula `request.auth.companyId`
   a partir do banco; injeção por corpo/query/cabeçalho provadamente
   ignorada (criações caem na própria empresa; listagens não mudam).
2. **Leitura por ID** sempre `findFirst({ id, companyId })` → 404 — matriz
   §3.2 completa (18 recursos).
3. **Escrita por ID** sempre segue registro já escopado; verificação
   **pós-condição no banco** (nome, status, estoque, datas inalterados) —
   matriz §3.3.
4. **Referências** entre recursos validadas contra `companyId` no servidor
   (§3.4) — nenhum cascade cross-tenant.
5. **Transações:** vendas/caixa/assinaturas usam `$transaction` com
   locks (`lockOpenCashSession`) já escopados por `companyId`.
6. **Relatórios/SQL crudo:** todos os `$queryRaw` filtram
   `WHERE "companyId" = ${companyId}` (reports.service L124/152/382);
   agregações e contagens com `companyId` no `where`.
7. **Exportações:** CSV gerado a partir das mesmas queries escopadas;
   ausência de dados de B verificada por conteúdo.
8. **Erros:** respostas 4xx cross-tenant não contêm dados de B (teste 8);
   filtro não vaza stack em 4xx.
9. **Worker:** resolve tenant pela própria fila (`message.companyId`),
   não aceita tenant de entrada externa.

## 7. Falhas confirmadas, hipóteses e comportamentos intencionais

### 7.1 Falhas confirmadas

**Nenhuma.** Nenhuma falha de isolamento entre empresas e nenhuma falha de
autorização por perfil foi confirmada nesta etapa.

### 7.2 Hipóteses / pontos de atenção (não são vazamentos)

| # | Ponto | Situação |
|---|---|---|
| H1 | Cadastro aberto (`/register`) cria empresa + ADMIN sem verificação de e-mail | Comportamento conhecido, pendência registrada na **Etapa 1** (anti-abuso). Um atacante cria *o próprio* tenant — não há acesso a tenants alheios; fora do escopo desta auditoria. |
| H2 | `POST auth/register` valida e-mail como globalmente único (sem `companyId`) | Intencional no cadastro público; não retorna dados de terceiros. |
| H3 | Worker é uma fila global multi-tenant | Comportamento intencional de infraestrutura; dados resolvidos por `message.companyId`. |

### 7.3 Comportamento intencional (documentado, decisão registrada)

| # | Comportamento | Justificativa |
|---|---|---|
| C1 | `GET /whatsapp/consents/:clientId` cross-tenant retorna **200 com corpo vazio** em vez de 404 (único recurso com esse formato; teste existente `whatsapp.test.ts:621` fixa esse contrato) | Sem vazamento de dados. Inconsistência de API menor — padronizar para 404 é decisão de produto, não correção de segurança. |
| C2 | `GET /billing/plans` é global (catálogo de planos SaaS compartilhado entre tenants) | `TenantPlan` é catálogo do próprio SaaS, não dado de tenant. |
| C3 | MEMBER escreve clientes/pets/agenda/vendas/estoque (entrada/saída) | Operação diária documentada no diagnóstico e em comentário do controller; ADMIN guarda catálogo, dinheiro, usuários e ajustes. |
| C4 | `OPTED_IN` de consentimento exige ADMIN (checagem no serviço) | Compliance/privacidade (comentário em `whatsapp-consents.service.ts:87-92`). |

## 8. Recursos sem cobertura total (auditoria não examinou a fundo)

Não afirmo cobertura completa. Itens **não examinados ou só citados**:

1. **Webhook público do WhatsApp** (2 rotas): assinatura e resolução de
   tenant pelo provedor foram cobertas pelos testes existentes
   (`whatsapp.test.ts`), mas **não** fiz fuzzing de assinaturas/ payloads
   (escopo de segurança de integração, não de tenancy).
2. **`origin-check.middleware`** (allowlist de origem): inspecionado, não
   exercitado com requisições de origem inválida.
3. **Rate limiting** de login/reset (in-memory): verificado na Etapa 1,
   fora do escopo desta auditoria.
4. **Camada de dados** (Postgres): grants/RLS por `companyId` no banco
   **não existem** — o isolamento é aplicado pela aplicação. Um acesso
   direto ao banco (com credenciais) não é contido por tenant (risco
   aceito: backend é o único cliente do banco).
5. **Frontend (`apps/web`)**: não testado (a autorização pede acesso
   direto à API; a UI nunca é fronteira de segurança).
6. **Seed de demonstração e CLI**: fora de escopo (dados de demonstração).

## 9. Riscos classificados por gravidade

| Gravidade | Risco | Status |
|---|---|---|
| **Alta** | Vazamento ou alteração cross-tenant nos recursos de negócio | **Não observado** — matriz §3 completa sem falhas |
| **Alta** | Escrita MEMBER em rotas ADMIN | **Não observado** — 38 endpoints verificados |
| **Média** | Isolamento só na aplicação (sem RLS no banco); comprometimento da API = acesso total | Aceito, documentado (§8.4); recomendação R4 |
| **Média** | Cadastro aberto sem verificação de e-mail / anti-abuso (H1) | Pendência da Etapa 1, fora desta auditoria |
| **Baixa** | Inconsistência 200-vs-404 em consentimento (C1) | Comportamento intencional; padronização opcional (R3) |
| **Baixa** | Dívida técnica de identidade interna (`@petflow/*`, `petflow_session`) | Pendência já registrada (Etapa 1/2) |
| **Baixa** | 8 vulnerabilidades `npm audit` (2 críticas em ferramentas de dev) | Pendência da Etapa 1 (R6) |

## 10. Recomendações priorizadas (nenhuma implementada)

| # | Recomendação | Prioridade |
|---|---|---|
| R1 | Manter o padrão `findFirst/findMany({..., companyId })` + validação de FK como **regra de revisão obrigatória** para novos recursos (checklist na Etapa 10 de arquitetura) | Alta (processo) |
| R2 | Adicionar teste de regressão cross-tenant **por novo recurso** (modelo: `tests/tenancy-audit.test.ts`) | Alta (processo) |
| R3 | Padronizar `GET` de consentimento cross-tenant para 404, se o produto desejar consistência (mudança mínima + atualizar `whatsapp.test.ts:621` com autorização) | Baixa |
| R4 | Avaliar RLS/`SET app.company_id` no Postgres como defesa em profundidade (etapa futura, com migration autorizada) | Média |
| R5 | Fechar pendências da Etapa 1: verificação de e-mail, rate limit distribuído, backups | Média |
| R6 | Atualizar dependências vulneráveis (`npm audit`) com janela de regressão | Média |

## 11. Comandos executados e resultado da suíte

| Comando | Resultado |
|---|---|
| `npx vitest run tests/tenancy-audit.test.ts` | **56/56 aprovados** (primeira execução: 1 erro de seed — `endAt` obrigatório em `Appointment` — corrigido no próprio teste; sem tocar em código de produção) |
| `npm test` | **436/436 aprovados**, 19 arquivos, 72,6 s (base 380 + 56 novos; nenhum existente falhou) |
| `npm run lint` | exit 0, 0 erros |
| `npm run typecheck` | exit 0 (5 workspaces) |
| `npm run build` | exit 0 |
| Varredura estática (seção 1, frente 2) | nenhum `findUnique`/`findFirst`/mutação por `id` sem escopo de tenant fora de fluxos com registro pré-escopado; nenhum `$queryRaw` sem `companyId`; nenhum log de dados na API |

## 12. Limitações da auditoria

- Testada apenas a **API** (única fronteira real); a UI não foi exercitada.
- Não houve exploração destrutiva, fuzzing de webhook, ataques de
  força bruta/DoS, nem teste contra produção.
- O banco não possui RLS — conclusões valem para a **aplicação como
  fronteira** (§8.4).
- Pontos citados apenas por referência a testes existentes (§3) foram
  **reutilizados**, não reescritos; a suíte inteira foi reexecutada e
  está verde (436/436), garantindo que essas evidências permanecem vivas.
- Itens da seção 8 permanecem fora do alcance desta etapa; **não** há
  garantia de cobertura sobre eles.
