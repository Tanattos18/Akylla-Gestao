# Checklist geral de implementação — Akylla Gestão

> Roteiro: `docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md` (Etapas 0–12).
> Este checklist cobre apenas a era do Akylla Gestão. O histórico
> anterior à adaptação está preservado no Git.

## Transformação: clientes e produtos digitais (2026-10-23)

- [x] 1 Backup: tag `versao-loja-2026-10-23`, ramo `versao-loja`, zip local do código
- [ ] 1b Backup do banco e do env na VPS (proprietário roda `COMO_FAZER_BACKUP_VPS.md`)
- [x] 2 Menu/rotas sem telas de loja (feature flag), textos de clientes e serviços
- [x] 3 Modelo: catálogo digital, entregas por cliente, contrato → entrega, política de atraso (migration aditiva + RLS)
- [x] 4 Telas: Catálogo digital, Entregas, ficha com abas, Contratos, Configurações › Contratos
- [x] 4b Script idempotente `db:seed:akylla` (produtos próprios + Akylla Studio de teste; demos desligáveis)
- [ ] Aplicar na VPS (`update.sh`) e rodar `npm run db:seed:akylla` (proprietário)
- [x] Logins das entregas cifrados (AES-256-GCM), mostrar/ocultar com auditoria
- [x] Monitor de sites (worker, HEAD/GET só leitura a cada 5 min, histórico 30 dias)
- [x] Novo Início: receita recorrente, a receber 30 dias, atrasados, vencimentos, sites fora do ar
- [ ] Pausa real por atraso (só depois de autorizada)

## Correções da auditoria (2026-10-19)

- [x] 1 Dinheiro com vírgula + formatBrl
- [x] 2 E-mail único global (índice, 409) e PlatformGuard com e-mail verificado/empresa dona
- [x] 3 Financeiro só ADMIN; inCash pela forma de pagamento
- [x] 4 Crediário: parcela devolvida REFUNDED (sem estorno em dobro); comissão liberada revertida
- [x] 5 Listas paginadas com total; seletores com busca por digitação
- [x] 6 2FA: erros 400 (sem ir ao login); setup exige senha
- [x] 7 PDV fracionado para KG/L
- [x] 8 Ativação com FOR UPDATE, max(agora, fim pago, fim do teste), meses de calendário
- [x] 9 Servidor: trust proxy loopback, API em 127.0.0.1, runuser, swap 2 GB, checa web, flock, rollback com REF
- [x] 10 Privacidade: contato@akyllagestao.com.br
- [x] 11 Profissionais: "técnicos"
- [ ] Aplicar na VPS (`update.sh`)

## Visual e WhatsApp (2026-10-19)

- [x] Modo claro/escuro (botão no topo, preferência salva, segue o sistema)
- [x] Nova tela Início (saudação, atalhos, módulos por grupo, bloqueio do não contratado)
- [x] WhatsApp: aviso de modo simulação, ajuda do Phone Number ID, guia `docs/akylla/WHATSAPP.md`
- [x] Modelos prontos de templates + edição (texto alterado → nova aprovação) + teste
- [ ] Ligar a API oficial da Meta na VPS (credenciais do proprietário)

## Retirada do módulo Pets (2026-10-19)

- [x] Web: `/pets`, menu, ficha na tela do cliente, coluna da lista, campo da agenda, busca e painel
- [x] API: rotas `/api/pets*` e `/api/clients/:id/pets`; `petId` fora do agendamento; busca sem pets
- [x] Banco: `PETS` fora do enum `BusinessModule`, kits, preços e perfis (migration `20261019180000_remove_pets_module`); tabela `Pet` mantida como legado
- [x] Seeds/demo sem "Mundo Pet"; textos e dados de teste sem vocabulário de pet shop
- [x] Testes ajustados (`pets.test.ts` arquivado); `API.md` e docs atualizados
- [ ] Aplicar na VPS (`update.sh`)

## Fase 8b — Kits de acesso (2026-10-18)

