# Status do projeto — Akylla Gestão

## Etapa atual

**Evolução — roteiro `upgrade/Prompt_Mestre.md`, FASE 1 (Confiabilidade)
em andamento** (desde 2026-10-18). Objetivo do proprietário: entregar o
que o site akyllagestao.com.br promete. Fases em ordem rígida (1 → 7).

| Item da Fase 1 | Status |
|---|---|
| 1A · Backup com restore testado (§1.1) + registro de N1–N4c nos docs | ✅ 2026-10-18 |
| 1B · Sentry (API/Worker/Web) + `RUNBOOK.md` (uptime, rollback) (§1.2) | ✅ 2026-10-18 (código); alertas de teste aguardam contas Sentry/UptimeRobot |
| 1C · Rate limit com Redis + fallback em memória (§1.5.2) | ✅ 2026-10-18 (código); Redis de produção a provisionar |
| 1D · Verificação de e-mail no cadastro + Turnstile opcional (§1.5.5) | ✅ 2026-10-18 (código); SMTP de produção a contratar |
| 1E · RLS no PostgreSQL + `withTenantContext` (§1.5.4) | ⬜ |
| 1F · `npm audit --omit=dev` = 0 (next 16, vitest major) (§1.5.1) | ⬜ |
| 1G · CD real com health check (§1.3) — depende da escolha de hospedagem | ⬜ |

Já existentes antes da Fase 1 (N1–N4c, 2026-10-15): LGPD
(consentimento/exportação/anonimização), reset de senha por token, 2FA
ADMIN, webhook MP com timing-safe + anti-replay + fail-closed, guard ORM
de tenant (ADR-0001), rate limit de cadastro. Detalhes no CHANGELOG.

Itens fora de uso (inclusive o trabalho não commitado da Fase 6 —
cobertura, Playwright, `concurrency.test.ts`, ajustes de CI/CD, salvo
como arquivos + `alteracoes-rastreadas.patch`) foram movidos em
2026-10-18 para `Arquivos Sem USO/` (local, ignorado pelo Git). Nada foi
apagado.

### Roteiro anterior

**Roteiro Akylla Gestão (Etapas 0–12) — CONCLUÍDO** (2026-10-12).

A Etapa 12 (Qualidade, segurança e preparação para produção) é a última
do roteiro `docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md`. Entregas:

- **Entregável**: `docs/akylla/CHECKLIST_PRE_PRODUCAO.md` — evidências
  de qualidade (lint 0 · typecheck OK · **509/509 testes** · build OK ·
  db:validate OK), revisão de segurança, limitações conhecidas (L1–L14),
  ambientes, env vars, estimativa de custos e checklist pré-comercial.
- **Decisão recomendada**: **não declarar pronto para produção** —
  faltam backups com restore testado, LGPD, CD/deploy real, monitoramento,
  E2E Mercado Pago e resolução de vulnerabilidades de dev-dependencies.
  (CI no GitHub Actions foi adicionada depois, em 2026-10-14.)
- Validações: `lint` 0 → `typecheck` OK → **509/509 testes** → `build`
  OK → `db:validate` OK. Commit + push por etapa.

### Roteiro completo (Etapas 0–12)

| Etapa | Tema | Status |
|---|---|---|
| 0 | Diagnóstico do repositório | ✅ |
| 1 | Migração e linha de base | ✅ |
| 2 | Identidade Akylla Gestão | ✅ |
| 3 | Auditoria multiempresa | ✅ |
| 4 | Núcleo genérico | ✅ |
| 5 | Cadastro, clientes e fornecedores | ✅ |
| 6 | Produtos, categorias e estoque | ✅ |
| 7 | Vendas e recebimentos | ✅ |
| 8 | Financeiro básico | ✅ |
| 9 | Dashboard e relatórios | ✅ |
| 10 | Módulos específicos de pet shop | ✅ |
| 11 | Planos e assinatura SaaS | ✅ |
| 12 | Qualidade, segurança e produção | ✅ |

