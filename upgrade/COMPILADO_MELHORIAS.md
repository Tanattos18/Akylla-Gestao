# Compilado de melhorias — Akylla Gestão

**Papel deste arquivo:** reúne, em um único documento, **todas** as ideias
de upgrade levantadas para o Akylla Gestão, **organizadas em níveis de
implementação** (ordem de execução). Cada ideia traz **(a)** o que ela
é/faz, **(b)** o que ela melhora **neste projeto** e **(c)** a prioridade
sugerida. No fim há resumo por prioridade e o mapa de níveis.

**Não é um plano aprovado** — é um catálogo consolidado para decisão do
proprietário. Nada aqui deve ser executado sem autorização (regra 2 do
`AGENTS.md`). Ao aprovar uma ideia, mover para a seção "Fora do roteiro"
de `docs/operations/IMPLEMENTATION_CHECKLIST.md`, executar e registrar em
`CHANGELOG.md`/`PROJECT_STATUS.md`.

---

## Fontes consolidadas

| Arquivo | Autor | Foco | Estado |
|---|---|---|---|
| `upgrade/MELHORIAS.md` | catálogo oficial do projeto | backend, segurança, operação, infra, produto (29 ideias) | base de decisão vigente |
| `upgrade/MELHORIAS_DESIGN.md` | catálogo oficial do projeto | design de interface (tokens, componentes, a11y) + débitos D-1…D-7 | base de decisão vigente |
| `upgrade/GPT_AKYLLA_GESTAO_AUDITORIA_E_PLANO_DE_MELHORIAS.md` | auditoria externa (GPT) | auditoria técnica + plano de SaaS comercial (48 seções) | análise documental |
| `upgrade/GEMINI_plano_de_transforma_o_comercial_e_roadmap_t_cnico_saas.md` | análise externa (Gemini) | viabilidade + matriz de priorização P0–P3 | análise documental |
| `upgrade/deepseek_markdown_20261015_741130.md` e `… v2.md` | análise externa (DeepSeek) | plano de transformação em SaaS comercial (infra, segurança, comercial, roadmap) | análise documental |

> **Nota de convergência:** as três análises externas e os dois catálogos
> oficiais **convergem** no mesmo diagnóstico — o produto é tecnicamente
> sólido (538 testes, multiempresa, trilha de auditoria), mas **não está
> pronto para produção paga**. Os bloqueadores são os mesmos: backup +
> restore, LGPD, deploy real, monitoramento e E2E do Mercado Pago.

---

## Legenda de prioridade

| | Significado |
|---|---|
| **P0** | bloqueia produção / risco de dados, segurança ou cobrança |
| **P1** | necessário antes de escalar, confiar na operação ou vender |
| **P2** | valor claro; fazer após estabilizar |
| **P3** | exploratório / quando houver demanda |

---

## Mapa de níveis (ordem de implementação)

| Nível | Objetivo | Itens | Critério de conclusão |
|---|---|---|---|
| **N1 — Fundação segura** | nenhum dado de cliente entra sem proteção | 1.1 · 1.2 · 1.11 · 3.1 · 3.2 · 9.7 | go/no-go de dados/segurança verde |
| **N2 — Operação e observabilidade** | colocar no ar e enxergar falhas | 2.1 · 2.2 · 2.6 · 8.2 · 3.3 · 3.4 | deploy repetível + alertas + runbooks |
| **N3 — Cobrança e monetização** | receber e cobrar com segurança | 2.4 · 1.10 · 6.1 · 9.3 · 9.6 · 9.5 | assinatura validada E2E + planos visíveis |
| **N4 — Segurança de aplicação** | endurecer auth/tenant contra abuso | 1.3 · 1.4 · 1.5 · 1.6 · 1.9 · 1.12 · 1.7 | isolamento em profundidade + auth robusta |
| **N5 — Qualidade e testes** | medir e garantir o que não regride | 5.1 · 5.2 · 5.3 · 5.4 · 5.5 | cobertura + E2E UI + contratos |
| **N6 — Design e experiência** | produto consistente e acessível | 7.1 · 7.5 · 7.6 · 7.12 · 7.10 · 7.11 · 7.13 · 7.2 · 7.7 · 7.8 | componentes únicos + a11y + estados |
| **N7 — Produto comercial** | vendável e documentado | 6.2 · 9.1 · 9.2 · 9.4 · 8.1 · 8.3 | onboarding completo + docs fonte única |
| **N8 — Escala e plataforma** | performance e recursos avançados | 4.1 · 3.5 · 2.3 · 2.5 · 4.2 · 4.3 · 6.3 · 6.4 · 6.5 · 6.6 · 7.3 · 7.9 · 7.14 · 7.16 | operação estável e com mais recursos |
| **N9 — Exploratório** | somente quando houver demanda | 6.7 · 6.8 · 3.6 · 5.6 · 7.4 · 7.15 | validação de necessidade real |

---

# NÍVEL 1 — Fundação segura (P0)

**Objetivo:** nenhum dado de cliente entra no sistema sem proteção de
dados, segurança e recuperação. É a base para qualquer produção.

### 1.1 Backup automatizado com restore testado — **P0** · *(MELHORIAS §1.1 · GPT §7 · Gemini · DeepSeek §3.1)*
- **Função:** `pg_dump` agendado diário (cron/systemd/GitHub Actions ou provedor gerenciado), com retenção (ex.: 30 dias), armazenamento fora da máquina da aplicação (S3/B2/disco externo) e um **drill de restauração** automatizado em banco efêmero.
- **Como melhora:** fecha a **L8** (severidade alta). Hoje um `db:reset` acidental, um `UPDATE` mal escrito ou falha do provedor = perda total dos dados do cliente pagante. Transforma `backup/README.md` em procedimento real, define **RPO ≤ 24h** e **RTO ≤ 4h**.