- [x] Schema: `TenantPlan.includedModules/sortOrder`, `TenantSubscription.extraModules`, `PlatformPayment.extraModules`, `ModuleOffer` (migration `20261019150000_module_kits`)
- [x] Acesso = kit ∪ avulsos (`computeAccess.modules`); teste/isenta = todos; `ModuleGuard` → 403 `MODULE_NOT_CONTRACTED`
- [x] `computeComboPrice` (shared, em centavos) usado na API e na web
- [x] Rotas: `GET /api/billing/modules`, `GET /api/platform/catalog`, `PUT /api/platform/plans/:id`, `PUT /api/platform/modules/:module`, `POST /api/platform/companies/:id/modules`; `activate` com `extraModules`
- [x] Web: menu/início escondem não contratados; Configurações › Módulos "Não contratado"; Faturamento com kits e "Monte seu plano"; Plataforma com aba Kits e módulos, botão Módulos e avulsos no Registrar pagamento
- [x] `tests/integration/kits.test.ts` (8) e contrato do `API.md`
- [ ] Aplicar na VPS (`update.sh`) e ajustar os textos de planos do site

## Fase 8 — Cobrança do SaaS (2026-10-18)

- [x] Preços aprovados (mensal e anual) e descrições alinhadas ao site
- [x] Teste grátis no cadastro (`TRIAL_DAYS`), tolerância de 5 dias, somente leitura (402) via `AccessGuard`
- [x] Painel do dono `/plataforma`: empresas, registrar pagamento, +teste, isentar, suspender/reativar, histórico
- [x] `PlatformGuard` (e-mail + ADMIN + 2FA em produção) e tela de 2FA em Configurações › Segurança
- [x] Removida a autoativação/renovação de plano pela empresa (falha de cobrança)
- [x] Faturamento com situação, preço anual e contratação pelo WhatsApp; aviso no topo
- [x] `tests/integration/platform-billing.test.ts` (12) e contrato do `API.md`
- [ ] Mercado Pago em produção (aguarda a conta de vendedor com CNPJ)

## Fase 7 — Produto (2026-10-18)

- [x] 7.1 Dados da empresa (`/api/company`, slug único → 409) + aba Empresa + CNPJ/endereço/telefone no comprovante
- [x] 7.2 Uso do plano com barras, alerta 80% e link para planos maiores
- [x] 7.3 Busca global `GET /api/search` + combobox com teclado
- [x] 7.4 Agenda Dia/Semana/Mês
- [x] 7.5 Seeds por segmento (comercio, servicos, alimentacao, pet)
- [x] 7.6 Impressão de relatórios
- [x] 7.7 Variáveis no `.env.example` (Redis comentado: valor vazio ligaria o cliente)
- [x] Testes: integração (8) + E2E 6 e 7

## Fase 6 — Testes e qualidade (2026-10-18)

- [x] Cobertura na CI (`test:coverage`): 93,7% das linhas de services/controllers; mínimos contra regressão
- [x] E2E Playwright (`test:e2e`): login, cliente, caixa+venda+NFC-e+fechamento, importação CSV, rota protegida
- [x] OpenAPI em `/api/docs` gerado de rotas + schemas Zod + decorators
- [x] Teste de contrato código × `API.md` (12 rotas não documentadas corrigidas)
- [x] Job "Navegador" na CI (axe + E2E)
- [ ] Validação das respostas contra schemas (hoje só entradas vêm do Zod; respostas não têm schema compartilhado)

## Fase 5 — Design e UX (2026-10-18)

- [x] `DataTable` (31 tabelas; carrinho do PDV em lista), `Dialog`/`useDialog` (33 confirm/prompt), `Toast`, `Tabs`
- [x] Tokens semânticos, foco visível, "Pular para o conteúdo", CSS de impressão
- [x] Contraste AA (botões `primary-700`, texto 700+, links sublinhados); barra do topo sem estourar em 1280 px
- [x] `npm run test:a11y` (axe, 36 telas, 0 violações) + job na CI
- [ ] CNPJ no comprovante (depende do cadastro da empresa, Fase 7)

## Fase 4 — Perfis no cadastro (2026-10-18)

