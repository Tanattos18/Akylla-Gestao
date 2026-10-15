# Upgrade — ideias de melhorias para o Akylla Gestão

**Papel deste arquivo:** lista de ideias de melhoria, cada uma com
**(a)** o que ela é/faz, **(b)** o que ela melhora **neste projeto**
especificamente, **(c)** por onde começar e **(d)** prioridade.

Não é um plano aprovado — é um **catálogo para decisão**. Nada aqui é
para ser executado sem autorização do proprietário (regra 2 do
`AGENTS.md`).

**Fonte das lacunas citadas:** `docs/akylla/CHECKLIST_PRE_PRODUCAO.md` §3
(limitações L1–L14), `docs/operations/PROJECT_STATUS.md` §Pendências e
inspeção direta do código.

**Escopo:** backend, segurança, operação, infraestrutura e produto.
A camada de interface tem catálogo próprio —
[`MELHORIAS_DESIGN.md`](MELHORIAS_DESIGN.md).

---

## Legenda de prioridade

| | Significado |
|---|---|
| **P0** | bloqueia produção / risco de dados ou segurança |
| **P1** | necessário antes de escalar ou de confiar na operação |
| **P2** | valor claro, fazer após estabilizar |
| **P3** | exploratório / quando houver demanda |

---

## 1. Segurança e compliance

### 1.1 Backup automatizado de banco com restore testado — **P0**

- **O que é:** `pg_dump` agendado diário (cron, GitHub Actions
  agendado ou provedor gerenciado), com **retenção** e um **drill de
  restauração** automatizado em ambiente isolado.
- **O que melhora aqui:** fecha a **L8** (limitação de severidade
  alta: "sem backups automatizados"). Hoje, um `db:reset` acidental,
  um `UPDATE` mal escrito ou um problema no provedor = perda total.
  Torna o conteúdo de [`../backup/`](../backup/README.md) procedural
  em vez de opcional.
- **Por onde começar:** agendar dump para fora da máquina; script de
  restauração em banco efêmero + `npm run validate`; rodar o drill
  quinzenal e registrar em `CHANGELOG.md`.
- **Também melhora:** o item L8 do checklist pré-produção.

### 1.2 Exclusão/anonimização LGPD (direito ao esquecimento) — **P0**

- **O que é:** endpoint autenticado (ADMIN) que anonimiza ou exclui
  dados pessoais de um cliente, preservando o que a lei exige reter
  (notas fiscais, movimentações financeiras), com trilha de auditoria
  da própria requisição.
- **O que melhora aqui:** fecha a **L4**. Hoze `Client` guarda nome,
  telefone, e-mail, CPF e endereço (`database/prisma/schema.prisma`)
  **sem nenhum caminho de remoção** — se um cliente pedir, não há como
  atender. Também desbloqueia o uso do produto por negócios que
  exigem conformidade na contratação.
- **Por onde começar:** módulo `apps/api/src/lgpd/`, endpoint
  `DELETE /api/clients/:id/anonymize`; mascarar campos PII mantendo
  `FinancialEntry`/`Sale` para a contabilidade; testes de que a
  anonimização **não quebra** o caixa nem o financeiro.
- **Também melhora:** `docs/AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md` §21.

### 1.3 Rate limit de login distribuído (Redis) — **P1**

- **O que é:** trocar o contador em memória por um armazenamento
  compartilhado (Redis/Upstash) com janela deslizante.
- **O que melhora aqui:** fecha a **L2**. O limite
  (5 tentativas/15min, `AUTH_RATE_LIMIT_MAX`) morre no restart e
  **não vale entre instâncias** — em produção com 2 réplicas, um
  atacante tem 5× as tentativas. Também é pré-requisito para qualquer
  escala horizontal.
- **Por onde começar:** `apps/api/src/common/` (extrair a guarda de
  rate limit atrás de uma interface `RateLimitStore`); implementação
  em memória (hoje) + Redis (produção), mesma API.
- **Atenção:** não é dependência a ser instalada sem justificativa
  (regra 5 do `AGENTS.md`) — registrar a justificativa.

### 1.4 Row-Level Security (RLS) no Postgres — **P1**

- **O que é:** políticas no banco que forçam `WHERE company_id =
  current_setting('app.company_id')`, além do filtro da aplicação.
