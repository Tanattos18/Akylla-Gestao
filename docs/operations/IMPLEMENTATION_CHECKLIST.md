# Checklist geral de implementação — Akylla Gestão

> Roteiro: `docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md` (Etapas 0–12).
> Este checklist cobre apenas a era do Akylla Gestão. O histórico
> anterior à adaptação está preservado no Git.

## Fora do roteiro — Catálogo de melhorias e pasta de backup (2026-10-14)

Terceira entrega única autorizada pelo proprietário. Nenhum código de
aplicação alterado; nenhuma ideia executada — este checklist **só
registra** a criação da base de decisão.

- [x] `upgrade/MELHORIAS.md` — 29 ideias (backend, segurança, operação,
      infra, produto), cada uma com função, impacto real no projeto,
      ponto de partida e prioridade P0–P3 + tabela-resumo + sequência
- [x] `upgrade/MELHORIAS_DESIGN.md` — catálogo de design (tokens,
      componentes, movimento, a11y, responsividade, estados, dados,
      impressão) com regras de ouro
- [x] 7 débitos medidos no frontend e documentados (D-1 a D-7),
      incluindo contraste reprovado em 3 pares de cor (medido com
      razão WCAG) e 32 tabelas inline
- [x] `backup/README.md` — estrutura, comandos de dump/restore, drill
      obrigatório e regra de não versionar dados sensíveis
- [x] `.gitignore`: `/backup/*` ignorado com exceção do README;
      comportamento verificado com dump simulado
- [x] `docs/README.md` indexando as duas pastas; `MELHORIAS.md` com
      linha de escopo apontando o catálogo de design
- [x] 33 arquivos `.md` / 60 links relativos verificados (0 quebrados)
      e UTF-8 validado nos arquivos novos

## Fora do roteiro — Reorganização estrutural (2026-10-14)

Tarefa autorizada pelo proprietário como entrega única.

- [x] Reverter `automação do whatsapp/README.md` (alterado sem
      autorização; regra 12 do AGENTS.md)
- [x] Corrigir imports dos 24 arquivos de `tests/integration/`
      (`../helpers/app`, `../../apps/...` — 53 imports quebrados pela
      migração anterior)
- [x] `config/` versionado (ESLint + Vitest); scripts da raiz apontam
      via `--config`
- [x] `scripts/` versionados (`setup:dev`, `db`, `validate`) + 3 scripts
      novos no `package.json`
- [x] `.github/` versionado: `ci.yml`, `cd.yml` (com `needs: [ci]`
      inválido corrigido) e `dependabot.yml`
- [x] `.env.local.example` removido (redundante); `.gitignore` cobre
      `.env.*` com exceção de `.env.example`
- [x] Pastas vazias `tests/e2e`, `tests/fixtures`, `tests/unit` removidas
- [x] API: `@petflow/whatsapp` declarado; `login-rate-limit.ts`;
      `common/utils/client-name-key.ts`; `src/tenant-limits/`;
      `node:crypto` padronizado; `MockMercadoPagoProvider` em
      `tests/helpers/`
- [x] Documentação: 14 documentos com caminhos de teste atualizados;
      `database/README.md` (13 migrations); `PLANO_IMPORTACAO.md`
      indexada; CI documentada; scripts novos no `README.md` e em
      `DEVELOPMENT.md`; `CHANGELOG.md`, `PROJECT_STATUS.md` e este
      checklist atualizados
- [x] Validações: `lint` · `typecheck` · `test` · `build` · `db:validate`
- [x] Commit `6048c4b` (push pendente de autorização)

## Fora do roteiro — Documentação: erros factuais e banners (2026-10-14)

Segunda entrega única autorizada. Nenhum código de aplicação alterado;
detalhe em `CHANGELOG.md`.

- [x] `API.md`: seção **Financial** adicionada (8 rotas reais,
      `AdminGuard` em `reverse`/`cancel`); webhook
      `/api/whatsapp/webhook` → `/api/webhooks/whatsapp`; removidos
      `PATCH /templates/:id/approval` e `POST /consents` (não existem);
      `status` de template `PENDING`/`DISABLED` → `ACTIVE`/`INACTIVE`