- [x] `OnboardingPreset` global + `Company.segment`/`onboardingCompletedAt`; migration aditiva com os 4 perfis e empresas existentes marcadas como concluídas
- [x] API presets/status/apply (ADMIN, idempotente; Comércio prepara fiscal simulado inativo)
- [x] `/onboarding` (após confirmar e-mail), aviso na home, `/configuracoes` com liga/desliga de módulos
- [x] Páginas públicas `/para/comercio`, `/para/servicos`, `/para/hibrido`; `/termos` e `/privacidade` sem login
- [x] `tests/integration/onboarding.test.ts` (8)

## Fase 3 — Fiscal por integração (2026-10-18)

- [x] Regras e pendências (`docs/akylla/FISCAL.md`); FinOpenPOS avaliado (emissor próprio, não integrado; extração de certificado insegura, não reaproveitada)
- [x] `FiscalConfig`/`FiscalDocument` + enums; migration aditiva com RLS
- [x] `FiscalProvider` abstrato; emissora simulada (autoriza/assíncrona/rejeita), chave 44 dígitos com DV mód. 11
- [x] Segredos AES-256-GCM (token, certificado, senha); nunca devolvidos; 503 sem chave
- [x] Certificado A1 validado pelo Node (senha, formato, validade), sem processo externo
- [x] Emissão NFC-e/NF-e (venda) e NFS-e (OS); numeração por série com lock; 409 duplicada; 400 inativo
- [x] Cancelamento com justificativa 15–255; venda com nota ativa não cancela
- [x] Webhook HMAC + anti-replay (5 min) + fail-closed + idempotente
- [x] Telas `/fiscal`, botões no PDV, venda e OS
- [x] `tests/integration/fiscal.test.ts` (17)
- [ ] Integradora real (contrato + adaptador + homologação) e cadastro fiscal dos produtos (proprietário + contador)

## Fase 2 — Retenção (`upgrade/Prompt_Mestre.md` §4) — em andamento

### 2.3 · Ordem de serviço (2026-10-18)

- [x] Regras escritas antes (`docs/akylla/ORDEM_DE_SERVICO.md`); OCA/repair e ERPNext só estudados
- [x] `ServiceOrder`/`ServiceOrderItem`/`ServiceOrderAttachment` + `Commission.serviceOrderId` + `WhatsAppMessage.originId`; migration aditiva com RLS
- [x] Estados estritos (pular → 400; concorrência → 409); número sequencial por empresa
- [x] Itens com preço de catálogo (livre com valor informado); totais no servidor; travados após a aprovação
- [x] Conclusão: baixa de estoque (locks em ordem), conta a receber, comissão (ON_PAYMENT libera ao receber)
- [x] Anexos JPG/PNG/PDF até 5 MB com tipo pelos bytes, nome saneado, caminho só com ids; download seguro
- [x] Histórico de WhatsApp vinculado (`serviceOrderId` no envio)
- [x] Telas `/os`, `/os/nova`, `/os/[id]` (etapas, itens, anexos, mensagens, impressão)
- [x] Backup/RUNBOOK/DEPLOY: anexos fora do dump, volume persistente
- [x] `tests/integration/service-orders.test.ts` (18)

### 2.2 · Crediário (2026-10-18)

- [x] Regras escritas antes (`docs/akylla/CREDIARIO.md`); OCA/ERPNext só estudados
- [x] `CreditAccount`/`CreditInstallment` + `CREDIARIO`/`CREDIT_SALE`/`CREDIT`; migration aditiva com RLS
- [x] Parcelas calculadas no servidor (centavos na última; mensal com último dia do mês); a receber por parcela
- [x] Limite/bloqueio/aprovação com a conta travada (FOR UPDATE, ordem fixa); venda a prazo sem entrada no caixa
- [x] Vencimento marcado na leitura; recebimento via financeiro (caixa aberto) com sincronia nos dois sentidos
- [x] Cancelamento: parcelas em aberto canceladas, devolução só do que foi pago
- [x] Comissão ON_PAYMENT liberada ao quitar a última parcela
- [x] Telas: crediário no PDV (parcelas + 1º vencimento), `/crediario` (carteira, totais, aprovar/bloquear, receber), atalho na ficha do cliente
- [x] `tests/integration/credit.test.ts` (14)