### Próximos passos (fora do roteiro — requerem autorização)

> **Documento técnico consolidado (2026-10-14):**
> `docs/AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md` — **29 seções,
> 1503 linhas**, fonte única para leitura por IA. Além das 23 seções
> originais, incorpora: importação de planilhas (§24), entregas fora
> do roteiro (§25), catálogo de melhorias P0–P3 (§26), catálogo de
> design com 7 débitos medidos e tabela de contraste WCAG (§27), plano
> do primeiro cliente com critério go/no-go (§28) e mapa de documentos
> (§29). Numeração §1–§23 preservada (referenciada externamente).
>
> **Catálogos de decisão (2026-10-14):** `upgrade/MELHORIAS.md` (29
> ideias de backend/segurança/operação/produto) e
> `upgrade/MELHORIAS_DESIGN.md` (design + 7 débitos medidos no
> frontend). Prioridades P0–P3 e sequência sugerida estão lá; nada
> entra em execução sem decisão do proprietário.
>
> **Plano de execução proposto:**
> `docs/operations/CHECKLIST_PRIMEIRO_CLIENTE.md` — 3 semanas até o
> primeiro cliente pagante (hospedar → confiar → cobrar), com itens
> obrigatórios, comandos concretos e **critério de aceite go/no-go**.
> Aguarda autorização para iniciar.

1. Concluir checklist do `CHECKLIST_PRE_PRODUCAO.md` §7 (backups,
   LGPD, CD/deploy real, monitoramento, vitest upgrade, E2E Mercado
   Pago);
2. Definir ambiente de produção (hosting + domínio + TLS);
3. Deploy de staging → E2E sandbox Mercado Pago → aprovação →
   produção restrita (pilotos).

## Entrega fora do roteiro — Débitos de design D-1 a D-7 (2026-10-15)

**Concluída.** Primeira alteração de código desde a Etapa 12 — só
frontend (`apps/web`); nenhum backend, teste ou migration alterado.
Executa o lote "uma tarde" de `upgrade/MELHORIAS_DESIGN.md` §0, que o
catálogo classifica como correção de débito (executável sem design
review).

| Débito | O que era | Resultado |
|---|---|---|
| **D-1** | `color: var(--foreground)` — variável nunca definida; a cor do texto caía no default do browser | token `--color-foreground: #0f172a` no `@theme` |
| **D-2** | `--font-sans` usava a string literal `"Inter"`; a variável `--font-inter` do `next/font` era injetada e nunca lida | `var(--font-inter), ui-sans-serif, ...` |
| **D-3** | bloco `.sidebar-scroll` morto desde a topbar | removido. Tokens `--color-sidebar*` **preservados** (usados pela topbar escura) |
| **D-5** | nenhum `loading.tsx`/`error.tsx`/`not-found.tsx` | os 3 criados, reaproveitando `Skeleton` |
| **D-7** | contraste reprovado: `text-amber-500`=2.15, `text-amber-600`=3.19 (AA exige 4.5) | **7 ocorrências** de texto viraram stop 700; 3 preservadas por não serem violação |

**Preservados de propósito:** `Header.tsx:712` (`text-primary-400`
sobre a topbar **escura** — contraste alto, correto) e
`StatCard.tsx:8,10` (**cor de ícone**, 3.19:1, acima do mínimo 3:1 de
WCAG 1.4.11 para componentes não-texto).

**Restam D-4 e D-6** — dependem do componente `Table`
(`MELHORIAS_DESIGN.md` §2.1), lote "uma semana".

Verificado: `npm run validate` verde (lint · typecheck · **538/538** ·
build · `db:validate`).

## Entrega fora do roteiro — Catálogo de melhorias e pasta de backup (2026-10-14)

**Concluída** (terceira entrega única autorizada). Nenhum código de
aplicação alterado; nenhuma ideia executada — a entrega é a **base de
decisão** para a evolução do produto.

