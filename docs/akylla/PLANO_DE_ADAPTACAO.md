# Akylla Gestão — Plano de adaptação e linha de base (Etapa 1)

**Data:** 12/10/2026
**Base:** `docs/akylla/DIAGNOSTICO_INICIAL.md` (preservado, não alterado) +
diretrizes `akylla_gestao_diretrizes_opencode.md` e
`PASSO_A_PASSO_OPENCODE_AKYLLA.md`.
**Sequência operacional adotada:** Etapas 1–12 do passo a passo (decisão do
proprietário em 12/10/2026), com as diretrizes gerais como requisitos
complementares.

### Legenda de evidência (usada em todo o documento)

| Marca | Significado |
|---|---|
| **[Código]** | confirmado pela inspeção direta do arquivo-fonte |
| **[Teste]** | confirmado por teste **executado nesta etapa** com resultado observado |
| **[Doc]** | vem apenas da documentação herdada; não re-verificado |
| **[Hipótese]** | decisão ainda não tomada / comportamento não observado |

---

## 1. Resumo executivo

A base herdada é tecnicamente madura: monorepo NestJS + Next.js +
PostgreSQL/Prisma com multiempresa imposto no servidor, 380 testes de
integração **executados e aprovados nesta etapa**, lint/typecheck/build/
db:validate limpos. A adaptação para o Akylla Gestão é, em sua maior parte,
**identidade, escopo de navegação e rótulos** — não reescrita.

Trabalho genuinamente novo identificado:

1. **Módulo de contas a pagar e a receber (AP/AR)** — confirmado no código
   como inexistente (§9). Hoje só existe caixa por sessão.
2. **Enforcement de planos no billing SaaS** — `TenantPlan` sem campos de
   limite e `TenantSubscription` sem bloqueio de uso (§10).
3. **Configurações da empresa** — `Company` é criada no registro e nunca
   editável (endpoints/UI ausentes).
4. **Identidade Akylla** — ~18 textos visíveis + constantes internas.

Riscos que exigem decisão/proximidade do proprietário: dependências com
vulnerabilidades (só corrigíveis com upgrades de major), ausência de CI,
reset de senha sem token de e-mail e cadastro aberto sem verificação
(perigosos apenas se ligados em produção).

**Linha de base: 5 de 5 verificações aprovadas** (§3). Nenhum banco de
produção/desenvolvimento foi alterado; o banco de teste `petflow_test` recebeu
`migrate deploy` idempotente (0 migrations pendentes) conforme autorizado.

---

## 2. Arquitetura atual confirmada e tecnologias

Tudo abaixo é **[Código]**, salvo indicação.

| Camada | Tecnologia | Versão observada |
|---|---|---|
| Runtime | Node.js | v24.21.0 (engines >=20) |
| Monorepo | npm workspaces | 6 workspaces: `apps/{api,web,worker}`, `packages/{shared,whatsapp,config}` |
| API | NestJS | ^11 (`@nestjs/common|core|platform-express`), Express platform, `rawBody` habilitado |
| Frontend | Next.js (App Router, tudo `"use client"`) | ^15, React ^19, Tailwind ^4 |
| Banco | PostgreSQL | 17 (serviço local em execução, porta 5432) |
| ORM | Prisma | 5.22 (schema único em `database/prisma/schema.prisma`, 9 migrations) |
| Validação | Zod | ^3.25 — schemas compartilhados em `@petflow/shared`, pipe por-parâmetro |
| Testes | Vitest + Supertest | ^2.1 / ^7 — 18 arquivos, 380 casos, Integração com Postgres real |
| Fila | Postgres (poll + claim atômico) no `apps/worker` | sem Redis/BullMQ |
| Senha/sessão | bcryptjs (12) + cookie HttpOnly `petflow_session` + hash SHA-256 em `Session` | |
| WhatsApp | Cloud API Meta, provider `meta`/`mock` | fornecedor abstraído em `@petflow/whatsapp` |
| Lint | ESLint 9 flat config | ignora `automação do whatsapp/**`, `dist`, `.next` |