### 2.1 · Comissões (2026-10-18)

- [x] Regras escritas antes do código (`docs/akylla/COMISSOES.md`), referências OCA/ERPNext só estudadas
- [x] Modelos `Professional`, `CommissionRule`, `Commission` + `Sale.professionalId`; migration aditiva com RLS
- [x] Cálculo no servidor: rateio do desconto, precedência produto > categoria > profissional > padrão > geral, arredondamento único
- [x] Liberação gera conta a pagar (`COMMISSION`); pagamento via financeiro (caixa aberto); sincronia nos dois sentidos
- [x] Cancelamento da venda: comissão cancelada; se já paga, conta a receber (`COMMISSION_REVERSAL`)
- [x] Módulo opcional `COMMISSIONS` (403 desativado); ADMIN para escrita; isolamento A×B
- [x] Telas `/profissionais`, `/comissoes` (fechamento por profissional, itens, liberar/pagar), `/comissoes/regras`; profissional no PDV e no detalhe da venda
- [x] `tests/integration/commissions.test.ts` (19)

## Fase 1 — Confiabilidade (`upgrade/Prompt_Mestre.md` §4) — em andamento

### 1A · Backup com restore testado (2026-10-18)

- [x] `scripts/db-backup.mjs`: `pg_dump --format=custom --compress=6`,
      nome `akylla_YYYY-MM-DD_HHmm.dump`, `BACKUP_DIR`, `RETENTION_DAYS`
- [x] Restore em banco efêmero com validação (contagem de linhas,
      migrations, `prisma migrate diff`) e remoção garantida do efêmero
- [x] Log em `<BACKUP_DIR>/backup.log`; exit ≠ 0 em falha
- [x] `npm run db:backup` e `npm run db:restore-test`
- [x] `backup/README.md`: cron `0 2 * * *`, retenção, offsite S3/B2,
      RPO ≤ 24 h, RTO ≤ 4 h
- [x] `tests/integration/backup.test.ts` (7 testes)
- [x] Evidência: `npm run db:backup` no banco de dev — 31 tabelas,
      16 migrations, restore validado
- [ ] Agendamento + offsite + alerta no servidor de produção (depende
      da hospedagem)
- [x] CHANGELOG/STATUS registram N1–N4c

### 1B · Monitoramento (2026-10-18)

- [x] Sentry na API (`instrument.ts` antes do Nest; 5xx via `AllExceptionsFilter`; falha de boot)
- [x] Sentry no worker (erros de ciclo/provedor/boot, tag `stage`)
- [x] Sentry no web (`instrumentation.ts`, `instrumentation-client.ts`, `error.tsx`, `global-error.tsx`)
- [x] Sem PII: `dataCollection` mínimo + `scrubEvent` (cookies, corpo, query, headers, e-mail/IP, variáveis locais)
- [x] Desligado sem DSN (dev/teste/CI)
- [x] `GET /health/ready` (banco, 503 sem detalhes) para o UptimeRobot
- [x] `npm run monitoring:test` (alerta de teste)
- [x] `docs/operations/RUNBOOK.md` (Sentry, UptimeRobot, incidentes, rollback, restauração, rotina)
- [x] `tests/integration/monitoring.test.ts` (8 testes)
- [ ] Contas Sentry/UptimeRobot criadas e alertas de teste registrados (RUNBOOK §9)

### 1C · Rate limit distribuído (2026-10-18)

- [x] `RedisRateLimitStore` (rate-limiter-flexible + ioredis), chave `akylla:rl:<limite>:<janela>:<chave>`
- [x] `REDIS_URL` ausente → memória; presente → Redis (`createRateLimitStore`)
- [x] Redis fora do ar → limitador em memória assume (insurance), sem 500 e sem esperar timeout
- [x] Interface assíncrona; login, cadastro, reset e 2FA com `await`
- [x] `tests/integration/rate-limit.test.ts` (10 testes)
- [ ] Redis provisionado em produção (Upstash/Railway/Render) — depende do 1G