### 1.2 LGPD — exclusão/anonimização (direito ao esquecimento) — **P0** · *(MELHORIAS §1.2 · GPT §17 · Gemini · DeepSeek §3.2)*
- **Função:** endpoints autenticados (ADMIN): `DELETE /api/clients/:id/anonymize` (mascara PII — nome, telefone, e-mail, CPF, endereço — preservando `Sale`/`CashMovement`/`FinancialEntry` para fins contábeis), `GET /api/clients/:id/data-export` (portabilidade) e `POST /api/clients/:id/consent`.
- **Como melhora:** fecha a **L4**. Hoje `Client` guarda dados pessoais **sem nenhum caminho de remoção**. Desbloqueia negócios que exigem conformidade e reduz exposição a multas.

### 1.11 Gestão de segredos e configuração — **P0** · *(GPT §15 · Gemini)*
- **Função:** segredos em secret manager/variáveis de deploy; separar chaves por ambiente e integração; validar presença/formato no startup; revisar flags (`PASSWORD_RESET_ENABLED`, `REGISTRATION_ENABLED`) variável a variável; scanner de segredos na CI.
- **Como melhora:** nenhum segredo hardcoded hoje (auditoria da Etapa 12), mas **não há rotação, validação no boot nem bloqueio na CI**. Reduz risco de exposição e configuração insegura.