Detalhes estruturais confirmados:

- Acesso ao banco **somente pela API** (o frontend nunca fala com Postgres) →
  **não há RLS a aplicar**; isolamento é 100% autorização server-side.
- `AuthGuard` global monta `request.auth` com `companyId` vindo da sessão
  (`apps/api/src/common/guards/auth.guard.ts:59-64`); nenhum endpoint aceita
  `companyId` do cliente (grep: 0 ocorrências).
- `AdminGuard` por endpoint/classe restringe escrita a ADMIN (~30 rotas).
- Transações com lock `FOR UPDATE` e ordem fixa (caixa → produtos) em vendas;
  idempotência por `clientRequestId`; CSV com escape anti-injeção de fórmula.
- Pasta legada `automação do whatsapp/` é projeto **independente** (Express +
  BullMQ + Redis, próprio Prisma), versionada e **intocada**.

---

## 3. Resultado real de cada comando de validação (Etapa 1)

Ambiente: Windows, Node v24.21.0, npm 11.19.0, PostgreSQL 17 (localhost:5432).
`.env` local presente (somente nomes de variáveis inspecionados; nenhum valor
exibido). Trabalho local sem alterações em arquivos rastreados.

| # | Comando | Resultado observado | Tempo/obs |
|---|---|---|---|
| 0 | `git status` (antes) | árvore limpa; apenas 2 untracked: `docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md`, `docs/akylla/` | nenhum stash; branch `main` = `origin/main` |
| 1 | `npm ci` | **OK** — 340 pacotes instalados, 347 auditados; nenhum script de dependência quebrou | 4 min; lockfile v3 validado contra os 6 workspaces |
| 2 | `npm run db:generate` | **OK** — Prisma Client gerado em `node_modules/@prisma/client` | codegen local, sem conexão com banco |
| 3 | `npm run lint` | **OK — exit 0, 0 erros** | `eslint .` (pasta legada excluída pelo config) |
| 4 | `npm run typecheck` | **OK — exit 0** (shared build, whatsapp build, api/web/worker `tsc --noEmit`) | |
| 5 | `npm test` | **OK — 18 arquivos, 380/380 testes aprovados, exit 0** | 78,66 s; `global-setup` executou `prisma migrate deploy` em `petflow_test` → **"No pending migrations to apply"** (nenhum schema alterado) |
| 6 | `npm run build` | **OK — exit 0** (shared, whatsapp, api `tsc`, web `next build` com 38 rotas, worker `tsc`) | |
| 7 | `npm run db:validate` | **OK — exit 0**, schema válido | apenas aviso de versão nova do Prisma (não instalada) |
| 8 | `npm audit` (extra) | 8 vulnerabilidades: 2 críticas, 2 altas, 4 moderadas — detalhe em §13 | nenhuma correção aplicada (exigiria upgrade de major) |

**Afirmação autorizada pela evidência:** os 380 testes existentes passaram
nesta execução (**[Teste]**). Detalhe por arquivo:

`whatsapp` 61 · `appointments` 45 · `reports` 41 · `cash` 37 · `sales` 32 ·
`stock` 20 · `clients` 20 · `products` 19 · `subscriptions` 18 · `catalog` 14 ·
`services` 13 · `pets` 12 · `auth` 11 · `users` 10 · `billing` 12 ·
`password-reset` 7 · `register` 6 · `health` 2.

Comandos **não** executados (por regra da etapa): `db:migrate`, `db:deploy`,
`bootstrap:admin`, `db:seed:demo`, qualquer seed, qualquer conexão alterando
bancos, commits, pushes, deploys.

---

## 4. Problemas identificados por lint, tipos, testes, build e Prisma

**Nenhum defeito de código foi encontrado pelas ferramentas.** O que apareceu:

| Origem | Achado | Severidade | Impacto real |
|---|---|---|---|
| `npm audit` (dev) | `tinypool` ≤2.1.1 — prototype pollution → RCE (**crítica**); `vitest`/`@vitest/mocker` (moderate); `esbuild` ≤0.24.2 (moderate) | Crítica/ moderada | **Somente ferramentas de teste/dev**, não entram no artefato de produção. Correção exige `vitest@5` (breaking) → planejar na Etapa 12 |
| `npm audit` (prod) | `postcss` ≤8.5.22 via `next` (alta + moderada: XSS em stringify, leitura arbitrária via `sourceMappingURL`) | Alta | Afeta a cadeia de build do frontend; correção exige `next@16` (breaking) → planejar na Etapa 12 com janela de regressão |
| Prisma | aviso "Update available 5.22.0 → 8.x" | Info | Não adotar sem necessidade; upgrade de major tem custo alto |
| npm | aviso `eslint@9.39.5` "no longer supported" | Info | Apenas aviso do registry |
| Vite | deprecation "CJS build of Vite's Node API" | Info | Ruido; sem efeito |
| Testes | nenhum teste falhou; nenhum teste foi ignorado/skip | — | — |
| Lint/typecheck/build | nenhum erro, nenhum warning emitido | — | — |

Nenhum teste foi enfraquecido, removido ou contornado para obter resultado
verde. Nenhuma correção foi aplicada (Etapa 1 é de registro, não de
correção).

---

## 5. Mapa dos módulos que podem ser reaproveitados

Classificação **[Código] + [Teste]** (todos aprovados na execução de §3):

| Módulo | API | Frontend | Reuso no Akylla | Ajuste necessário |
|---|---|---|---|---|
| Auth/sessão/rate limit | `apps/api/src/auth` | `/login`, `/cadastro`, `/redefinir-senha` | Integral | Só identidade (nome do cookie adiado) |
| Empresas/usuários/papéis | `users` | `/usuarios` | Integral | Endpoint de edição de `Company` (novo) |
| Categorias/fornecedores/produtos | `categories`,`suppliers`,`products` | `/categorias`,`/fornecedores`,`/produtos` | Integral | Nenhum |
| Estoque | `stock` | `/produtos/[id]` | Integral | Nenhum |
| Vendas/PDV | `sales` | `/pdv`,`/vendas` | Integral | Nenhum |
| Caixa (fluxo de caixa por turno) | `cash` | `/caixa/*`,`/financeiro` | Integral (complementa AP/AR) | Nenhum |
| Clientes | `clients` | `/clientes` | Integral | Revisar regras de duplicidade (já adequadas) |
| Serviços (catálogo nome/duração/preço) | `services` | `/servicos` | **Genérico** | Só rótulo ("catálogo de serviços") |
| Agendamentos (`petId` opcional) | `appointments` | `/agenda` | **Genérico** (salões, oficinas, clínicas) | Rótulos; pet já opcional no schema |
| Assinaturas de clientes (`Subscription`/`SubscriptionPlan`) | `subscriptions` | `/assinaturas`,`/planos` | **Genérico** (recorrência do negócio cliente) | Renomear rótulos; separar conceitualmente do billing Akylla |
| Billing SaaS (`TenantPlan`/`TenantSubscription`) | `billing` | `/faturamento` | Esqueleto correto do billing da Akylla | Enforcement + campos de limite (Etapa 11) |
| Dashboard/relatórios/CSV | `reports` | `/dashboard`,`/relatorios` | Integral | Remover indicadores de nicho (pets) |
| WhatsApp (config/templates/consents/fila/webhook) | `whatsapp` + `packages/whatsapp` + `worker` | `/whatsapp/*` | Módulo **opcional** genérico | Generalizar variável "pet" dos lembretes |
| Infra de qualidade (testes, seeds de teste, helpers) | `tests/*` | — | Integral | Estender para AP/AR e novo núcleo |

---

## 6. Mapa dos módulos exclusivos de pet shop

**[Código]** — tudo preservado; nada será excluído ou migrado nesta jorneta
sem decisão explícita do proprietário (Etapa 10):