- **`upgrade/MELHORIAS.md`** — 29 ideias em 6 categorias (segurança e
  compliance, operação e resiliência, desempenho e escala, qualidade e
  testes, produto e UX, plataforma e DX). Cada uma com função, o que
  melhora no Akylla (referenciando limitação L1–L14 ou arquivo real),
  ponto de partida e prioridade P0–P3. Inclui tabela-resumo e
  sequência sugerida.
- **`upgrade/MELHORIAS_DESIGN.md`** — design de interface: tokens
  semânticos, componentes, movimento/JS, acessibilidade,
  responsividade, estados (loading/erro/vazio), dados e visualização,
  performance percebida e impressão. Regras de ouro: servidor manda ·
  dinheiro não otimiza UI · acessível por padrão ·
  `prefers-reduced-motion`.
- **`backup/README.md`** — estrutura e regras de cópias de segurança
  locais (dump/restore, drill obrigatório, nada sensível no Git).
  Responde parcialmente à lacuna L8, ainda pendente para produção.
- **7 débitos medidos no frontend (D-1 a D-7):** `--foreground`
  indefinida, variável de fonte órfã, CSS morto de sidebar, 32 tabelas
  inline, ausência de `loading/error/not-found`, primitivos faltando
  (`Table`/`Modal`/`Select`/`Toast`) e **contraste reprovado** em 3
  pares de cor (2.15, 2.49 e 3.19 contra o mínimo AA 4.5), em 194
  usos.
- **`.gitignore`**: `/backup/*` ignorado com exceção do README
  (verificado com dump simulado).
- Verificações: 33 arquivos `.md` / 60 links (0 quebrados) e UTF-8
  validado nos arquivos novos. `npm run validate` mantido verde da
  entrega anterior (esta entrega não tocou código).

## Entrega fora do roteiro — Importação de planilhas (2026-10-14)

**Concluída** (tarefa autorizada; plano e decisões D1–D8 em
`docs/akylla/PLANO_IMPORTACAO.md`).

- **Entregável**: importação de CSVs para as 5 entidades (categorias,
  fornecedores, produtos com estoque inicial, clientes e serviços) via
  `/importacoes` — modelo CSV, dry-run, skip de duplicatas, checagem de
  limites de plano e histórico `ImportBatch`.
- **Migration**: `20261014114855_import_batch` (aditiva) aplicada nos
  ambientes de dev e teste.
- Validações: `lint` → `typecheck` → **538/538 testes** (509 + 29 de
  `tests/integration/imports.test.ts`) → `build` → `db:validate`. Sem commit até
  autorização do proprietário.

## Entrega fora do roteiro — Reorganização estrutural (2026-10-14)

**Concluída** (tarefa autorizada pelo proprietário como entrega única).

- **Nova estrutura de raiz**: `config/` (ESLint + Vitest), `scripts/`
  (`setup:dev`, `db`, `validate`), `tests/helpers/` + `tests/integration/`,
  `.github/` (CI + Dependabot) e `.env.example` unificado (removido
  `.env.local.example`).
- **Correções**: imports relativos dos 24 arquivos de
  `tests/integration/` (a migração anterior os tinha quebrado),
  `needs: [ci]` inválido no `cd.yml`, `.gitignore` agora cobre `.env.*`
  (exceto `.env.example`).
- **Código da API**: `@petflow/whatsapp` declarado em
  `apps/api/package.json`; `login-rate-limit.ts` (nomenclatura);
  `common/utils/client-name-key.ts` (elimina import cruzado
  whatsapp → clients); `tenant-limits/` como módulo próprio (não mais
  dentro de `billing/`); `node:crypto` padronizado;
  `MockMercadoPagoProvider` movido para `tests/helpers/` (fora do build).
- **Documentação**: caminhos de teste atualizados em 14 documentos;
  `database/README.md` (13 migrations, última `import_batch`);
  `PLANO_IMPORTACAO.md` indexado; CI documentada; scripts novos no
  `README.md` e em `DEVELOPMENT.md`.
- Validações: `lint` → `typecheck` → **538/538 testes** → `build` →
  `db:validate`. Stage sem commit até autorização.