- [x] `DATABASE.md`: `ADMIN`/`STAFF` → `ADMIN`/`MEMBER`; heading de
      "seeds" corrigido
- [x] `ARCHITECTURE.md`: worker não é mais "stub da Etapa 0"; `database/`
      sem pasta de seeds
- [x] `DEVELOPMENT.md`: path do webhook corrigido
- [x] `PROJECT_STATUS.md`: 509/509 → **538/538**; "CI e deploy" → só
      deploy/CD
- [x] `README.md`: "12 de 12 etapas" → **Etapas 0–12 (13 etapas)**;
      evidências 490 → 538; `/importacoes` no mapa de páginas
- [x] `CHECKLIST_PRE_PRODUCAO.md`: `login-rate-limit.ts`; uploads
      (existe `FileInterceptor` ≤ 5 MB); defaults de
      `PASSWORD_RESET_ENABLED`/`REGISTRATION_ENABLED`; vitest 2.1.9
- [x] `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md`: 538/538 em 24 arquivos,
      13 migrations (+ `import_batch`), 39 páginas, financeiro
      `OPEN`/`PAID`/`CANCELLED`, upload documentado, webhook corrigido,
      typecheck nos workspaces `apps/*`
- [x] **Achado novo**: `npm audit --omit=dev` = 2 vulnerabilidades em
      produção (`postcss`/`next`) — corrigido em L1 do checklist e §21
      da documentação completa
- [x] Redução de duplicação: `PROJECT_STATUS.md` como fonte única das
      contagens; `docs/README.md` reorganizado (produto sempre atual ×
      entregáveis de etapa)
- [x] Banners de obsolescência em 9 entregáveis datados
- [x] Rename `akylla_gestao_diretrizes_opencode.md` →
      `AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md` + 7 referências + banner
- [x] 51 links relativos verificados (0 quebrados) e `npm run validate`
      completo

## Fora do roteiro — Importação de planilhas CSV (2026-10-14)

Tarefa autorizada pelo proprietário; plano e decisões D1–D8 em
`docs/akylla/PLANO_IMPORTACAO.md`.

- [x] Plano escrito e aprovado (D1 entidades · D2 CSV · D3 skip de
      duplicatas · D4 `ImportBatch` + migration · D5 dry-run · D6
      `csv-parse`/`multer` · D7 sem auto-criação · D8 limites de plano)
- [x] Migration aditiva `20261014114855_import_batch` (2 enums + tabela)
      aplicada em `petflow` e `petflow_test`; `db:validate` OK
- [x] Schemas Zod/tipos em `@petflow/shared`
- [x] Módulo da API `apps/api/src/imports` (template, upload, histórico)
      com `AdminGuard`, transação por lote e checagem de limites
- [x] 413 para arquivo > 5 MB no `AllExceptionsFilter`
- [x] UI `/importacoes` + item de navegação apenas para ADMIN
- [x] `tests/integration/imports.test.ts` (29 cenários) e `resetDatabase` com
      `ImportBatch`
- [x] Documentação: `DATABASE.md`, `API.md`, `CHANGELOG.md`,
      `PROJECT_STATUS.md` e este checklist
- [x] Validações: `lint` · `typecheck` · `test` · `build` · `db:validate`

## Etapa 0 — Diagnóstico do repositório (2026-10-12)

- [x] Inspecão somente leitura do monorepo herdado (workspaces, stack,
      schema, testes, documentação)
- [x] Contagem de testes e verificação de ambiente (sem execução de
      testes nesta etapa)
- [x] Varredura de referências de marca e de nicho em textos visíveis
- [x] Lacunas identificadas (AP/AR inexistente, billing sem
      enforcement, sem edição de empresa, CSV parcial, indicadores de
      nicho)