- **O que melhora aqui:** fecha a **L3**. Hoje o isolamento de tenant
  depende **inteiramente** de a aplicação lembrar de filtrar por
  `companyId` (regra permanente em `AGENTS.md`). São 538 testes
  cobrindo isso — mas um único `findMany` novo e esquecido é uma
  vazamento silencioso. RLS vira **defesa em profundidade**.
- **Por onde começar:** setar a variável de sessão no `PrismaService`
  por request; criar policies nas 20+ tabelas com `companyId`; rodar a
  suíte inteira para provar que nada regrediu.
- **Por que agora:** deve vir **antes** de qualquer produção
  multi-instância.

### 1.5 Redefinição de senha com token de e-mail — **P1**

- **O que é:** fluxo real de "esqueci a senha": token de uso único
  com expiração, enviado por e-mail, validado no servidor.
- **O que melhora aqui:** fecha a **L5**. Hoje
  `PASSWORD_RESET_ENABLED` redefine **sem qualquer token**
  (`auth.controller.ts:86`) — quem habilita isso em produção entrega
  a conta de qualquer usuário. Também habilita o botão do
  `/redefinir-senha` para uso real.
- **Por onde começar:** tabela `PasswordResetToken` (migration +
  `DATABASE.md`), provedor de e-mail atrás de interface (SMTP/SES),
  fila no `apps/worker` (já existe o processo único).
- **Também melhora:** permite marcar `PASSWORD_RESET_ENABLED` como
  seguro por padrão, liberando a pendência do checklist §7.

### 1.6 Cadastro público com verificação anti-abuso — **P1**

- **O que é:** limite de criação de empresa por IP/CPF, captcha ou
  convite, mais verificação de e-mail.
- **O que melhora aqui:** fecha a **L6**. `REGISTRATION_ENABLED`
  permite criar empresa + ADMIN ilimitadamente
  (`auth.controller.ts:65`); está `true` no `.env.example`, então quem
  copia o template para produção abre cadastro aberto sem barreira.
- **Por onde começar:** reaproveitar a mesma `RateLimitStore` do 1.3;
  verificação de e-mail compartilhada com o 1.5.

### 1.7 2FA/MFA para perfis ADMIN — **P2**

- **O que é:** segundo fator (TOTP) opcional/obrigatório para quem
  tem papel `ADMIN`.
- **O que melhora aqui:** uma única credencial vazada dá acesso a
  tudo que o `AdminGuard` protege (caixa, financeiro, usuários,
  exclusões). Como `Session` já guarda hash SHA-256 do token, o TOTP
  encaixa no mesmo serviço de sessão sem tocar em JWT.
- **Por onde começar:** `apps/api/src/auth/` — desafio TOTP no login,
  campo `twoFactorSecret` cifrado em `User`.

### 1.8 Trilha de auditoria exportável e imutável — **P2**

- **O que é:** log append-only de ações sensíveis (quem, o quê, quando,
  IP), com retenção e exportação sob demanda.
- **O que melhora aqui:** as regras de negócio **já** geram
  movimentos compensatórios (caixa, financeiro, vendas), mas não há um
  log único de "fulano alterou o preço X". Fecha a lacuna D1 do
  `MAPA_DE_MODULOS` (não existe edição de dados da empresa) com
  responsabilidade rastreável, e atende LGPD/auditoria.

---

## 2. Operação e confiabilidade

### 2.1 Monitoramento de erros e uptime — **P1**

- **O que é:** coleta de exceções (Sentry, GlitchTip auto-hospedado ou
  OpenTelemetry) + verificação de disponibilidade com alerta.
- **O que melhora aqui:** fecha a **L9**. Hoje um erro 500 em
  produção é descoberto pelo cliente. `AllExceptionsFilter` já monta
  status + stack — falta **enviar** isso a algum lugar e alertar.
- **Por onde começar:** `@sentry/nestjs` no `main.ts`, DSN via env;
  UptimeRobot/Healthchecks.io em `GET /health` (já existe e é
  `@Public`).

### 2.2 Deploy contínuo real (fechar o `cd.yml`) — **P1**

- **O que é:** transformar `.github/workflows/cd.yml` (hoje
  placeholder: migrations + `echo`) em deploy efetivo, com staging e
  produção, secrets no GitHub e rollback.
- **O que melhora aqui:** fecha a **L7**. Toda a CI verdes
  (`ci.yml`) não servem para nada enquanto o código não sai do
  notebook. Também é o que viabiliza os drills de backup (1.1) e o
  E2E do Mercado Pago (2.4).