## Entrega fora do roteiro — Documentação: erros factuais e banners (2026-10-14)

**Concluída** (segunda entrega única autorizada). Auditoria da
documentação; nenhum código de aplicação alterado. Detalhe completo em
`CHANGELOG.md`.

- **Erros factuais corrigidos** nos documentos de estado atual:
  `API.md` (seção Financial inexistente; webhook, templates e consents
  com rotas que não existem), `DATABASE.md` (`STAFF` → `MEMBER`),
  `ARCHITECTURE.md` (worker descrito como stub), `DEVELOPMENT.md`,
  `PROJECT_STATUS.md`, `README.md` ("12 etapas" → **Etapas 0–12, 13
  etapas**), `CHECKLIST_PRE_PRODUCAO.md` e
  `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md` (contagens 538/538 em 24
  arquivos, 13 migrations, 39 páginas, upload de planilhas documentado).
- **Achado novo**: `npm audit --omit=dev` tem **2 vulnerabilidades em
  produção** (`postcss`/`next`, alta) — a doc dizia "todas em
  dev-dependências".
- **Redução de duplicação**: `PROJECT_STATUS.md` é a fonte única das
  contagens correntes; `docs/README.md` reorganizado (produto sempre
  atual × entregáveis de etapa, sem item duplicado).
- **Banners de obsolescência** em 9 entregáveis datados
  (`PLANO_IMPORTACAO`, `PLANO_DE_ADAPTACAO`, `MAPA_DE_MODULOS`,
  `MODELO_FINANCEIRO`, `PDV`, `PLANO_BILLING`, `AUDITORIA_MULTIEMPRESA`,
  `PLANO_MODULARIZACAO`, `REDESIGN_PAINEL`).
- **Rename**: `akylla_gestao_diretrizes_opencode.md` →
  `AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md` (+ 7 referências; banner
  indicando que o §10 foi superado pelo roteiro 0–12).
- Verificações: 51 links relativos (0 quebrados) e `npm run validate`
  completo — lint OK · typecheck OK · **538/538** · build OK ·
  db:validate OK.

## Entregas por etapa (jornada Akylla Gestão)

Sequência executada entre 2026-10-12 e 2026-10-13 conforme
`docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md`, com relatório por etapa e
parada obrigatória antes das Etapas 10, 11, 12 e de qualquer migration
(sem aprovação prévia). Documentos de controle em `docs/akylla/`.

- **Etapa 0** — diagnóstico somente leitura:
  `docs/akylla/DIAGNOSTICO_INICIAL.md`.
- **Etapa 1** — plano + linha de base:
  `docs/akylla/PLANO_DE_ADAPTACAO.md`; verificação completa executada
  (lint 0, typecheck OK, testes aprovados, build OK, `db:validate` OK);
  nenhum schema/banco/migration alterados.
- **Etapa 2** — identidade Akylla Gestão:
  `docs/akylla/IDENTIDADE_E_NAVEGACAO.md`; marca, textos, CSV e moeda do
  comprovante adaptados; identificadores internos e módulos preservados.
- **Etapa 3** — auditoria multiempresa e permissões:
  `docs/akylla/AUDITORIA_MULTIEMPRESA.md` + `tests/integration/tenancy-audit.test.ts`
  (+56 cenários A×B); **nenhuma falha de isolamento ou autorização
  confirmada**; nenhum código de produção alterado.
- **Etapa 4** — definição do núcleo genérico (apenas análise e
  documentação): `docs/akylla/MAPA_DE_MODULOS.md`; matriz de 23 itens
  nas 4 categorias aprovadas; **aprovada pelo proprietário**.
- **Etapa 5** — cadastros, clientes e fornecedores: busca de
  fornecedores ampliada; +6 testes (opcionalidade de CPF/documento e
  preservação de histórico na inativação).
- **Etapa 6** — produtos, categorias e estoque: correção do filtro
  `lowStock` (exigir `minimumStock > 0`); +2 testes.