| Elemento | Localização | Dependências | Destino planejado |
|---|---|---|---|
| Modelo/UI de **Pets** | `apps/api/src/pets`, `apps/web/src/app/pets`, DTOs em `lib/types.ts` | Client (FK Restrict), Appointment (`petId`), relatórios ("pets por espécie"), dashboard ("pet(s) cadastrado(s)"), seed | Ocultar da navegação comum; manter como módulo opcional |
| **Lembretes de agendamento** com variável "pet" | `appointments.service.ts` (syncReminder), template com 3 variáveis | WhatsApp fila | Tornar variável genérica (cliente/serviço/data) |
| Textos da marca anterior/"gestão para pet shops"/pata 🐾 | `layout.tsx`, `login`, `cadastro`, `faturamento`, `page.tsx`, `Receipt.tsx`, CSVs | — | Substituídos na **Etapa 2 (identidade)** |
| Seed de demonstração "Mundo Pet" | `apps/api/src/cli/seed-demo.ts` | todos os módulos | Reescrever com dados de comércio variado (Etapa futura, com aprovação) |
| Pasta legada `automação do whatsapp/` | raiz | nenhuma do monorepo | **Preservada intocada permanentemente** |

Itens **genéricos que parecem de nicho mas não são**: `Service`,
`Appointment`, `Subscription`/`SubscriptionPlan` — permanecem no núcleo.

---

## 7. Plano para tornar o núcleo genérico sem quebrar fluxos

Princípio: **mudanças pequenas, verificáveis e reversíveis**; nenhum rename em
massa; identificadores internos `@petflow/*`, `petflow_session`, bancos
`petflow`/`petflow_test` e prefixo `PF-` **adiados** (decisão do proprietário).

1. **Etapa 2 — Identidade**: alterar apenas textos visíveis e constantes
   seguras (`APP_NAME` em `packages/shared`, títulos, subtítulos, footer,
   fallbacks de comprovante, prefixos de CSV `petflow_*` → `akylla_*`, health
   `service: "petflow-api"` → mantido por enquanto ou renomeado com nota).
   Critério: `npm run lint/typecheck/build` + smoke manual de login.
2. **Etapa 3 — Auditoria multiempresa**: re-executar a suíte inteira e criar
   casos dedicados Empresa A × Empresa B (hoje o isolamento já tem cobertura
   **[Teste]**, mas o plano exige evidência nomeada por recurso).
3. **Etapa 4 — Núcleo genérico**: matriz de classificação aprovada (§5/§6)
   aplicada como **ocultação de navegação**, não exclusão de código.
4. **Etapas 5–7**: adaptação de rótulos/fluxos de cadastros, produtos/estoque
   e vendas — nenhuma mudança de schema prevista; validar regras genéricas
   (SKU por empresa, homônimos, formas de pagamento).
5. **Etapa 8 — AP/AR**: único módulo novo de negócio (§9).
6. **Etapa 9 — Dashboard/relatórios**: substituir "pets novos"/"pets por
   espécie" por indicadores genéricos (clientes novos, vendas, estoque);
   dicionário de indicadores documentado.
7. Cada etapa re-executa `lint`, `typecheck`, `test`, `build` antes de
   avançar; regressões são bloqueios.

---

## 8. Plano futuro de navegação e ativação de módulos por segmento

**[Código]** hoje: não existe sidebar; o menu de fato é a grade de cards da
home (`apps/web/src/app/page.tsx`, array `plannedModules`) + links por página.

Plano (sem implementar agora):

1. **Etapa 2**: introduzir um componente único de navegação (header/sidebar)
   derivado de uma lista de módulos, agrupada por área da diretriz
   (Visão geral, Cadastros, Operação, Financeiro, Relatórios, Configurações),
   mantendo a home como atalho.
2. **Ativação por segmento**: lista de módulos com flags por empresa
   (`Company.modules` ou tabela `CompanyModule` — decisão de schema na
   Etapa 4/10, com migration). Ocultação na UI **não** é controle de acesso:
   o backend deve bloquear módulo desabilitado (guard/adicional) quando o
   modelo de planos existir (Etapa 11).