- [x] Entregável: `docs/akylla/DIAGNOSTICO_INICIAL.md`
- [x] Nenhum arquivo de código alterado

## Etapa 1 — Plano e linha de base (2026-10-12)

- [x] Entregável: `docs/akylla/PLANO_DE_ADAPTACAO.md` (classificação
      de módulos reaproveitáveis × específicos, riscos priorizados,
      plano de rollback/migrations, custos estimados, critérios de
      aceite por etapa)
- [x] `npm ci` executado; verificação completa de linha de base:
      `lint` 0 erros · `typecheck` OK · **380/380 testes** · `build`
      OK · `db:validate` OK
- [x] Nenhum schema/banco/migration alterado
- [x] Vulnerabilidades de dev-dependências registradas (8)

## Etapa 2 — Identidade Akylla Gestão (2026-10-12)

- [x] Entregável: `docs/akylla/IDENTIDADE_E_NAVEGACAO.md`
- [x] Marca, textos de tela, metadados, rodapé e log de boot
      adaptados para **Akylla Gestão** ("Gestão para pequenos
      negócios")
- [x] Exportações CSV com prefixo `akylla_*` (servidor e UI)
- [x] Moeda do comprovante padronizada em BRL (pt-BR)
- [x] Textos de nicho removidos de módulos genéricos
- [x] Identificadores internos e módulos preservados (compatibilidade
      técnica registrada)
- [x] Validações 5/5 verdes (380/380 testes)

## Etapa 3 — Auditoria multiempresa e permissões (2026-10-12)

- [x] Entregável: `docs/akylla/AUDITORIA_MULTIEMPRESA.md`
- [x] Teste novo `tests/integration/tenancy-audit.test.ts` (+56 cenários Empresa
      A × B: injeção de `companyId`, leitura/escrita cruzada, FKs,
      relatórios/CSV, perfis ADMIN/MEMBER, vazamento em erros)
- [x] **Nenhuma falha de isolamento ou de autorização confirmada**
- [x] Suíte 436/436; `lint`/`typecheck`/`build` OK
- [x] Nenhum código de produção alterado

## Etapa 4 — Definição do núcleo genérico (2026-10-12)

- [x] Entregável: `docs/akylla/MAPA_DE_MODULOS.md` — matriz de 23
      itens nas 4 categorias aprovadas (núcleo, opcionais genéricos,
      nicho, transversais), inventário completo conferido
- [x] **Aprovada pelo proprietário** (decisões D1–D4 registradas)
- [x] Nenhum código/schema/teste alterado (etapa de análise)

## Etapa 5 — Cadastros, clientes e fornecedores (2026-10-12)

- [x] Cadastros confirmados genéricos e isolados por tenant
- [x] Busca de fornecedores ampliada (nome/email/telefone/documento)
- [x] +6 testes: opcionalidade de CPF/documento e preservação de
      histórico na inativação
- [x] Suíte 442/442; `lint`/`typecheck` OK
- [x] Navegação de pets na tela de clientes diferida para a Etapa 10

## Etapa 6 — Produtos, categorias e estoque (2026-10-12)

- [x] Os 10 itens do roteiro confirmados no código
- [x] Correção do filtro `lowStock` (exigir `minimumStock > 0`)
- [x] +2 testes: requisição repetida e exclusão de mínimo zero
- [x] Suíte 444/444; `lint`/`typecheck` OK

## Etapa 7 — Vendas e recebimentos (2026-10-12)

- [x] Fluxo validado sem alteração de código (todos os 9 itens e 7
      testes do roteiro cobertos)
- [x] Entregável `docs/akylla/LIMITACOES_VENDAS.md` com 9 limitações
      explícitas
- [x] Caixa por turno mantido (decisão registrada)
- [x] Suíte 444/444; `lint`/`typecheck` OK

## Etapa 8 — Financeiro básico AP/AR (2026-10-12)

- [x] Detalhamento prévio em `docs/akylla/MODELO_FINANCEIRO.md`
      (conceitos separados, modelo, transições, escopo da migration,
      plano de reversão); decisões D1–D4 aprovadas pelo proprietário
- [x] Schema: enums `FinancialDirection`/`FinancialStatus`/
      `FinancialOrigin`; `CashMovementOrigin` ganha `ACCOUNT`;
      modelo `FinancialEntry` (`Decimal(12,2)`, contrapartes `SetNull`,
      `@@unique([companyId, origin, originId])`,
      `@@unique([companyId, clientRequestId])`, 4 índices por empresa)
- [x] Migration aditiva `20261012164040_financial_entry` (aprovada)
      aplicada em `petflow`; `npm run db:validate` OK
- [x] Schemas Zod em `@petflow/shared` (`createFinancialEntry`,
      `updateFinancialEntry`, `financialReason`,
      `listFinancialQuery`, `financialSummaryQuery`, labels) +
      `ACCOUNT` no enum/labels de origem de caixa
- [x] Módulo `apps/api/src/financial`: `POST /api/financial` (201;
      contraparte inválida → 400; `P2002` → 409), `GET /api/financial`
      (direção/status/período/search + paginação), `GET /summary`,
      `GET/PATCH /:id` (só `OPEN` → 409), `POST /:id/pay`
      (`OPEN → PAID` + `lockOpenCashSession` → 409 se fechado +
      movimento `ACCOUNT`), `POST /:id/cancel` e `/:id/reverse`
      (`AdminGuard`, motivo 3..500 → 400, duplo → 409); cross-tenant
      → 404; `@Inject()` explícito
- [x] UI `/financeiro` com abas **Resumo | A pagar | A receber**;
      componente `FinancialEntries.tsx`; DTOs em `lib/types.ts`
- [x] `resetDatabase` apaga `FinancialEntry` antes de `user`
- [x] `tests/integration/financial.test.ts` (+30): criação/validações, liquidação
      + saldos coerentes com `/cash/summary`, cancelamento/estorno
      auditáveis, filtros, isolamento A×B, decimais 12,2
- [x] Validações com evidência: `lint` 0 → `typecheck` OK →
      **474/474 testes** → `build` OK → `db:validate` OK

## Etapa 9 — Dashboard e relatórios (2026-10-12)

- [x] Instruções 1–2 confirmadas: agregação 100% server-side,
      `AuthGuard` global + `companyId` da sessão (parâmetro de cliente
      ignorado)
- [x] **Entregável** `docs/akylla/DICIONARIO_INDICADORES.md` com
      significado/fórmula/fonte/estado vazio de todos os indicadores
- [x] Estado vazio sem inventar números (`ticketAverage: null`,
      listas `[]`, zero-fill) — coberto por teste de empresa vazia
- [x] Filtros de data (janela inclusiva UTC, 400 para
      invertido/longo/inválido), paginação `pageSize` 1..100 e limite
      `CSV_ROW_LIMIT = 5000`
- [x] CSV protegido contra injeção de fórmulas (cobertura ampliada
      para sinal após espaço inicial)
- [x] Gráficos do dashboard filtrados a `COMPLETED` no servidor e com
      período único
- [x] **Indicadores de nicho removidos** (`newPets`, `petsBySpecies`);
      UI, DTOs e testes atualizados; `Pet`/`PetSpecies` intactos
      (destino na Etapa 10)
- [x] `docs/architecture/API.md` atualizado; testes novos: empresa
      vazia, exportação com caracteres especiais/fórmulas, coerência
      indicadores × dados-fonte
- [x] Validações com evidência: `lint` 0 → `typecheck` OK →
      **477/477 testes** → `build` OK → `db:validate` OK (sem
      migration na etapa)

## Etapa 10 — Módulos específicos de pet shop (2026-10-12)

**Concluída — decisões D2/D3 do proprietário registradas.**

- [x] Instrução 1: nenhuma exclusão de pets/agenda/serviços/WhatsApp
      (código, tabelas, rotas, testes e páginas intactos)
- [x] Instrução 2: mapeamento de dependências com evidência
      `file:line` registrado no `PLANO_MODULARIZACAO.md` §2
- [x] Instrução 3: recomendação por módulo no `PLANO_MODULARIZACAO.md`
      §3 (pets = opcional de nicho; agenda, serviços, WhatsApp e
      assinaturas = genéricos; seed = reescrever após aprovação)
- [x] Instrução 4: **backend bloqueia módulos desabilitados** —
      `ModuleGuard` (APP_GUARD após `AuthGuard`) + `@RequireModule` em
      pets/services/appointments/whatsapp (exceto webhook
      `@Public`)/subscriptions/subscription-plans; 403 com mensagem;
      ocultação de UI não é controle de acesso
- [x] Instrução 5: pasta `automação do whatsapp/` preservada (fora de
      lint/build/testes; 0 imports do monorepo)
- [x] Rótulo do lembrete generalizado (`{{1}} cliente`); comportamento
      e contagem de 3 variáveis intactos
- [x] **D2 CONFIRMADA**: recomendações do PLANO §3 aceitas; nenhuma
      exclusão
- [x] **D3 DECIDIDA: opção B (`CompanyModule`)** e implementada:
      migration aditiva `20261012154010_company_module` (enums
      `BusinessModule`/`CompanyModuleStatus` + tabela com
      `@@unique([companyId, module])`); API `GET`/`PATCH
      /api/company-modules` (`AdminGuard` na escrita); home oculta
      cards de módulos desativados; ausência de linha = ativo; núcleo
      nunca desativável
- [x] `MAPA_DE_MODULOS.md` §6.2/§6.3/§7, `DATABASE.md` e `API.md`
      atualizados
- [x] Testes: `tests/integration/company-modules.test.ts` **+13**; `resetDatabase`
      apaga `companyModule`
- [x] Validações com evidência: `lint` 0 → `typecheck` OK →
      **490/490 testes** → `build` OK → `db:validate` OK (migration em
      `petflow` e `petflow_test`)

## Etapa 11 — Planos e assinatura SaaS (2026-10-12)

**Concluída — decisões D1–D4 do proprietário registradas e
implementadas.**

- [x] Instrução 1: separação billing-SaaS × assinaturas de negócio
      formalizada no `PLANO_BILLING.md` §1 (models, API/UI, guard,
      testes — sem mistura)
- [x] Instrução 2: estado atual dos modelos documentado no
      `PLANO_BILLING.md` §2 (limites inexistentes, sem gateway)
- [x] Instrução 3: **D1 aprovada** — planos do seed mantidos (79,90 /
      149,90 / 249,90; 30 dias); **não anunciados publicamente**
- [x] Instrução 4: **D2 aprovada — todos os limites**;
      `userLimit`/`clientLimit`/`productLimit` em `TenantPlan` via
      migration `20261012173450_tenant_plan_limits` (Essencial
      3/200/100; Profissional 10/1000/500; Completo ilimitado)
- [x] Instrução 5: estados/vigência/cancelamento/renovação já
      modelados e testados (12 testes em `billing.test.ts`)
- [x] **D3 aprovada — status quo**: enforcement
      (`TenantLimitsService`) **apenas** para empresas com assinatura
      `ACTIVE`; sem assinatura, expirada ou cancelada — nenhum
      bloqueio; aplicado nos `create` de Users/Clients/Products (403
      com nome do plano e limite)
- [x] **D4 aprovada — Mercado Pago (sandbox)**: SDK oficial
      `mercadopago`; provider mock/real/Failing com override para
      testes; `POST /api/billing/checkout` (AdminGuard) cria
      preapproval e vincula `gateway`/`gatewaySubscriptionId`;
      webhook `POST /api/webhooks/mercadopago` (`@Public` + assinatura
      HMAC `x-signature`, idempotente); `GET /api/billing/gateway`
      descreve ambiente/credenciais; env vars em `.env.example` sem
      segredos; sem token — checkout retorna 400 explícito
- [x] Cobrança recorrente real **não ativada** (instrução 7):
      sandbox por padrão; ativação exige E2E com cartão de teste +
      aprovação
- [x] Nenhum preço/limite/promessa publicado fora do sistema
      (instrução 8)
- [x] Testes: `tests/integration/tenant-limits.test.ts` **7** +
      `tests/integration/mercadopago.test.ts` **12**
- [x] Validações com evidência: `lint` 0 → `typecheck` OK →
      **509/509 testes** → `build` OK → `db:validate` OK (migration em
      `petflow` e `petflow_test`)
- [x] Docs: `PLANO_BILLING.md` (entregável, decisões), `DATABASE.md`
      (novas colunas), `API.md` (checkout/gateway/webhook),
      `CHANGELOG.md`

### Pendências registradas (Etapa 11)

- UI `/faturamento` exibindo limites do plano atual e uso (backend já
  expõe campos);
- E2E sandbox com cartão de teste do Mercado Pago + aprovação para
  ativar cobrança recorrente real;
- Escrita do catálogo global de planos (exige papel de plataforma).

## Etapa 12 — Qualidade, segurança e preparação para produção (2026-10-12)

**Concluída — última etapa do roteiro.**

- [x] Instrução 1: validações executadas com evidência — `lint` 0 →
      `typecheck` OK → **509/509 testes** → `build` OK →
      `db:validate` OK
- [x] Instrução 2: nenhuma regressão introduzida pela adaptação
- [x] Instrução 3: falhas preexistentes identificadas separadamente no
      `CHECKLIST_PRE_PRODUCAO.md` §3 (L1–L14)
- [x] Instrução 4: revisão de segurança — segredos (nenhum hardcoded;
      `.env` fora do Git), logs (sem dados sensíveis), autenticação
      (cookie HttpOnly + bcrypt 12 + rate limit), autorização
      (AuthGuard/AdminGuard/ModuleGuard), tenant (`companyId` só do
      contexto autenticado; grep `body.companyId` = 0), uploads (nenhum
      endpoint), exportações (CSV isolado por empresa), webhooks
      (assinatura HMAC)
- [x] Instrução 5: backups/restauração — **pendência registrada**
      (exige ambiente de produção; não executável aqui)
- [x] Instrução 6: ambientes documentados (dev/teste/produção) no
      `CHECKLIST_PRE_PRODUCAO.md` §4
- [x] Instrução 7: configuração e env vars documentadas sem valores
      secretos (`.env.example` + Seção 5 do checklist)
- [x] Instrução 8: estimativa de custos de hospedagem produzida
      (Seção 6: R$ 55–250/mês conforme opção)
- [x] Instrução 9: nenhum deploy nem alteração de serviço externo
      executado
- [x] Instrução 10: lista de limitações conhecidas e itens obrigatórios
      antes da comercialização (Seções 3 e 7)
- [x] Entregável: `docs/akylla/CHECKLIST_PRE_PRODUCAO.md` com
      evidências, riscos remanescentes, custos e **decisão recomendada:
      não declarar pronto para produção**

## Roteiro Akylla Gestão — RESUMO FINAL (Etapas 0–12)

Todas as 13 etapas do roteiro foram concluídas em 2026-10-12, com
validações completas por etapa (lint/typecheck/testes/build/db:validate)
e decisões do proprietário registradas quando exigidas. Entregáveis em
`docs/akylla/`: DIAGNOSTICO_INICIAL, PLANO_DE_ADAPTACAO,
IDENTIDADE_E_NAVEGACAO, AUDITORIA_MULTIEMPRESA, MAPA_DE_MODULOS,
LIMITACOES_VENDAS, MODELO_FINANCEIRO, DICIONARIO_INDICADORES,
PLANO_MODULARIZACAO, PLANO_BILLING, CHECKLIST_PRE_PRODUCAO.

> Regra: nenhuma etapa é iniciada sem autorização explícita; marcar
> itens aqui apenas com evidência de execução.