- **Etapa 7** — vendas e recebimentos: fluxo validado sem alteração de
  código; entregável `docs/akylla/LIMITACOES_VENDAS.md` com 9
  limitações explícitas; caixa por turno mantido (decisão).
- **Etapa 8** — financeiro básico (AP/AR): entregável
  `docs/akylla/MODELO_FINANCEIRO.md`; decisões D1–D4 aprovadas;
  modelo `FinancialEntry` + módulo `apps/api/src/financial` + UI
  `/financeiro` com abas Resumo | A pagar | A receber; +30 testes.
- **Etapa 9** — dashboard e relatórios: entregável
  `docs/akylla/DICIONARIO_INDICADORES.md`; agregação 100% server-side,
  remoção dos indicadores de nicho, CSV reforçado; +3 testes.
- **Etapa 10** — módulos específicos de pet shop: nenhuma exclusão;
  `docs/akylla/PLANO_MODULARIZACAO.md`; **opção B aprovada** — tabela
  `CompanyModule` + `ModuleGuard` (403 no servidor) + API
  `/company-modules`; +13 testes.
- **Etapa 11** — planos e assinatura SaaS:
  `docs/akylla/PLANO_BILLING.md`; decisões D1–D4 (planos seed,
  limites de uso, enforcement só com assinatura ACTIVE, Mercado Pago
  sandbox com checkout + webhook HMAC idempotente);
  `TenantPlan.userLimit/clientLimit/productLimit` via migration;
  +19 testes (`tenant-limits` 7, `mercadopago` 12).
- **Etapa 12** — qualidade, segurança e produção:
  `docs/akylla/CHECKLIST_PRE_PRODUCAO.md` (evidências, revisão de
  segurança, limitações L1–L14, ambientes, custos, checklist
  pré-comercial).

### Modelo operacional aprovado

- Execução contínua com relatório por etapa; parada obrigatória antes
  das Etapas 10, 11, 12 e de qualquer migration; commit + push por
  etapa; "configurações da empresa" definida para a Etapa 12 (Decisão
  D1).

## Testes e verificações

| Verificação | Comando | Resultado |
|---|---|---|
| Schema Prisma válido | `npm run db:validate` | OK |
| Lint | `npm run lint` | OK (0 erros) |
| Typecheck | `npm run typecheck` | OK (workspaces `apps/*`) |
| Testes (PostgreSQL real) | `npm test` | **614/614 aprovados** (33 arquivos; 2026-10-18) |
| Build | `npm run build` | OK (shared, whatsapp, api, web, worker) |
| Varredura de segredos | grep de credenciais | sem achados reais |
| Seed de demonstração | `db:seed:demo` + script de integridade | OK (INTEGRIDADE OK) |

Cobertura por área: autenticação, cadastro e redefinição de senha,
catálogo, estoque, vendas/PDV, caixa, financeiro (AP/AR), clientes,
pets, serviços, WhatsApp (config, templates, consentimento, fila,
webhooks), agenda/lembretes, assinaturas de clientes, billing do SaaS
(Mercado Pago), relatórios/CSV, tenancy (auditoria A×B) e módulos por
empresa (`CompanyModule`).

## Pendências conhecidas

- **Limitações de produto (L1–L14)**: lista completa e canônica em
  `docs/akylla/CHECKLIST_PRE_PRODUCAO.md` §3 — inclui dev-dependências
  vulneráveis, rate limit em memória, ausência de RLS/LGPD/backups/
  monitoramento, seed ainda temático de pet shop e cobrança recorrente
  não ativada. CI existe (`.github/workflows/ci.yml`), mas o CD ainda é
  placeholder.
- **Pré-comercial (§7 do mesmo checklist)**: backups com restore
  testado, LGPD, CD/deploy real (hosting + secrets), monitoramento,
  E2E Mercado Pago.
- Credenciais reais da Meta (`WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`) só no `.env` local —
  provisionamento em produção é decisão explícita do proprietário.
- Webhook Meta exige URL pública (ngrok/túnel/domínio) — fora do
  ambiente local.