3. Módulos de pet shop (`/pets`, lembretes com "pet") saem da navegação
   comum e passam a exigir flag; rotas e dados continuam existindo.

---

## 9. Plano de contas a pagar e receber (AP/AR)

### Confirmação da lacuna (exigida pela decisão 8 do proprietário)

**[Código]** — grep em `database/prisma` e `apps/api/src` por
`payable|receivable|dueDate|venciment|OVERDUE|invoice`: **0 ocorrências**.
O financeiro atual é exclusivamente **fluxo de caixa por sessão**:

- `CashSession` (abertura/fechamento por turno, uma por empresa) e
  `CashMovement` (IN/OUT, origem MANUAL/SALE/SALE_CANCELMENT/REVERSAL,
  flag `inCash`, estorno auditável).
- Não existe: vencimento, situação (aberto/vencido/pago), contraparte,
  previsão, categoria de despesa/receita, parcelamento.
- Venda em dinheiro entra no caixa na hora; venda no cartão/pix só compõe
  resumo — **não há notion de "a receber"**.

Conclusão: **AP/AR é construção nova**, relacionada mas não substituível pelo
caixa. **[Teste]** o comportamento do caixa foi coberto por 37 testes aprovados.

### Modelo proposto ( Etapa 8 — detalhar antes de implementar)

- Novos modelos (aditivos): `Payable`/`Receivable` (ou único `FinancialEntry`
  com `direction` PAYER|PAYEE) com: `companyId`, tipo/direção, descrição,
  `dueDate`, `paidAt?`, `amount` Decimal(12,2), status
  OPEN|PAID|OVERDUE|CANCELLED, contraparte (Client/Supplier opcional via
  `SetNull`), categoria opcional, `origin` (manual|venda|assinatura),
  `originId?`, `cashMovementId?` (vínculo ao caixa quando liquidado em
  dinheiro), auditoria (autor, cancelamento com motivo).
- **Relação com o caixa atual**: liquidar um título gera `CashMovement`
  (origem nova `ACCOUNT`/`RECEIPT`) dentro da sessão aberta, reaproveitando
  `lockOpenCashSession` — venda em dinheiro pode continuar lançando direto no
  caixa **e** alimentando um `Receivable` já liquidado, ou manter o fluxo
  atual; decisão de produto a confirmar na Etapa 8.
- **Prevenção de duplicidade**: unique parcial `(companyId, origin,
  originId)` quando `originId` existe + idempotência por `clientRequestId`
  (padrão já usado em vendas) + `updateMany` condicional para transições de
  status (padrão já usado em estornos/cancelamentos).
- Validações no servidor: valores positivos, `dueDate` razoável, transições
  de status, recálculo de totais por período no servidor, filtros por
  período/status com paginação; relatórios de fluxo de caixa **previsto vs
  realizado** separados do saldo de cédulas.
- Frontend: abas em `/financeiro` (Resumo | A pagar | A receber) reutilizando
  padrões de列表/paginação existentes.
- Testes obrigatórios: criação, liquidação, vencimento, isolamento A×B,
  duplicidade por reenvio, estorno/cancelamento auditável, coerência com
  `cash/summary`.

Fora do escopo desta etapa: qualquer código.

---

## 10. Assinaturas de clientes × assinatura SaaS (billing da Akylla)

**[Código]** — o repositório **já separa corretamente** as duas entidades:

| Conceito | Modelos | Rotas | Quem paga quem | Estado atual |
|---|---|---|---|---|
| Assinatura de **negócio do cliente** | `SubscriptionPlan`, `Subscription` (escopo `companyId`) | `/api/subscriptions`, `/api/subscription-plans`; UI `/assinaturas`, `/planos` | O cliente final paga à empresa (lojista) — pagamento registrado no caixa da empresa (sem gateway) | Completo e **genérico** (plano com nome, preço, duração; cliente; período; renovação; cancelamento com motivo). **[Teste]** 18 casos aprovados |
| Assinatura **SaaS da Akylla** | `TenantPlan` (global), `TenantSubscription` (1 por empresa) | `/api/billing`; UI `/faturamento` | A empresa cliente paga à Akylla | Esqueleto funcional, **manual** (ADMIN faz upsert/renew/cancel; nenhum gateway). **[Teste]** 12 casos aprovados |