### 3.1 Ambiente de produção reproduzível e separado — **P0** · *(GPT §5 · DeepSeek §2)*
- **Função:** ambientes `dev`/`test`/`staging`/`production` com banco e credenciais distintos; domínio + DNS + TLS (Let's Encrypt); health check diferenciando liveness × readiness; fixar versões; documentar portas/volumes/restart.
- **Como melhora:** hoje produção não está configurada. Garante que um operador implante uma versão a partir de um commit seguindo só a documentação, com cookie `Secure` em produção e falha segura se faltar variável.

### 3.2 Migrations seguras e reversíveis — **P0** · *(GPT §6 · DeepSeek §4.1)*
- **Função:** testar cada migration em staging e em banco vazio/populado; `prisma migrate diff` antes do deploy para detectar destrutivas; estratégia expand/contract; backup antes de `db:deploy`; `CREATE INDEX CONCURRENTLY`.
- **Como melhora:** o projeto tem 13 migrations versionadas, mas nenhum teste de reversibilidade nem gate de destrutivas. Evita travar escritas e perda de dados em produção.

### 9.7 Matriz de go/no-go para venda — **P0** · *(GPT §44 · DeepSeek §13)*
- **Função:** critérios GO/NO-GO por área (dados, segurança, autenticação, multiempresa, operação, privacidade, cobrança, produto, custos).
- **Como melhora:** a venda deve ser **bloqueada** se qualquer item crítico de dados, isolamento, cobrança ou recuperação estiver em NO-GO. Evita lançar antes de estar pronto.

---

# NÍVEL 2 — Operação e observabilidade (P1)

**Objetivo:** colocar o sistema no ar de forma repetível e enxergar falhas
antes do cliente. Base para os drills de backup e o E2E de cobrança.

### 2.2 Deploy contínuo real (fechar o `cd.yml`) — **P1** · *(MELHORIAS §2.2 · GPT §5 · Gemini · DeepSeek §2.2)*
- **Função:** transformar `.github/workflows/cd.yml` (hoje placeholder: migrations + `echo`) em deploy efetivo, com staging e produção, secrets no GitHub, gates/approval e rollback.
- **Como melhora:** fecha a **L7**. Toda a CI verde não serve enquanto o código não sai do notebook. Viabiliza drills de backup e o E2E do Mercado Pago. Requer decisão do proprietário sobre hosting (regra: sem deploy sem decisão).

### 2.1 Monitoramento de erros e uptime — **P1** · *(MELHORIAS §2.1 · GPT §8 · Gemini · DeepSeek §6)*
- **Função:** Sentry/GlitchTip no `AllExceptionsFilter` + app Next.js (DSN via env) e uptime externo (UptimeRobot/Better Stack) em `GET /health` (já `@Public`), com alertas.
- **Como melhora:** fecha a **L9**. Hoje um erro 500 em produção é descoberto pelo cliente. Centraliza logs estruturados (request ID, sem PII) e dá alertas acionáveis.

### 2.6 Logs estruturados e observabilidade — **P1** · *(GPT §8 · DeepSeek §6.4)*
- **Função:** logs JSON com timestamp, ambiente, versão, request ID; scrub de PII; correlação de erros; dashboards operacionais simples.
- **Como melhora:** hoje o NestJS usa logger padrão; sem correlação nem contexto. Facilita diagnóstico e runbooks.

### 8.2 Runbooks operacionais — **P0/P1** · *(GPT §32 · DeepSeek §7.4)*
- **Função:** criar `docs/operations/RUNBOOK.md` com deploy/rollback, migrations, restore, banco indisponível/disco cheio, segredo vazado, isolamento entre empresas, webhook de pagamento perdido, worker parado, LGPD, cancelamento/exportação.
- **Como melhora:** hoje não há procedimento documentado; um incidente depende da memória do desenvolvedor. Cada runbook com detecção, impacto, diagnóstico, ação segura, validação e responsável.

### 3.3 Pool de conexões — **P1** · *(DeepSeek §4.2)*
- **Função:** PgBouncer ou pool nativo do provedor; `connection_limit` no Prisma; monitorar `pg_stat_activity`.
- **Como melhora:** com API + Worker + tarefas, o número de conexões pode estourar. Evita esgotamento do Postgres em produção.

### 3.4 Política de retenção de dados — **P1** · *(GPT §16 · DeepSeek §4.3)*
- **Função:** definir prazos para dados de negócio (indefinido — contábil), sessões expiradas (limpeza semanal), logs de webhook (90 dias), `ImportBatch` (2 anos).
- **Como melhora:** não há política definida hoje; essencial para LGPD e para controlar crescimento do banco.

---

# NÍVEL 3 — Cobrança e monetização (P1)

**Objetivo:** receber e cobrar com segurança. Só faz sentido após N1/N2
porque depende de deploy, backup e monitoramento.

### 2.4 E2E do checkout Mercado Pago em sandbox — **P1** · *(MELHORIAS §2.4 · GPT §20 · Gemini · DeepSeek §13)*
- **Função:** teste ponta a ponta com cartão de teste: checkout → preapproval → webhook → assinatura `ACTIVE`; cobrindo sucesso, recusa, cancelamento, repetição/atraso de webhook e falha temporária.
- **Como melhora:** fecha a **L13**. O mock prova a lógica interna, **não** a integração real. Sem isso, ativar cobrança recorrente é aposta.

### 1.10 Webhook do Mercado Pago — validação HMAC reforçada — **P1** · *(DeepSeek §3.8 · GPT §20)*
- **Função:** comparação em tempo constante (anti timing attack), anti-replay validando timestamp do `x-signature` (`ts=…,v1=…`), fail-closed (sem `MERCADOPAGO_WEBHOOK_SECRET` → 403).
- **Como melhora:** o webhook já valida `x-signature` HMAC-SHA256; endurece contra replay e config faltante. É base para o E2E do item 2.4.

### 6.1 Exibir limites e uso do plano em `/faturamento` — **P1** · *(MELHORIAS §5.1 · GPT §21 · Gemini · DeepSeek §10.2)*
- **Função:** barras de progresso ("3 de 5 usuários", "45/200 clientes"), alerta a 80% do limite e botão de upgrade (link para checkout).
- **Como melhora:** fecha a **L12**. O backend **já expõe** `userLimit`/`clientLimit`/`productLimit` no `planSelect`, mas a tela não mostra — o cliente paga por limite sem enxergar o consumo. Conversão direta de retenção.

### 9.3 Cancelamento, portabilidade e encerramento — **P1** · *(GPT §36)*
- **Função:** fluxo claro de cancelamento de assinatura/encerramento de conta; exportação de dados em formato documentado; período de retenção e eliminação; revogar sessões/convites/credenciais; auditar exclusões.
- **Como melhora:** o cliente precisa compreender como cancelar e exportar os próprios dados (LGPD + confiança). Não bloquear exportação como coerção.

### 9.6 Modelo comercial do piloto fechado — **P1** · *(GPT §41–43 · DeepSeek §12)*
- **Função:** piloto de ~3 semanas → 1 empresa/segmento, módulos núcleo + WhatsApp, contrato de 90 dias, SLA mínimo, backup diário, canal de suporte; após o piloto reavaliar preço e converter para assinatura.
- **Como melhora:** o veredito é **"não para produção paga; sim para piloto fechado e pago"**. Permite validar com risco controlado antes de abrir a venda.

### 9.5 Indicadores operacionais do SaaS — **P1/P2** · *(GPT §37)*
- **Função:** acompanhar disponibilidade, erro, latência p95, falhas de login/cadastro, backups/restore, webhooks, assinaturas ativas/canceladas/em atraso, conversão de onboarding, tickets, custo por tenant.
- **Como melhora:** métricas agregadas e minimizadas (sem conteúdo sensível). Dá base para decisões de preço, capacidade e priorização.

---

# NÍVEL 4 — Segurança de aplicação (P1)

**Objetivo:** endurecer autenticação e isolamento de tenant contra abuso e
acesso cruzado. Defesa em profundidade além da camada de aplicação.

### 1.4 Row-Level Security (RLS) no Postgres — **P1** · *(MELHORIAS §1.4 · GPT §13 · Gemini · DeepSeek §3.4)*
- **Função:** políticas no banco forçando `WHERE company_id = current_setting('app.company_id')`, além do filtro da aplicação; a aplicação seta `SET LOCAL app.company_id` por transação.
- **Como melhora:** fecha a **L3**. Hoje o isolamento de tenant depende **inteiramente** de a aplicação lembrar de filtrar por `companyId` (538 testes cobrem, mas um `findMany` novo esquecido é vazamento silencioso). RLS vira **defesa em profundidade**. Exige Postgres 14+ (o projeto usa 17) e roles sem `BYPASSRLS`.

### 1.3 Rate limit de login distribuído (Redis) — **P1** · *(MELHORIAS §1.3 · GPT §11 · DeepSeek §3.3)*
- **Função:** substituir o contador em memória por armazenamento compartilhado (Redis/Upstash) com janela deslizante, atrás de uma interface `RateLimitStore` (in-memory hoje + Redis em produção).
- **Como melhora:** fecha a **L2**. O limite (5/15min) morre no restart e **não vale entre instâncias** — em 2 réplicas, um atacante tem 5× as tentativas. Pré-requisito para escala horizontal.

### 1.5 Redefinição de senha com token de e-mail — **P1** · *(MELHORIAS §1.5 · GPT §11 · DeepSeek §3.5)*
- **Função:** token de uso único (32 bytes, hash SHA-256, expiração de 1h), enviado por e-mail, validado no servidor; revoga todas as sessões após troca.
- **Como melhora:** fecha a **L5**. Hoje `PASSWORD_RESET_ENABLED` redefine **sem token** — quem habilita em produção entrega a conta de qualquer usuário. Habilita o botão `/redefinir-senha` de forma segura e libera a pendência do checklist §7.

### 1.6 Cadastro público com verificação anti-abuso — **P1** · *(MELHORIAS §1.6 · GPT §12 · DeepSeek §3.6)*
- **Função:** limite de criação de empresa por IP/CPF (ex.: 3/h), verificação de e-mail por token, CAPTCHA (hCaptcha/Cloudflare Turnstile) e/ou modelo por convite.
- **Como melhora:** fecha a **L6**. `REGISTRATION_ENABLED` está `true` no `.env.example` — quem copia o template para produção abre cadastro aberto sem barreira. Protege contra enumeração, spam e criação automatizada.

### 1.9 Correção de vulnerabilidades de dependências — **P1** · *(MELHORIAS §4.3 · GPT §10 · Gemini · DeepSeek §3.7)*
- **Função:** atualizar `next` (→16.4.1), `vitest` (major), `esbuild`, `tinypool` em branch isolada, um pacote por commit, `npm run validate` entre cada; rodar `npm audit --omit=dev` na CI.
- **Como melhora:** fecha a **L1** — **2 das 8 vulnerabilidades são de produção** (`postcss` via `next`, alta: XSS e path traversal). `npm audit fix --force` cego é arriscado; precisa de janela dedicada.

### 1.12 Proteção contra ataques web — **P1** · *(GPT §14)*
- **Função:** revisar validação de entrada, limites de upload/importação, SQLi/XSS/CSRF/SSRF/path traversal, CSP, CORS com lista explícita, anti open-redirect, anti formula injection no CSV, erros 4xx/5xx sem stack trace.
- **Como melhora:** o projeto já protege CSV (anti-injeção) e uploads (≤5MB); amplia a superfície com cabeçalhos de segurança, CORS e revisão ASVS/WSTG. Base para a revisão de segurança pré-comercial.

### 1.7 2FA/MFA para perfis ADMIN — **P2** · *(MELHORIAS §1.7 · GPT §11)*
- **Função:** segundo fator TOTP opcional/obrigatório para papel `ADMIN`; campo `twoFactorSecret` cifrado em `User`, encaixado no serviço de sessão existente.
- **Como melhora:** uma única credencial vazada dá acesso a tudo que o `AdminGuard` protege (caixa, financeiro, usuários, exclusões). Eleva a barreira para contas privilegiadas.

---

# NÍVEL 5 — Qualidade e testes (P1)

**Objetivo:** medir e garantir o que não pode regredir, cobrindo a
superfície que os 538 testes de integração não alcançam.

### 5.1 Cobertura de código medida na CI — **P1** · *(MELHORIAS §4.1 · GPT §33 · DeepSeek §9.2)*
- **Função:** `vitest run --coverage` publicando o percentual e diff-cover no PR; meta inicial ~70% de linhas em service/controller.
- **Como melhora:** há **538 testes verdes** mas ninguém sabe o que **não** cobrem. Sem número, "está testado" é sensação.

### 5.2 Testes E2E de interface (Playwright) — **P1** · *(MELHORIAS §4.2 · GPT §33 · Gemini · DeepSeek §9.3)*
- **Função:** fluxos no browser: login → PDV → fechar caixa → relatório; criar cliente; importar CSV; enviar WhatsApp. Rodar na CI com dev server.
- **Como melhora:** hoje a validação E2E é manual. Os 538 testes são de integração da API — **nenhum** passa por um componente React, um `fetch` do `AppShell` ou os rewrites do Next. Um link quebrado passa 100% verde hoje.

### 5.3 Testes de concorrência, idempotência e falhas externas — **P1** · *(GPT §24, §33)*
- **Função:** testar duas vendas concorrentes do último item, repetição de requisição por timeout/retry, webhooks repetidos/fora de ordem/atrasados, falhas de provedor externo com retries.
- **Como melhora:** os módulos de estoque/venda/caixa já usam locks e idempotência; formaliza a garantia contra venda duplicada e saldo inconsistente.

### 5.4 Geração automática da documentação de API (OpenAPI) — **P2** · *(MELHORIAS §4.4 · DeepSeek §7.3)*
- **Função:** `@nestjs/swagger` decorando controllers, gerando `/api/docs` e `openapi.yaml` versionado (com conversão de schemas Zod).
- **Como melhora:** `API.md` é **escrito à mão** e foi a fonte dos erros corrigidos (rotas que não existiam, enum errado, path de webhook errado). Gerar da fonte torna esse erro impossível.

### 5.5 Testes de contrato entre workspaces — **P2** · *(MELHORIAS §4.5 · DeepSeek §9.4)*
- **Função:** checar que `API.md`, schemas Zod e controllers batem (toda rota documentada existe no módulo registrado).
- **Como melhora:** repete mecanicamente a auditoria manual que encontrou `POST /api/whatsapp/consents` e `PATCH /templates/:id/approval` inexistentes.

---

# NÍVEL 6 — Design e experiência (P0/P1)

**Objetivo:** transformar o "site genérico" em um produto consistente,
acessível e com estados claros. Inclui os débitos D-4 e D-6.

### 7.1 Design tokens semânticos — **P0** · *(MELHORIAS_DESIGN §1.1 · GPT §27)*
- **Função:** par nomeado por **papel** (`--color-accent`, `--color-danger`, `--color-warning`, `--surface-raised`, `--text-muted`, `--border-subtle`) usado **só** nos componentes.
- **Como melhora:** hoje os tokens são nomes de paleta (`--color-primary-500`); trocar o tom de "sucesso" exige vasculhar vários componentes. Com tokens semânticos, troca-se **uma linha** — pré-requisito para tema por segmento e dark mode.

### 7.5 Componente `Table` compartilhado — **P0** · *(MELHORIAS_DESIGN §2.1 · GPT §30 · Gemini · DeepSeek §8.2)*
- **Função:** `<Table>` com colunas tipadas, cabeçalho, zebra opcional, alinhamento à direita para moeda/qtd, estado vazio e **versão empilhada no mobile**.
- **Como melhora:** resolve o **D-4** (32 tabelas inline). Alinhamento consistente de valores em R$ é a maior fonte de "parece errado" num sistema financeiro. Começar por `caixa/movimentos`, `produtos`, `clientes`.

### 7.6 Primitivos de UI (Modal, Select, Toast, Tabs) — **P0/P1** · *(MELHORIAS_DESIGN §2.2–2.4 · GPT §30 · DeepSeek §8.2)*
- **Função:** `Modal` acessível (foco preso, `Esc`, `aria-modal`, devolve foco), `Select`/`Combobox`/`DateInput` estilizados, `Toast` com `aria-live` e empilhamento.
- **Como melhora:** resolve o **D-6**. Cancelamento de venda, estorno e exclusão são ações destrutivas que hoje usam `confirm()` do browser. Toast dá feedback visível (hoje criar cliente/liquidar título não confirma nada) e exibe os `issues[]` do Zod.

### 7.12 Estados vazios, erros in-line e loading/error/not-found — **P0/P1** · *(MELHORIAS_DESIGN §6)*
- **Função:** `loading.tsx`/`error.tsx`/`not-found.tsx` (já criados — D-5); `EmptyState` com ação ("Cadastrar primeiro cliente", "Abrir caixa"); erros in-line no campo via `aria-describedby` mostrando a 1ª `issue` do Zod; fallback no `AppShell`.
- **Como melhora:** o produto é novo — a **primeira hora do usuário é tela vazia**, onde ele decide se entende o sistema. Erros de Zod chegam no 400 mas não aparecem no campo.

### 7.10 Acessibilidade — auditoria, foco e contraste — **P1** · *(MELHORIAS_DESIGN §4 · GPT §28)*
- **Função:** `@axe-core/playwright` na CI; `focus-visible` e ordem de tabulação; contraste ≥ 4.5:1 (texto normal) com regra **texto só nos stops 700+**; `aria-live` anunciando resultados; `prefers-reduced-motion`.
- **Como melhora:** há ~63 ocorrências de `aria-|role=` em 39 páginas — pouco para um sistema que é **o trabalho diário** de alguém. O D-7 já foi corrigido (7 ocorrências → stop 700); auditoria contínua evita regressão.

### 7.11 Responsividade mobile no balcão — **P1** · *(MELHORIAS_DESIGN §5)*
- **Função:** testar em 360px; alvos de toque ≥ 44px; "modo denso" opcional.
- **Como melhora:** o shell tem drawer mobile, mas as **32 tabelas inline** não têm versão empilhada — num tablet de balcão, 8 colunas viram rolagem horizontal. O `Table` (7.5) resolve junto.

### 7.13 Formatação monetária centralizada — **P1** · *(MELHORIAS_DESIGN §7.2)*
- **Função:** um `formatBRL()` único com `Intl.NumberFormat("pt-BR")`, usado por `StatCard`, tabelas, gráficos e recibo.
- **Como melhora:** valores vêm do servidor como string de 2 casas; se cada tela formatar por conta própria, uma hora aparece `R$ 1.500,0` ou `1500.00`. Num sistema financeiro isso é credibilidade.

### 7.2 Completar a escala e remover pontos cegos — **P1** · *(MELHORIAS_DESIGN §1.2)*
- **Função:** `success` só tem 50/500/600/700; **não existem** `danger`/`warning`/`info`. As páginas compensam com utilitários soltos (`text-red-600`, `bg-amber-100`).
- **Como melhora:** o sistema hoje tem **duas paletas** (a da marca amber + uma improvisada de utilitários). Completar a escala unifica o visual sem mexer em layout.

### 7.7 Microinterações e transições de estado — **P1** · *(MELHORIAS_DESIGN §3.1)*
- **Função:** 150–200ms em hover/focus/pressed, abertura de drawer, expandir/colapsar — só `transition-*` do Tailwind, sem biblioteca de animação; respeitar `prefers-reduced-motion`.
- **Como melhora:** há **11 ocorrências** de `animate-|transition-|@keyframes` em todo o `apps/web`. O painel responde mas não **reage**; em PDV (fluxo repetido 50×/dia) isso vira percepção de lentidão.

### 7.8 Skeletons coerentes com o layout real — **P1** · *(MELHORIAS_DESIGN §3.2)*
- **Função:** `Skeleton.tsx` já existe; usar de forma consistente com a geometria da tabela/lista que vai aparecer.
- **Como melhora:** sem skeletons padronizados, o usuário vê a tela anterior congelada e depois o conteúdo "pulando". Custo quase zero.

---

# NÍVEL 7 — Produto comercial (P1)

**Objetivo:** tornar o produto vendável e a documentação confiável.

### 6.2 Edição dos dados da empresa — **P1** · *(MELHORIAS §5.2 · DeepSeek §10.1)*
- **Função:** tela e endpoint `PATCH /api/company` (AdminGuard) para razão social, CNPJ, contato; `slug` imutável.
- **Como melhora:** fecha a **lacuna D1** do `MAPA_DE_MODULOS`. Hoje `Company` tem `name`/`slug` e **não há forma de editar** — o cliente se chama errado para sempre.

### 9.1 Posicionamento e validação comercial — **P1** · *(GPT §23 · DeepSeek §12)*
- **Função:** manter a promessa focada em **gestão operacional básica**; escolher um segmento inicial para o piloto; definir 3–5 fluxos essenciais; validar preço com custos reais; medir uso por módulo antes de investir.
- **Como melhora:** evita prometer ERP completo ou funcionalidades fiscais antes de validar. Delimita o escopo comercial (já em `PDV.md`).

### 9.2 Onboarding e gestão de clientes — **P1** · *(GPT §22 · DeepSeek §12.3)*
- **Função:** jornada da página pública à primeira venda (conhecer → criar conta/aceitar convite → configurar empresa → importar dados → convidar usuários → vender); checklist inicial; dados demonstrativos neutros; modelos CSV; página pública com escopo/limitações/preço/FAQ.
- **Como melhora:** sem onboarding, a primeira hora do usuário é tela vazia e ele não entende o sistema. Importar CSV de exemplo sem ajuda reduz a barreira de troca.

### 9.4 Suporte e incidentes — **P1** · *(GPT §35)*
- **Função:** canal de suporte, classificação de incidentes (indisponibilidade, dados, segurança, cobrança, dúvida), registro com tenant/versão/request ID, comunicação a clientes afetados, status page simples.
- **Como melhora:** hoje não há canal definido; um incidente não é priorizado nem acompanhado com histórico.

### 8.1 Documentação como fonte confiável — **P1** · *(GPT §31)*
- **Função:** manter `PROJECT_STATUS.md` como fonte única; marcar planos concluídos como históricos; validar links na CI; documentar cada env var com finalidade/obrigatoriedade/risco; ADRs para decisões de impacto (RLS, billing, deploy).
- **Como melhora:** o risco não é faltar doc, é **existirem instruções antigas que contradizem o estado atual** (já causou erros factuais corrigidos). Evita duplicação de contagens.

### 8.3 Processo de desenvolvimento com IA — **P1** · *(GPT §34)*
- **Função:** regras para agentes: inspecionar `AGENTS.md`/status antes; apresentar plano e arquivos afetados antes de codificar; não inventar rotas/modelos/variáveis; não alterar banco/auth/cobrança/deploy sem autorização; não instalar dependências sem justificativa; mudanças pequenas e revisáveis; reportar validações reais.
- **Como melhora:** alinha autonomia da IA com as regras do `AGENTS.md`, reduz risco de alterações destrutivas ou de afirmações sem evidência.

---

# NÍVEL 8 — Escala e plataforma (P2)

**Objetivo:** performance e recursos avançados, quando a operação estiver
estável e houver demanda/volume.

### 4.1 Cache de relatórios e dashboard — **P2** · *(MELHORIAS §3.1)*
- **Função:** cache curto (Redis/`CacheManager`) das agregações de `/api/reports/summary` e `/dashboard`; invalidar no `create` de `Sale`/`CashMovement`/`FinancialEntry`.
- **Como melhora:** os relatórios agregam vendas/caixa a **cada load de tela** — com 12 meses de histórico e movimentação alta, vira consulta lenta no dia a dia do usuário.

### 3.5 Índices sob demanda via `pg_stat_statements` — **P2** · *(MELHORIAS §3.2 · GPT §6)*
- **Função:** ligar `pg_stat_statements`, analisar as 10 consultas mais caras e criar índices só com evidência; revisar índices com `EXPLAIN ANALYZE`.
- **Como melhora:** os índices compostos por `companyId` existem, mas **nenhum** foi validado com dados reais. Evita tanto falta quanto excesso de índice (escrita lenta).

### 2.3 Expiração de assinatura por job (não lazy) — **P2** · *(MELHORIAS §2.3)*
- **Função:** cron no `apps/worker` que varre `TenantSubscription` com `periodEnd` vencido e transiciona para `EXPIRED`.
- **Como melhora:** fecha a **L10**. Hoje a expiração acontece **na leitura** — empresa vencida continua funcionando até alguém abrir a tela certa, atrasando cobrança e distorcendo limites.

### 2.5 Fila de mensagens assíncrona de verdade (BullMQ/Redis) — **P2** · *(MELHORIAS §2.5 · GPT §26 · Gemini)*
- **Função:** substituir o polling do worker por fila (BullMQ/Redis) com retries, dead-letter, prioridade e backoff.
- **Como melhora:** o `worker/whatsapp/processor.ts` faz poll com `WHATSAPP_SEND_MAX_PER_CYCLE` — funciona, mas não escala (instâncias competindo pelo `updateMany`, sem visibilidade de mensagens presas). Depende do item 1.3.

### 4.2 Paginação/limites obrigatórios em toda leitura — **P1** · *(MELHORIAS §3.3)*
- **Função:** varrer as rotas `GET` (`/api/whatsapp/consents`, `/api/cash/sessions`, importações) e garantir que nenhuma ignore `pageSize` e devolva a base inteira.
- **Como melhora:** `paginationQuerySchema` já existe; a causa clássica de OOM em SaaS multi-tenant é uma rota devolvendo conjunto ilimitado.

### 4.3 Escalabilidade e custo por tenant — **P1** · *(GPT §9)*
- **Função:** medir latência p50/p95/p99, taxa de erro e tempo de consultas antes de otimizar; começar pela arquitetura mais simples (sem K8s/Redis sem necessidade); monitorar custo por empresa ativa e por transação; alertas de orçamento.
- **Como melhora:** as estimativas de custo do checklist são documentais, não medidas. Evita prometer capacidade sem teste de carga e dá controle de gasto.

### 6.3 Agenda: visão de semana/mês e recorrência — **P2** · *(MELHORIAS §5.3 · DeepSeek §10.3)*
- **Função:** calendário com semana/mês, recorrência e múltiplos profissionais.
- **Como melhora:** hoje é **visão por dia apenas** e antecipação de lembrete fixa por empresa. Um pet shop com 30 agendamentos/dia não consegue enxergar a semana.

### 6.4 CSV de caixa, clientes e WhatsApp — **P2** · *(MELHORIAS §5.4)*
- **Função:** exportação `.csv` das três listas que hoje só têm relatório de vendas.
- **Como melhora:** pendência registrada. O utilitário de exportação **já existe** com anti-injeção e limite de 5000 linhas — é reaproveitar.

### 6.5 Busca global com resultados agrupados — **P2** · *(MELHORIAS §5.5 · DeepSeek §10.6)*
- **Função:** evoluir a lupa da topbar para resultados agrupados por tipo (cliente, produto, venda) com atalho de teclado.
- **Como melhora:** para um negócio com histórico longo, "achar o cliente" é a ação mais repetida do dia.

### 6.6 Impressão/second display no PDV — **P2** · *(MELHORIAS §5.6 · DeepSeek §10.4)*
- **Função:** impressão de cupom não fiscal (ESC/POS ou PDF) e tela de cliente; `@media print` + `window.print()`.
- **Como melhora:** o `PDV.md` já delimita "não é cupom fiscal" — mas **não imprime nada**. Comprar sem conseguir dar recibo é atrito real no balcão.

### 7.3 Dark mode por tokens (não por classe `dark:`) — **P2** · *(MELHORIAS_DESIGN §1.3)*
- **Função:** definir tokens de superfície/texto/borda e trocar valores num único bloco, via `prefers-color-scheme: dark` ou classe no `<html>`.
- **Como melhora:** o painel já é híbrido (topbar escura + conteúdo claro) e **não tem dark mode**. Com tokens, um dark mode vira ~20 linhas de CSS, não 39 páginas editadas. Ajuda quem opera à noite (PDV, caixa).

### 7.9 Optimistic UI em ações rápidas — **P2** · *(MELHORIAS_DESIGN §3.3)*
- **Função:** aplicar a mudança visual antes da resposta do servidor, com rollback se falhar.
- **Como melhora:** otimizar para **status** (inativar usuário, mudar status de template, consentimento). Para **dinheiro** (caixa, financeiro, venda) **não** — saldo é recalculado no servidor por regra permanente.

### 7.14 Impressão e recibo standalone — **P2** · *(MELHORIAS_DESIGN §9)*
- **Função:** `@media print` sem shell/botões, largura de bobina (58/80mm) ou A4; rota tokenizada só com o recibo.
- **Como melhora:** `Receipt.tsx` já existe, mas imprimir hoje sai com topbar/menus/cores. A rota standalone permite reenviar o comprovante por WhatsApp sem expor o painel.

### 7.16 shadcn/ui como base — **P2** · *(DeepSeek §8.3)*
- **Função:** adotar componentes acessíveis baseados em Radix UI + Tailwind 4 (Table, Dialog, Select, Toast, Tabs).
- **Como melhora:** alinhado com o Tailwind 4 já usado; resolve D-4/D-6 com componentes testados e acessíveis por padrão. (Decisão de dependência — justificar conforme regra 5 do `AGENTS.md`.)

---

# NÍVEL 9 — Exploratório (P3)

**Objetivo:** somente quando houver demanda real ou piloto que justifique.

### 6.7 Modo offline/reativo no PDV — **P3** · *(MELHORIAS §5.7 · DeepSeek §10.5)*
- **Função:** fila local de vendas (Service Worker + IndexedDB) com sincronização e resolução de conflitos.
- **Como melhora:** a limitação **L4 do PDV** ("sem modo offline") significa que **queda de internet = fechar a loja**. Alto impacto, alta complexidade — por isso P3.

### 6.8 Catálogo global de planos editável por papel de plataforma — **P3** · *(MELHORIAS §6.4)*
- **Função:** expor escrita em `TenantPlan` atrás de um guard de plataforma.
- **Como melhora:** fecha a **L14**. Hoje os planos se alteram **no banco** — operação cara e sem trilha.

### 3.6 Seed de demonstração neutro por segmento — **P3** · *(MELHORIAS §6.3 · GPT §22 · Gemini · DeepSeek §4.4)*
- **Função:** `db:seed:demo` com cenários de papelaria/oficina/alimentação além de pet shop (ex.: "Empório Central", "Studio Beleza", "Padaria Pão Quente").
- **Como melhora:** fecha a **L11** ("seed ainda tem Mundo Pet"). Rode em demonstração comercial sem parecer um sistema de pet shop.

### 5.6 Testes de carga — **P3** · *(DeepSeek §9.5)*
- **Função:** k6/Artillery simulando ~50 usuários simultâneos no PDV.
- **Como melhora:** revela gargalos de lock e pool de conexões antes do cliente pagante.

### 7.4 Tema por segmento (papelaria, oficina, pet shop) — **P3** · *(MELHORIAS_DESIGN §1.4)*
- **Função:** trocar a paleta `primary` por tenant, resolvida no servidor e injetada como variáveis CSS.
- **Como melhora:** o produto se propõe a **não** ser de pet shop, mas ainda é amber genérico. Trocar a cor primária vende a multidão sem tocar nas telas. Cuidado: nunca logar/comitar mapeamento com dados de cliente; marca Akylla permanece reconhecível.

### 7.15 PWA para o tablet de balcão — **P3** · *(MELHORIAS_DESIGN §8.3 · DeepSeek §8.6)*
- **Função:** manifest + service worker, instalável, tela cheia e ícone próprio.
- **Como melhora:** o PDV em tablet ganha instalação e shell cacheado. **Não** prometer offline completo — isso é outro item (6.7), complexidade alta.

---

## Débitos de design já medidos (D-1 … D-7)

Correções de débito (não são ideias; podem ser executadas assim que autorizadas, sem design review). Status em **2026-10-15**:

| # | Achado | Status |
|---|---|---|
| **D-1** | `color: var(--foreground)` — variável nunca definida | ✅ RESOLVIDO — `--color-foreground: #0f172a` |
| **D-2** | Fonte usava string literal `"Inter"`; variável `--font-inter` nunca lida | ✅ RESOLVIDO — `--font-sans: var(--font-inter), …` |
| **D-3** | Bloco `.sidebar-scroll` morto desde a topbar | ✅ RESOLVIDO — removido (tokens `--color-sidebar*` preservados) |
| **D-4** | **32 `<table>` escritos inline**, sem componente compartilhado | ⏳ PENDENTE — depende do `Table` (N6 · 7.5) |
| **D-5** | Nenhum `loading.tsx`/`error.tsx`/`not-found.tsx` | ✅ RESOLVIDO — os 3 criados |
| **D-6** | Primitivos de UI faltam (`Table`, `Modal`, `Select`, `Toast`, `Tabs`) | ⏳ PENDENTE — depende do N6 · 7.6 |
| **D-7** | Contraste reprovado (amber-500=2.15, success-500=2.49, amber-600=3.19; AA exige 4.5) | ✅ RESOLVIDO — 7 ocorrências → stop 700; 3 preservadas de propósito |

---

## Resumo por prioridade

| P | Itens |
|---|---|
| **P0** | 1.1 backup+restore · 1.2 LGPD · 1.11 segredos/config · 3.1 ambiente reproduzível · 3.2 migrations seguras · 2.4 E2E Mercado Pago (com 2.2) · 7.1 tokens semânticos · 7.5 `Table` · 7.6 primitivos (Modal/Select/Toast) · 7.12 loading/error/not-found · 9.7 matriz go/no-go |
| **P1** | 1.3 rate limit distribuído · 1.4 RLS · 1.5 senha por e-mail · 1.6 anti-abuso · 1.9 deps de segurança · 1.10 webhook HMAC · 1.12 ataques web · 2.1 monitoramento · 2.2 CD · 2.6 logs · 3.3 pool de conexões · 3.4 retenção · 4.2 limites de leitura · 4.3 custo por tenant · 5.1 cobertura · 5.2 E2E UI · 5.3 concorrência/idempotência · 6.1 limites do plano · 6.2 editar empresa · 7.2 completar escala · 7.7 microinterações · 7.8 skeletons · 7.10 a11y · 7.11 mobile · 7.12 estados/erros · 7.13 formatação BRL · 8.1 docs fonte confiável · 8.2 runbooks · 8.3 dev com IA · 9.1 posicionamento · 9.2 onboarding · 9.3 cancelamento/portabilidade · 9.4 suporte · 9.6 piloto |
| **P2** | 1.7 2FA · 1.8 auditoria exportável · 2.3 expiração por job · 2.5 fila real · 4.1 cache · 3.5 índices · 5.4 OpenAPI · 5.5 contrato · 6.3 agenda semana/mês · 6.4 CSV · 6.5 busca · 6.6 impressão · 7.3 dark mode · 7.9 optimistic · 7.14 print/recibo · 7.16 shadcn · 9.5 indicadores |
| **P3** | 6.7 offline · 6.8 catálogo global · 3.6 seed neutro · 5.6 carga · 7.4 tema por segmento · 7.15 PWA |

---

## Sequência de execução (resumo dos níveis)

1. **N1 — Fundação segura (P0):** 1.1 → 1.2 → 1.11 → 3.1 → 3.2 → 9.7 (dados seguros, conformidade, deploy com rollback, go/no-go).
2. **N2 — Operação e observabilidade (P1):** 2.2 → 2.1 → 2.6 → 8.2 → 3.3 → 3.4 (deploy repetível + alertas + runbooks).
3. **N3 — Cobrança e monetização (P1):** 2.4 → 1.10 → 6.1 → 9.3 → 9.6 → 9.5 (cobrança validada E2E, planos visíveis, piloto).
4. **N4 — Segurança de aplicação (P1):** 1.4 → 1.3 → 1.5 → 1.6 → 1.9 → 1.12 → 1.7 (defesa em profundidade).
5. **N5 — Qualidade e testes (P1):** 5.1 → 5.2 → 5.3 → 5.4 → 5.5 (superfície de falha medida e visível).
6. **N6 — Design e experiência (P0/P1):** 7.1 → 7.5 → 7.6 → 7.12 → 7.10 → 7.11 → 7.13 → 7.2 → 7.7 → 7.8 (produto consistente e acessível).
7. **N7 — Produto comercial (P1):** 6.2 → 9.1 → 9.2 → 9.4 → 8.1 → 8.3 (vendável e documentado).
8. **N8 — Escala e plataforma (P2):** 4.1 → 3.5 → 2.3 → 2.5 → 4.2 → 4.3 → 6.3 → 6.4 → 6.5 → 6.6 → 7.3 → 7.9 → 7.14 → 7.16.
9. **N9 — Exploratório (P3):** 6.7 → 6.8 → 3.6 → 5.6 → 7.4 → 7.15 (somente com demanda).

> **Regra (AGENTS.md):** nada entra em `IMPLEMENTATION_CHECKLIST.md` sem decisão do proprietário. Prioridades são leitura atual (2026-10-15) e mudam com o negócio.

---

## Como usar este arquivo

- É o **ponto único de consulta** para decidir o próximo upgrade do Akylla Gestão, agora **organizado por nível de implementação** (N1 → N9).
- Cada nível tem um **objetivo** e um **critério de conclusão**; avance para o próximo nível só após concluir o anterior.
- Ao aprovar uma ideia: mover para a seção "Fora do roteiro" do `IMPLEMENTATION_CHECKLIST.md`, executar, registrar em `CHANGELOG.md`/`PROJECT_STATUS.md` e marcar aqui.
- Os arquivos originais permanecem como fonte de detalhe (`MELHORIAS.md` e `MELHORIAS_DESIGN.md` são os catálogos oficiais; GPT/Gemini/DeepSeek são análises externas complementares).