- Botões interativos e mídia (imagem/áudio/documento) — camada de
  provedor suporta payload `components`; UI de mídia fica para etapa
  futura se necessário.
- Entrega de mensagens fora de horário/janela de 24h da Meta (template
  vs. sessão) — validação server-side por `hasPendingSession` está
  registrada; revisar política da Meta na publicação.
- Validação de dígitos verificadores de CPF/CNPJ (hoje CPF valida
  apenas 11 dígitos) — avaliar em etapa avançada.
- Duplicidade de clientes: janela de corrida aceita (sem unique duro de
  `nameKey`).
- Itens de serviço em vendas/PDV: continua fora; venda de serviço
  segue pelo catálogo de produtos (decisão registrada).
- Agenda: visão por dia apenas (semana/mês, recorrência, profissionais
  e horário de funcionamento ficam para etapa futura).
- Lembretes: antecipação fixa por empresa (sem janela de silêncio por
  cliente nem lembrete de confirmação pós-atendimento).
- Gráficos avançados (biblioteca, tooltips, zoom): introduzir
  dependência só quando houver necessidade real — hoje barras CSS
  atendem.
- Estoque negativo nunca é permitido por padrão; backorder seria
  decisão explícita.
- Formas de pagamento configuráveis além de
  Dinheiro/Cartão/Pix/Outro.
- Vendas antigas sem `cashSessionId`/lançamento de caixa ficam fora do
  financeiro — limitação de dados de desenvolvimento.
- CSV de caixa, clientes e WhatsApp: não implementado (opcional no
  escopo; JSON cobre os casos).
- **Billing SaaS**: escrita do catálogo global `TenantPlan` não
  exposta via API (exige papel de plataforma); enforcement de limites
  ativo apenas para empresas com assinatura `ACTIVE` (decisão D3).
- **Assinaturas de clientes**: pagamento sempre em Dinheiro no caixa
  (sem escolha de método/cartão); renovação manual, sem cobrança
  recorrente automática; assinatura de cliente não tem edição de
  campos (cancelar + criar nova, decisão registrada).
- **Redefinição de senha pelo painel**: fluxo local sem token de e-mail
  (flag `PASSWORD_RESET_ENABLED` + rate limit) — em produção, manter a
  flag desabilitada e implementar redefinição com token enviado por
  e-mail.
- **Cadastro aberto**: cria tenant sem verificação de e-mail nem
  anti-abuso além do rate limit por IP (flag `REGISTRATION_ENABLED`) —
  em produção, avaliar verificação de e-mail/captcha antes de habilitar.
- UI `/faturamento` exibindo limites do plano atual e uso (backend já
  expõe campos).
- Deploy/CD (contínuos; a CI existe desde 2026-10-14).

## Identificadores técnicos legados (compatibilidade)

Mantidos no código por decisão registrada e documentados como
compatibilidade técnica — **não são a marca do produto**:

- Pacotes `@petflow/*` (api, web, worker, shared, whatsapp, config);
- Cookie de sessão `petflow_session`;
- Bancos `petflow` (dev) e `petflow_test` (testes);
- `service: "petflow-api"` no payload de `/health`;
- Prefixo de comprovante `PF-`.

Renomeá-los exige etapa dedicada com plano de migração (sessões abertas,
imports, asserts de teste).

## Git

- Branch: `main`; remoto: `origin` →
  `https://github.com/Tanattos18/Akylla-Gestao.git`.
- O histórico do Git deste repositório começa na importação da base
  técnica que deu origem ao produto; o histórico anterior não foi
  preservado (squash na importação).

## Próxima etapa autorizada

**Nenhuma — o roteiro das Etapas 0–12 está concluído.** Próximos
passos possíveis (aguardando decisão do proprietário): pendências acima
(deploy/CD, enforcement de billing, gateway de pagamento, recorrência
automática, verificação de e-mail e anti-abuso no cadastro),
continuidade das atualizações/testes ou novas funcionalidades fora do
roteiro.