- **Por onde começar:** decidir hosting (regra: sem deploy sem decisão
  explícita do proprietário); `npm run db:deploy` (já existe) para
  migrations; deploy por workspace.

### 2.3 Expiração de assinatura por job (não lazy) — **P2**

- **O que é:** cron que varre `TenantSubscription` com `periodEnd`
  vencido e a transiciona para `EXPIRED`.
- **O que melhora aqui:** fecha a **L10**. Hoje a expiração acontece
  **na leitura** — uma empresa com assinatura vencida continua
  funcionando normalmente até alguém abrir a tela certa, o que atrasa
  a cobrança e distorce os limites.
- **Por onde começar:** tarefa no `apps/worker` (já roda em loop com
  `WORKER_POLL_INTERVAL_MS`).

### 2.4 E2E do checkout Mercado Pago em sandbox — **P1**

- **O que é:** teste ponta a ponta com cartão de teste do Mercado
  Pago: checkout → preapproval → webhook → assinatura `ACTIVE`.
- **O que melhora aqui:** fecha a **L13**. O gateway está implementado
  e testado com `MockMercadoPagoProvider`
  (`tests/helpers/mercadopago-mock.ts`) — o mock prova a lógica
  interna, **não** a integração real. Sem esse E2E, ativar cobrança
  recorrente é aposta.
- **Por onde começar:** `WHATSAPP_PROVIDER` já tem padrão `mock`/`meta`
  — repetir o padrão para `MERCADOPAGO_ENV=sandbox`; job do worker
  consumindo `POST /api/webhooks/mercadopago`.

### 2.5 Fila de mensagens assíncrona de verdade — **P2**

- **O que é:** substituir o polling do worker por uma fila (BullMQ/
  Redis) com retries, dead-letter e prioridade.
- **O que melhora aqui:** o `apps/worker/src/whatsapp/processor.ts`
  faz poll periódico com `WHATSAPP_SEND_MAX_PER_CYCLE`. Isso funciona,
  mas **não escala**: várias instâncias competindo pelo `updateMany`
  atômico, sem backoff compartilhado e sem visibilidade de mensagens
  presas. Vira latência próxima de zero no envio e histórico de
  falhas.
- **Depende de:** 1.3 (Redis).

---

## 3. Desempenho e escala

### 3.1 Cache de relatórios e dashboard — **P2**

- **O que é:** cache curto (Redis ou `CacheManager`) das agregações
  de `/api/reports/summary` e `/dashboard`.
- **O que melhora aqui:** os relatórios agregam vendas/caixa por
  período **a cada load de tela**. Com histórico de 12 meses e
  movimentação alta, isso vira consulta lenta no dia a dia do
  usuário — e é a primeira tela que todos abrem.
- **Por onde começar:** invalidar no `create` de `Sale`,
  `CashMovement` e `FinancialEntry` (são os 3 que alimentam o resumo).

### 3.2 Índices sob demanda a partir do `pg_stat_statements` — **P2**

- **O que é:** ligar `pg_stat_statements`, olhar as 10 consultas mais
  caras e criar índices só onde há evidência.
- **O que melhora aqui:** já existem os índices compostos por
  `companyId` (diretriz em `DATABASE.md`), mas **nenhum** foi
  validado com dados reais de produção. Evita tanto a falta quanto o
  excesso de índice (escrita lenta).
- **Por onde começar:** rodar em staging populado com o
  `db:seed:demo`.

### 3.3 Paginação/limites obrigatórios em toda leitura — **P1**

- **O que é:** garantir que nenhuma rota `GET` possa devolver conjunto
  ilimitado.
- **O que melhora aqui:** `paginationQuerySchema` já existe e é
  usado — mas vale varrer (`/api/whatsapp/consents`,
  `/api/cash/sessions`, listas de importação) para confirmar que
  **nenhuma** rota ignora `pageSize` e devolve a base inteira. É a
  causa clássica de OOM em SaaS com muitos tenants.

---

## 4. Qualidade de código e testes

### 4.1 Cobertura de código medida na CI — **P1**

- **O que é:** `vitest run --coverage` publicando o percentual (e
  diff-cover no PR).
- **O que melhora aqui:** há **538 testes verdes** mas ninguém sabe o
  que eles **não** cobrem. Sem número, "está testado" é sensação. O
  `coverage/` já está no `.gitignore` — falta rodar com a flag e
  publicar o artefato.

### 4.2 Testes E2E de interface (Playwright) — **P1**