Recomendações:

1. Manter ambas; renomear rótulos na Etapa 2 para não sugerir "plano de banho"
   (ex.: "Planos de clientes" × "Plano da empresa no Akylla").
2. Separar conceitualmente na documentação (billing × financeiro do negócio ×
   assinaturas de negócio) — a diretriz §6 exige essa tríplice separação.
3. **Não implementar gateway nem cobrança real** (decisão 9 do proprietário).
4. Enforcement de limites fica para a Etapa 11 (§11 e §10 da Etapa 11 do
   passo a passo); nada será bloqueado por plano antes disso (decisão 10).

---

## 11. Plano de tratamento futuro (limites, senha, cadastro, rate limit, CI, backups, privacidade)

| Tema | Estado [Código] | Plano | Etapa |
|---|---|---|---|
| Limites de plano | `TenantPlan` sem campos de limite; nenhum service consulta `TenantSubscription` para bloquear | Adicionar campos (usuários, clientes, módulos), middleware/guard de quota, testes de contorno via API; catálogo continua seedado, sem escrita pública | 11 |
| Recuperação de senha | Endpoint local sem token de e-mail (flag `PASSWORD_RESET_ENABLED`) | Implementar token único com expiração enviada por e-mail; manter flag desligada em produção até lá | 12 (antes do lançamento) |
| Cadastro aberto | `REGISTRATION_ENABLED` sem verificação de e-mail/captcha | Verificação de e-mail + limitação por domínio/captcha antes de habilitar publicamente | 12 |
| Rate limiting | In-memory `Map` (não escala entre processos) | Adotar armazenamento compartilhado (Postgres/Redis) **somente quando** houver múltiplas instâncias — sem adicionar infra agora | 12 ou pós-lançamento |
| CI | Inexistente [Doc] | GitHub Actions: `npm ci` + lint + typecheck + test (service container Postgres 17) + build, em PRs e main | 12 |
| Backups | Nenhum configurado | Definir provedor com backup automático + **teste real de restauração** documentado | 12/pré-produção |
| Privacidade/LGPD | Dados pessoais (CPF, endereço, telefone) sem rotas de titular | Exportação/exclusão do titular, política de retenção, termos e política de privacidade, logs sem PII | 12/pré-produção |
| CORS/CSRF | Allowlist + `OriginCheckMiddleware` só em `/auth` | Tornar a verificação de origem global para mutações | 12 |
| Vulnerabilidades (§4) | 8 achados | Janela dedicada de upgrade (`vitest@5`, `next@16`) com regressão completa | 12 |

---

## 12. Estratégia de migração de dados e rollback (sem executar nada agora)

- **Convenção já usada e mantida**: migrations aditivas com nome
  `YYYYMMDDHHMMSS_etapaN_descricao`; nenhuma edição de migration já aplicada;
  `schema.prisma` é a única fonte de verdade do monorepo.
- **Próximas migrations previstas** (apenas planejamento):
  1. Etapa 8: modelos AP/AR + índices por empresa (+ enums de status).
  2. Etapa 11: campos de limite em `TenantPlan` (+ defaults preenchidos).
  3. Etapa 12/decisão: campos de configuração da empresa (se optados por
     coluna) e tabela/coluna de módulos ativos.
- **Ordem segura por etapa**: migration aditiva (nunca destructiva) →
  deploy de código compatível com schema anterior (expand/contract) →
  remoção só em etapa posterior.
- **Rollback**: Prisma não possui `migrate down`; rollback = (a) restaurar
  backup do banco, (b) reverter o commit de código, (c) forward-fix com nova
  migration. Por isso: backup obrigatório **antes** de qualquer `migrate
  deploy` em ambiente com dados reais; migrations destructivas (drop/renomey)
  exigem aprovação explícita e duas etapas de distância.