### 1D · Cadastro anti-abuso (2026-10-18)

- [x] Empresa do cadastro nasce `PENDING_VERIFICATION`; sem sessão até confirmar
- [x] `POST /api/auth/verify-email` (uso único, 24 h, ativa a empresa e abre a sessão)
- [x] `POST /api/auth/resend-verification` (resposta idêntica; invalida links antigos)
- [x] Login pendente → 403 `EMAIL_NOT_VERIFIED`; senha errada continua 401 genérico
- [x] Rate limit do cadastro conta também os sucessos
- [x] Turnstile opcional (falha fechada) — web + API
- [x] SMTP via nodemailer (`SmtpMailProvider`); sem SMTP → log (link omitido em produção)
- [x] Produção exige `SMTP_HOST` para subir com `REGISTRATION_ENABLED=true`
- [x] Migration `20261018090000_email_verification` + `DATABASE.md`
- [x] Telas: `/cadastro` (aguardando confirmação + reenviar), `/confirmar-email`, aviso no `/login`
- [x] `tests/integration/email-verification.test.ts` (12) + `register.test.ts` atualizado
- [x] Fluxo testado no navegador (cadastro → link → painel)
- [ ] SMTP e Turnstile de produção configurados (contas do proprietário)

### 1E · RLS nativa (2026-10-18)

- [x] Migration `20261018120000_row_level_security`: ENABLE + FORCE + `tenant_isolation` em 25 tabelas
- [x] `rlsExtension` + `withRlsTransactions` (contexto por transação; atomicidade preservada)
- [x] `systemDatabaseUrl()` no worker e na CLI; backup com `PGOPTIONS` + `--enable-row-security`
- [x] `tests/integration/rls.test.ts` (16), incluindo o caminho HTTP pelo interceptor
- [x] Suíte inteira verde com RLS ativa; backup/restore validado com RLS no banco de dev
- [x] ADR-0001, DATABASE.md, RUNBOOK e AGENTS.md (regra permanente)
- [ ] Produção: role da aplicação sem SUPERUSER/BYPASSRLS (conferir ao provisionar, junto com o 1G)

### 1F · Vulnerabilidades (2026-10-18)

- [x] nodemailer 8.0.11 → 10.0.16 (alta, introduzida no 1D) — commit próprio
- [x] Next 15.5.28 → 16.4.2 (postcss, alta) — build Turbopack sem avisos; testado em execução real
- [x] vitest 2 → 4.1.11 (tinypool crítica, vite/esbuild/mocker) — config sem mudanças
- [x] `npm audit --omit=dev` = **0**
- [x] Risco aceito registrado: `sprintf-js` (moderada, só teste, via `ioredis-mock`, sem correção)

### 1G · Deploy (2026-10-18)

- [x] CI corrigida (vermelha desde N1): `postinstall` gera o Prisma Client; `check:migrations` com shadow DB e `--exit-code`; `db:deploy` no lugar de `db:migrate`; role `akylla_app` sem SUPERUSER/BYPASSRLS (RLS ativa nos testes); Node 22
- [x] `cd.yml`: depois do CI verde → migrations → deploy hooks (API/worker/web) → health check (`/health/ready` + `/login`); environment `production` com aprovação; travado por `DEPLOY_ENABLED`
- [x] Proxy do web configurável (`API_INTERNAL_URL` no build); API aceita `PORT` do provedor; `engines.node >=20.9`
- [x] `docs/operations/DEPLOY.md` (peças, role do banco, comandos, variáveis, GitHub, checklist pós-deploy); rollback no RUNBOOK §5
- [ ] Escolher provedor, criar serviços, configurar secrets e fazer o primeiro deploy (proprietário)

### Pendentes da Fase 1


## Fora do roteiro — Débitos de design D-1 a D-7 (2026-10-15)