- **O que é:** navegando no browser nos fluxos principais: login →
  PDV → fechar caixa → ver relatório.
- **O que melhora aqui:** hoje a **validação E2E é manual** (regra de
  encerramento de etapa em `PROJECT_STATUS.md`). Os 538 testes são de
  integração da API — **nenhum** deles passa por um componente React,
  por um `fetch` do `AppShell` ou pelo rewrites do Next
  (`/api/:path*` → 3001). Um link quebrado no frontend passa 100%
  verde hoje.
- **Por onde começar:** 3 fluxos do caminho feliz; rodar no `ci.yml`
  com o dev server sobendo.

### 4.3 Upgrade das dependências de desenvolvimento — **P1**

- **O que é:** atualizar `vitest` (2.1.9 → major), `esbuild`,
  `tinypool` e `next` (→ 16.4.1) para zerar o `npm audit`.
- **O que melhora aqui:** fecha a **L1** e o achado de que **2 das 8
  vulnerabilidades são de produção** (`postcss` via `next`, severidade
  alta — XSS e path traversal). O upgrade é *breaking*, por isso
  estava adiado: precisa de janela dedicada + suíte inteira verde.
- **Por onde começar:** branch só para isso; `npm audit fix --force`
  em passos isolados (um pacote por commit); `npm run validate` entre
  cada.

### 4.4 Geração automática da documentação de API (OpenAPI) — **P2**

- **O que é:** `@nestjs/swagger` decorando os controllers e gerando
  `/api/docs` + arquivo `openapi.yaml` versionado.
- **O que melhora aqui:** `docs/architecture/API.md` é **escrito à
  mão** e foi justamente a fonte dos erros corrigidos na entrega
  anterior (rotas que não existiam, enum errado, path de webhook
  errado). Gerar da fonte torna esse tipo de erro **impossível**.
- **Por onde começar:** os schemas Zod de `@petflow/shared` já
  descrevem os payloads — há caminho para inferir deles.

### 4.5 Lint de tipos e testes de contrato entre workspaces — **P2**

- **O que é:** checar que a `API.md`, os schemas compartilhados e os
  controllers batem (ex.: toda rota documentada existe no módulo
  registrado).
- **O que melhora aqui:** repete mecanicamente a auditoria manual que
  encontrou `POST /api/whatsapp/consents` e
  `PATCH /templates/:id/approval` inexistentes.

---

## 5. Produto e UX

### 5.1 Exibir limites e uso do plano em `/faturamento` — **P1**

- **O que é:** barras de "3 de 5 usuários", "40 de 100 clientes".
- **O que melhora aqui:** fecha a **L12**. O backend **já expõe**
  `userLimit`/`clientLimit`/`productLimit` no `planSelect`, mas a tela
  não mostra — o cliente paga por limite sem conseguir enxergar o
  consumo. É conversão direta de retenção.

### 5.2 Edição dos dados da empresa (razão social, CNPJ, contato) — **P1**

- **O que é:** tela e endpoint de `PATCH /api/company` para dados da
  própria empresa.
- **O que melhora aqui:** fecha a **lacuna D1** do
  `MAPA_DE_MODULOS.md`: "configurações da empresa não existe como
  módulo". Hoje `Company` tem `name`/`slug` e **não há nenhuma forma
  de editar** — o cliente se chama errado no sistema para sempre.
  Requer `AdminGuard` + imutabilidade de `slug`.

### 5.3 Agenda: visão de semana/mês e recorrência — **P2**

- **O que é:** calendário com semana/mês, recorrência e múltiplos
  profissionais.
- **O que melhora aqui:** hoje é **visão por dia apenas** (pendência
  registrada em `PROJECT_STATUS.md`) e antecipação de lembrete fixa
  por empresa, sem janela de silêncio. Um pet shop com 30
  agendamentos/dia não consegue enxergar a semana.

### 5.4 CSV de caixa, clientes e WhatsApp — **P2**

- **O que é:** exportação `.csv` das três listas que hoje só têm
  relatório de vendas.