- **Dados de clientes**: nunca copiar dados reais para testes; seeds apenas
  em ambientes de demonstração e em empresas vazias (padrão já usado pelo
  `seed-demo`).
- **Bancos**: dev `petflow`, teste `petflow_test` (gerenciado pelo
  global-setup). Produção **não existe ainda** — definida na Etapa 12.

---

## 13. Riscos priorizados por severidade

| # | Risco | Severidade | Evidência | Mitigação/etapa |
|---|---|---|---|---|
| R1 | Sem CI: qualidade depende de execução manual; regressões podem passar | Alta | [Código] nenhum workflow existe | Etapa 12 (GitHub Actions) |
| R2 | `next`/`postcss` com vulnerabilidade alta na cadeia de build do frontend | Alta | [Teste] `npm audit --omit=dev` | Upgrade `next@16` na Etapa 12 com regressão |
| R3 | `tinypool` (crítico, RCE) na suíte de testes | Crítica (escopo dev) | [Teste] `npm audit` | Upgrade `vitest@5` na Etapa 12; não bloqueia produto |
| R4 | Billing sem enforcement (uso sem assinatura válida) | Alta (comercial) | [Código] | Etapa 11 |
| R5 | Reset de senha sem token de e-mail + cadastro aberto sem verificação | Alta **se** flags ligadas em produção | [Código] | Manter flags desligadas; Etapa 12 |
| R6 | Rate limit in-memory não escala | Média | [Código] | Pós-1º cliente em produção |
| R7 | Sem backup/monitoramento/plano de incidente (produção inexistente) | Alta no lançamento | [Código]/[Doc] | Etapa 12 |
| R8 | LGPD: sem exportação/exclusão de titular, sem retenção | Média/Alta no lançamento | [Código] | Etapa 12/pré-produção |
| R9 | Histórico Git anterior perdido (squash em 1 commit) | Média | [Código] `git log` | Aceito; manter histórico limpo a partir de agora |
| R10 | Projeto dentro de pasta OneDrive (sync pode travar arquivos/`node_modules`) | Baixa/Média | [Código] caminho atual | Considerar mover para pasta não sincronizada quando houver CI |
| R11 | Upgrade de major (Prisma 8, Next 16, Vitest 5) pode quebrar | Média | [Teste] avisos | Só com janela de regressão; nunca em etapa de recurso |
| R12 | Navegação sem componente único (menu = grade da home) | Baixa | [Código] | Etapa 2/4 |
| R13 | Vendas antigas sem `cashSessionId` fora do financeiro [Doc] | Baixa | [Doc] | Limitação de dados dev; sem ação |

---

## 14. Ordem recomendada das próximas etapas

1. **Etapa 2 — Identidade Akylla Gestão** (textos, títulos, BRL/DD-MM-AAAA,
   navegação comum sem marca pet shop; sem tocar em identificadores internos).
2. **Etapa 3 — Auditoria multiempresa e permissões** (evidências nomeadas
   Empresa A × B; correções mínimas se houver achado).
3. **Etapa 4 — Núcleo genérico** (matriz de módulos aprovada; ocultação de
   navegação planejada, não exclusão).
4. **Etapa 5 — Cadastros/clientes/fornecedores** (rótulos e validações
   genéricas).
5. **Etapa 6 — Produtos, categorias e estoque** (validação das regras
   genéricas já existentes).
6. **Etapa 7 — Vendas e recebimentos** (fluxo existente confirmado; definir
   com o proprietário a relação venda×AP/AR antes da Etapa 8).
7. **Etapa 8 — Financeiro básico (AP/AR)** — maior construção nova.
8. **Etapa 9 — Dashboard e relatórios** (indicadores genéricos, dicionário).
9. **Etapa 10 — Destino dos módulos de pet shop** (decisão do proprietário).
10. **Etapa 11 — Planos/assinatura SaaS** (limites + enforcement; sem gateway
    até decisão explícita).