Concluída. Lote "uma tarde" de `upgrade/MELHORIAS_DESIGN.md` §0 — só
frontend (`apps/web`); nenhum backend, teste ou migration alterado.

- [x] **D-1** `--color-foreground: #0f172a` no `@theme` (`globals.css`)
      — antes `var(--foreground)` referenciava variável inexistente
- [x] **D-2** `--font-sans: var(--font-inter), ...` — antes usava a
      string literal `"Inter"` e ignorava a variável do `next/font`
- [x] **D-3** bloco `.sidebar-scroll` removido. Tokens
      `--color-sidebar*` **preservados** (inspeção mostrou uso ativo na
      topbar escura, apesar do catálogo listá-los como mortos)
- [x] **D-5** `loading.tsx` + `error.tsx` + `not-found.tsx` criados em
      `apps/web/src/app/`, reaproveitando `Skeleton.tsx`
- [x] **D-7** contraste: **7 ocorrências** de texto em stop < 700
      corrigidas; **3 preservadas de propósito** (`Header.tsx:712`
      sobre topbar escura; `StatCard.tsx:8,10` = cor de ícone, passa
      3:1 de WCAG 1.4.11)
- [ ] **D-4** e **D-6** — **pendentes**; dependem do componente
      `Table` (§2.1 do catálogo), lote "uma semana"

Verificado com `npm run validate` verde (lint · typecheck · 538/538 ·
build · db:validate).

## Fora do roteiro — Documentação técnica consolidada (2026-10-14)

Entregue. `docs/AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md` atualizado de
841 → **1503 linhas**, 23 → **29 seções**, como fonte única para
leitura por IA.

- [x] §1 e cabeçalho com estado corrente (538/538, 26/28/32/39/13)
- [x] §1.1 resumo executivo para primeira leitura
- [x] §2 árvore do monorepo + todos os comandos + tabela CI/CD
- [x] §17 o que os testes **não** cobrem (frontend/navegador)
- [x] §21 pendências reorganizadas por severidade, com ponteiro de
      solução
- [x] §24 importação de planilhas (rotas, fluxo, segurança, tela)
- [x] §25 entregas fora do roteiro (5, com commits)
- [x] §26 catálogo de melhorias P0–P3 (29 ideias)
- [x] §27 catálogo de design (D-1..D-7 + contraste WCAG medido)
- [x] §28 plano do primeiro cliente (semanas 1–3 + go/no-go)
- [x] §29 mapa de documentos + regras permanentes
- [x] numeração §1–§23 preservada (referenciada por 5 arquivos)

## Fora do roteiro — Plano: primeiro cliente pagante (2026-10-14)

**Aguardando autorização** (regra 2 do `AGENTS.md`). Documento de
plano criado; **nenhum item executado**.

Plano em [`CHECKLIST_PRIMEIRO_CLIENTE.md`](CHECKLIST_PRIMEIRO_CLIENTE.md)
— 3 semanas até o primeiro cliente pagante, com itens obrigatórios,
comandos concretos e critério de aceite **go/no-go**.

- [ ] **Semana 1 — Poder hospedar**: definir hosting · fechar o
      `cd.yml` (substituir os placeholders em `cd.yml:40` e `:75`) ·
      `pg_dump` agendado **com restore testado** · Sentry + uptime
- [ ] **Semana 2 — Poder confiar**: `next`→16.4.1 e `vitest` (zerar
      `npm audit --omit=dev`) · endpoint LGPD de anonimização
      (`apps/api/src/lgpd/`) · D-7 contraste do design · termos de uso
      e política de privacidade
- [ ] **Semana 3 — Poder cobrar**: E2E real do Mercado Pago em sandbox
      (assinatura `ACTIVE` por pagamento real) · seed neutro ·
      roteiro comercial de migração ensaiado
- [ ] **Critério de aceite final (go/no-go)** no próprio checklist:
      9 verificações, todas obrigatórias

Fora de escopo deste plano (exige decisão nova): cobrança recorrente
em produção, RLS, multi-instância/Redis, dark mode, funcionalidades
novas.

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