- **O que melhora aqui:** pendência registrada ("CSV de caixa,
  clientes e WhatsApp: não implementado"). O utilitário de exportação
  **já existe** e já tem proteção anti-injeção de fórmulas + limite de
  5000 linhas — é reaproveitar.

### 5.5 Busca global com resultados agrupados — **P2**

- **O que é:** a lupa da topbar hoje abre busca; evoluir para
  resultados agrupados por tipo (cliente, produto, venda) com atalho
  de teclado.
- **O que melhora aqui:** para um negócio com histórico longo, "achar
  o cliente" é a ação mais repetida do dia.

### 5.6 Impressão/second display no PDV — **P2**

- **O que é:** impressão de cupom não fiscal (ESC/POS ou PDF) e tela
  de cliente.
- **O que melhora aqui:** o `PDV.md` já delimita "não é cupom fiscal"
  — mas **não imprime nada**. Comprar sem conseguir dar recibo é
  atrito real no balcão.

### 5.7 Modo offline/reativo no PDV — **P3**

- **O que é:** fila local de vendas enquanto há queda de conexão.
- **O que melhora aqui:** a limitação **L4 do PDV** ("sem modo
  offline — depende de API disponível") significa que **queda de
  internet = fechar a loja**. Alto impacto, alta complexidade — por
  isso P3.

---

## 6. Plataforma e DX

### 6.1 Contrato de tipos entre frontend e API automático — **P2**

- **O que é:** tipar os `fetch` do `apps/web` contra os tipos de
  `@petflow/shared`, com checagem no `typecheck`.
- **O que melhora aqui:** a regra "nenhuma regra de negócio no
  frontend" existe, mas o frontend ainda **monta objeto à mão** para
  a API. Um campo renomeado no Zod quebra em runtime, não no build.

### 6.2 Ambiente de staging efêmero por PR — **P2**

- **O que é:** banco + app sobem por pull request, URL de preview.
- **O que melhora aqui:** o `ci.yml` já roda 538 testes com Postgres
  17 real — o próximo passo natural é **mostrar** o resultado. Também
  reduz o risco do 2.4 (E2E real) e do 4.2 (Playwright).

### 6.3 Seed de demonstração neutro por segmento — **P3**

- **O que é:** `db:seed:demo` com dados de papelaria/oficina além de
  pet shop, e um script de verificação de integridade já existente.
- **O que melhora aqui:** fecha a **L11** ("seed ainda tem Mundo
  Pet"). Rode em demonstração comercial sem parecer um sistema de
  pet shop.

### 6.4 Catálogo global de planos editável por papel de plataforma — **P3**

- **O que é:** expor escrita em `TenantPlan` atrás de um guard de
  plataforma.
- **O que melhora aqui:** fecha a **L14**. Hoje os planos se alteram
  **no banco** — operação cara e sem trilha.

---

## Resumo por prioridade

| P | Ideias |
|---|---|
| **P0** | 1.1 backup com restore testado · 1.2 LGPD |
| **P1** | 1.3 rate limit distribuído · 1.4 RLS · 1.5 senha por e-mail · 1.6 anti-abuso · 2.1 monitoramento · 2.2 CD · 2.4 E2E Mercado Pago · 3.3 limites de leitura · 4.1 cobertura · 4.2 E2E de UI · 4.3 upgrades de segurança · 5.1 uso do plano · 5.2 editar empresa |
| **P2** | 1.7 2FA · 1.8 auditoria exportável · 2.3 expiração por job · 2.5 fila real · 3.1 cache · 3.2 índices · 4.4 OpenAPI · 4.5 contrato · 5.3 agenda · 5.4 CSV · 5.5 busca · 5.6 impressão · 6.1 tipos · 6.2 staging |
| **P3** | 5.7 offline · 6.3 seed neutro · 6.4 catálogo global |

## Sugestão de sequência

1. **Antes de qualquer produção:** 1.1 → 1.2 → 1.4 → 2.2 → 2.1
   (dados seguros, conformidade, deploy com rollback, alertas).
2. **Primeiro mês de operação:** 4.3 → 4.1 → 4.2 → 2.4
   (superfície de falha medida e visível).
3. **Primeiro trimestre:** 1.5 → 1.6 → 5.1 → 5.2 → 1.3
   (produto confiável e vendável).
4. **Depois:** escala e DX (3.x, 5.3–5.6, 6.x).

## Como usar este arquivo

- Nada aqui entra em `IMPLEMENTATION_CHECKLIST.md` sem decisão do
  proprietário (regra 2 do `AGENTS.md`).
- Ao aprovar uma ideia: mover para a seção "Fora do roteiro" do
  checklist, executar, registrar em `CHANGELOG.md`,
  `PROJECT_STATUS.md` e aqui.
- Prioridades são uma **leitura atual (2026-10-14)** e mudam com o
  negócio.