11. **Etapa 12 — Qualidade, segurança e pré-produção** (CI, upgrades de
    dependência, backups, LGPD, checklist de lançamento).

---

## 15. Critérios de aceite verificáveis por etapa

| Etapa | Critério de aceite (verificável) |
|---|---|
| 2 | `lint`+`typecheck`+`test`+`build` verdes; grep da marca anterior/"pet shop"/🐾 em textos visíveis = 0 (com lista do que permaneceu por compatibilidade); login e navegação manuais OK |
| 3 | Suíte verde; casos nomeados de acesso cruzado (listar/abrir/editar/excluir/associar) para os 10 recursos críticos; relatório `AUDITORIA_MULTIEMPRESA.md` com achados e correções |
| 4 | `MAPA_DE_MODULOS.md` aprovado pelo proprietário; nenhum código excluído |
| 5–7 | Suíte verde + casos novos por etapa; fluxo venda ponta a ponta com estoque/financeiro consistentes |
| 8 | Modelos AP/AR com migration aditiva; testes de duplicidade, vencimento, liquidação→caixa e isolamento A×B; nenhum regresso nos 380 testes |
| 9 | Dicionário de indicadores publicado; nenhum número sem origem rastreável; CSV protegido mantido |
| 10 | Decisão registrada por módulo (ocultar/opcional/manter) com plano de reversão |
| 11 | Limites aplicados **no backend** com teste de contorno via API; nenhuma cobrança anunciada sem implementação |
| 12 | `CHECKLIST_PRE_PRODUCAO.md` com evidências, custos estimados e pendências explícitas; backup + restauração testados |

---

## 16. Custos e serviços externos possíveis (nada contratado)

Estimativas de mercado, sujeitas a cotação; **nenhum serviço foi ativado,
comprado ou conectado** nesta etapa.

| Necessidade | Opções de baixo custo | Custo estimado | Quando |
|---|---|---|---|
| Hospedagem API+web+worker | Um VPS (Hetzner/Racknerd), ou Render/Fly/Railway free-tier→paid | R$ 0–80/mês (VPS) ou USD 7–25/mês (PaaS) | Etapa 12 |
| PostgreSQL gerenciado | Neon / Supabase free tier, ou Postgres no mesmo VPS | R$ 0 (free tier) – R$ 50/mês | Etapa 12 |
| Domínio | Registro .com.br (Registro.br) | ~R$ 40/ano | Etapa 12 |
| E-mail transacional (token de redefinição) | Resend/Brevo/Mailgun free tier | R$ 0–30/mês | Etapa 12 |
| WhatsApp Cloud API (opcional) | Meta — cobrança por conversa/template | Variável (conversa iniciada ~USD 0,05–0,08) | Só se o módulo for ativado |
| Gateway de pagamento (futuro) | Mercado Pago / Pagar.me / Asaas | Taxa por transação (~1–4%) + mensalidade possível | Etapa 11+ **com aprovação explícita** |
| CI | GitHub Actions (incluso no repositório) | R$ 0 (limites gratuitos) | Etapa 12 |
| Monitoramento | Uptime Kuma self-hosted / free tiers | R$ 0 | Etapa 12 |

---

## Conclusão e próxima etapa

Linha de base sólida: **lint 0 erros · typecheck OK · 380/380 testes
aprovados (executados) · build OK · schema Prisma válido**. A base herdada
pode ser adaptada ao Akylla Gestão sem reescritas; o único módulo novo
confirmado como necessário para o MVP é **AP/AR (Etapa 8)**, além do
enforcement de planos (Etapa 11) e da identidade (Etapa 2).

**Nenhum código de aplicação foi alterado nesta etapa.** Arquivos criados:
`docs/akylla/PLANO_DE_ADAPTACAO.md` (este documento).

**Próxima etapa recomendada: Etapa 2 — Identidade Akylla Gestão**, aguardando
aprovação explícita do proprietário.
