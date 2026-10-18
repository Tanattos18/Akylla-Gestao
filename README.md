# Akylla Gestão

**Seu negócio inteiro, num só lugar.**

Sistema online de gestão para **comércio e serviços**: frente de caixa,
estoque, caixa por turno, contas a pagar e a receber, clientes, agenda
com lembretes pelo WhatsApp, relatórios e importação de planilhas. Roda
no navegador do computador, tablet ou celular, sem instalar nada. É
multiempresa: cada empresa vê só os próprios dados.

Site: [akyllagestao.com.br](https://akyllagestao.com.br/)

> **Status (2026-10-18):** o produto base está pronto, com as Etapas 0–12
> do roteiro original concluídas. A versão atual segue o roteiro de
> evolução [`upgrade/Prompt_Mestre.md`](upgrade/Prompt_Mestre.md), cuja
> meta é entregar tudo o que o site promete e deixar o sistema pronto
> para venda paga. **Fase 1 (Confiabilidade) em andamento.** O andamento
> detalhado fica em
> [`docs/operations/PROJECT_STATUS.md`](docs/operations/PROJECT_STATUS.md).

---

## Sumário

1. [O que o site promete × o que o sistema entrega](#o-que-o-site-promete--o-que-o-sistema-entrega)
2. [Perfis: Comércio, Serviços e Híbrido](#perfis-comércio-serviços-e-híbrido)
3. [Módulos](#módulos)
4. [Segurança, dados e LGPD](#segurança-dados-e-lgpd)
5. [Roteiro de evolução (7 fases)](#roteiro-de-evolução-7-fases)
6. [Como executar](#como-executar)
7. [Backup e restauração](#backup-e-restauração)
8. [Estrutura do repositório](#estrutura-do-repositório)
9. [Tecnologias](#tecnologias)
10. [Documentação](#documentação)

---

## O que o site promete × o que o sistema entrega

| Promessa do site | Situação no sistema |
|---|---|
| Frente de caixa (nome, código, leitor), descontos, várias formas de pagamento, baixa automática no estoque | ✅ disponível (`/pdv`) |
| Caixa por turno com valor esperado e diferença | ✅ disponível (`/caixa`) |
| Estoque com saldo em tempo real e alerta de mínimo | ✅ disponível (`/produtos`) |
| Contas a pagar e a receber com vencimento | ✅ disponível (`/financeiro`) |
| Clientes, histórico de compras e aviso de cadastro duplicado | ✅ disponível (`/clientes`) |
| Painel e relatórios por período com exportação para planilha | ✅ disponível (`/dashboard`, `/relatorios`) |
| Agenda com conflito de horário e lembrete automático pelo WhatsApp | ✅ disponível (`/agenda`, `/whatsapp`) |
| Importação de clientes e produtos por CSV com prévia de erros | ✅ disponível (`/importacoes`) |
| Equipe vende e atende; o dono controla caixa, usuários e configurações | ✅ perfis ADMIN/MEMBER validados no servidor |
| Cada empresa só acessa os próprios dados | ✅ isolamento no servidor; RLS no banco na Fase 1 |
| Planos Essencial / Profissional / Completo com limites | ✅ billing SaaS com limites de usuários, clientes e produtos (Mercado Pago em sandbox) |
| Perfis Comércio, Serviços e Híbrido | 🟡 hoje por ativação manual de módulos; escolha guiada no cadastro na **Fase 4** |
| **Em breve:** comissões | 🔜 **Fase 2** |
| **Em breve:** crediário | 🔜 **Fase 2** |
| **Em breve:** ordem de serviço com fotos | 🔜 **Fase 2** |
| **Em breve:** nota fiscal (NFC-e, NF-e, NFS-e) por integração | 🔜 **Fase 3**, via emissor autorizado, sem emissor próprio |

---

## Perfis: Comércio, Serviços e Híbrido

Todas as empresas usam o mesmo produto. O que muda é o conjunto de
**módulos ativos** de cada uma:

| Perfil | Para quem | Módulos típicos |
|---|---|---|
| **Comércio** | lojas, mercadinhos, adegas, papelarias, conveniência | PDV, estoque, caixa, financeiro, WhatsApp. Na Fase 2/3: crediário, comissões e nota fiscal |
| **Serviços** | salões, clínicas, oficinas, assistências técnicas | serviços, agenda, WhatsApp, assinaturas de clientes. Na Fase 2: OS e comissões |
| **Híbrido** | pet shops, oficinas com loja, estúdios que vendem produtos | os dois conjuntos. A ficha de **pets** é um módulo opcional |

A ativação fica na tabela `CompanyModule`. Linha `DISABLED` bloqueia as
rotas do módulo **no servidor** (`ModuleGuard`). A interface só
acompanha o que o servidor permite e não serve como controle de acesso.
O núcleo (clientes, produtos, vendas, caixa, financeiro, relatórios,
billing) nunca pode ser desativado.

---

## Módulos

### Núcleo (sempre ativo)

| Módulo | O que entrega |
|---|---|
| **Autenticação e usuários** | sessão em cookie `HttpOnly`, perfis ADMIN/MEMBER, 2FA (TOTP) para administradores, recuperação de senha por token enviado por e-mail |
| **Clientes** | busca, contatos normalizados, histórico e aviso de duplicidade |
| **Produtos, categorias, fornecedores e estoque** | SKU e código de barras únicos por empresa, entradas, saídas e ajustes em histórico que não se apaga, alerta de mínimo |
| **Vendas / PDV** | busca por nome, SKU ou código de barras, desconto, formas de pagamento, comprovante, cancelamento auditado e proteção contra venda duplicada |
| **Caixa** | turno com abertura e fechamento, valor esperado × contado, entradas, saídas e estornos auditados |
| **Financeiro (AP/AR)** | contas a pagar e a receber com vencimento, status e baixa |
| **Dashboard e relatórios** | indicadores calculados no servidor, filtros por período, CSV protegido contra injeção de fórmulas |
| **Importação de planilhas** | CSV de categorias, fornecedores, produtos, clientes e serviços, com simulação antes de gravar, deduplicação e relatório de erros |
| **Faturamento (billing SaaS)** | plano da empresa, uso × limites, checkout Mercado Pago (sandbox) |

### Módulos opcionais

| Módulo | O que entrega |
|---|---|
| **Serviços** | catálogo com preço e duração |
| **Agendamentos** | agenda diária, conflito de horário, status e lembretes |
| **WhatsApp** | Cloud API oficial da Meta: templates, consentimento, fila com retentativas e webhook assinado |
| **Assinaturas de clientes** | planos recorrentes pagos no caixa, com renovação e cancelamento auditados |
| **Pets** | ficha de animais vinculada ao cliente (nicho) |

### Mapa de páginas

| Rota | Para quê |
|---|---|
| `/login`, `/cadastro`, `/redefinir-senha` | entrar, criar conta (com aceite de termos) e recuperar a senha |
| `/termos`, `/privacidade` | termos de uso e política de privacidade |
| `/pdv`, `/vendas` | vender e consultar o histórico |
| `/caixa`, `/financeiro` | turnos, movimentos e contas a pagar/receber |
| `/clientes`, `/pets` | clientes e fichas de animais |
| `/produtos`, `/categorias`, `/fornecedores` | catálogo e estoque |
| `/servicos`, `/agenda` | serviços e agendamentos |
| `/planos`, `/assinaturas` | assinaturas de clientes |
| `/whatsapp/*` | configuração, templates, consentimento e envios |
| `/importacoes` | importar planilhas |
| `/dashboard`, `/relatorios` | indicadores e exportação |
| `/usuarios`, `/faturamento` | equipe e plano da empresa (admin) |

---

## Segurança, dados e LGPD

| Compromisso | Como é cumprido |
|---|---|
| **Isolamento por empresa** | `companyId` sempre vem da sessão, nunca do cliente. Leitura de registro de outra empresa responde 404. Guard ORM de tenant ([ADR-0001](docs/architecture/ADR-0001-tenant-defense.md)) e RLS no PostgreSQL na Fase 1 |
| **Cálculos no servidor** | preços, totais, saldos de estoque e de caixa são sempre recalculados no backend |
| **Histórico que não se apaga** | vendas, estoque e caixa funcionam como registro contínuo. Correção vira lançamento compensatório com autor, data e motivo |
| **Dinheiro sem arredondamento errado** | `Decimal(12,2)` no banco e transmitido como texto; nunca ponto flutuante |
| **Concorrência** | travas `FOR UPDATE` em ordem fixa (caixa → produtos), então vendas simultâneas não corrompem saldos |
| **Autenticação** | bcrypt, sessão com hash SHA-256 no banco, rate limit de login e de cadastro, 2FA para admin, cabeçalhos de segurança |
| **LGPD** | consentimento registrado, exportação dos dados do cliente, anonimização (`/api/lgpd/...`) que preserva os registros financeiros, exportação completa da empresa (`GET /api/company/export`) |
| **Pagamentos** | webhook do Mercado Pago com assinatura comparada em tempo constante, anti-replay e bloqueio total se o segredo não estiver configurado |
| **Backup** | dump diário com **restauração testada automaticamente** em banco temporário (ver [Backup e restauração](#backup-e-restauração)) |
| **Segredos** | só em `.env`, que não vai para o Git. `.env.example` sem valores reais e varredura de segredos no repositório |

**Verificação atual:** `npm run validate` verde, com lint 0, typecheck
OK, **584/584 testes** em PostgreSQL real (30 arquivos), build OK e
`db:validate` OK.

---

## Roteiro de evolução (7 fases)

Fases em ordem rígida: uma só começa quando os critérios de aceite da
anterior estão verdes. A especificação completa está em
[`upgrade/Prompt_Mestre.md`](upgrade/Prompt_Mestre.md).

| Fase | Tema | Conteúdo | Status |
|---|---|---|---|
| **1** | Confiabilidade | backup com restore testado ✅, Sentry + runbook, CD real, rate limit Redis, verificação de e-mail, RLS, `npm audit` = 0 | 🚧 em andamento |
| **2** | Retenção | comissões, crediário, ordem de serviço com anexos | ⬜ |
| **3** | Fiscal | NFC-e / NF-e / NFS-e via integração (provedor abstraído, credenciais criptografadas) | ⬜ |
| **4** | Perfis | onboarding Comércio / Serviços / Híbrido, landing pages por segmento | ⬜ |
| **5** | Design e UX | componentes compartilhados, impressão de cupom, acessibilidade | ⬜ |
| **6** | Qualidade | cobertura na CI, E2E com Playwright, OpenAPI em `/api/docs` | ⬜ |
| **7** | Produto | edição da empresa, busca global, agenda semana/mês, seeds por segmento | ⬜ |

**Fora do escopo:** modo offline completo, emissor fiscal próprio,
ERP contábil e RH/folha.

---

## Como executar

### Pré-requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | 20+ (testado no 24) |
| npm | 11+ |
| PostgreSQL | 17 (porta 5432); os binários `pg_dump`/`pg_restore`/`psql` são usados pelo backup |
| Git | 2.x |

### Instalação rápida

```bash
git clone https://github.com/Tanattos18/Akylla-Gestao.git
cd Akylla-Gestao
npm run setup:dev   # .env, dependências, Prisma, migrations e admin inicial
```

Ou manualmente: `npm install`, `cp .env.example .env` (preencha
`DATABASE_URL` e `BOOTSTRAP_*`), `npm run db:migrate` e
`npm run bootstrap:admin`.

> O `.env` não é versionado. `.env.example` é o único template. Os nomes
> `petflow` (banco), `petflow_session` (cookie) e `@petflow/*` (pacotes)
> são identificadores técnicos legados, mantidos por compatibilidade.

### Rodar (três terminais)

```bash
npm run dev:api      # API    → http://localhost:3001/health
npm run dev:web      # Web    → http://localhost:3000
npm run dev:worker   # fila do WhatsApp
```

### Verificações (obrigatórias antes de concluir qualquer mudança)

```bash
npm run validate     # lint + typecheck + test + build + db:validate
```

### Dados de demonstração

```bash
npm run db:seed:demo -- --company=<slug|id|e-mail-do-admin>
```

O seed ainda usa dados de pet shop. Seeds por segmento estão previstos
para a Fase 7.

---

## Backup e restauração

```bash
npm run db:backup                 # dump + retenção (30 dias) + restore testado em banco temporário
npm run db:backup -- --retain=7   # outra retenção
npm run db:restore-test           # só testa o restore do dump mais recente
npm run db:restore -- <arquivo>   # restaura (destrutivo; confira o banco alvo)
```

O restore só passa se o banco restaurado tiver as mesmas linhas em
todas as tabelas, as mesmas migrations e nenhuma diferença em relação ao
`schema.prisma`. Agendamento (cron `0 2 * * *`), cópia externa (S3/B2),
RPO ≤ 24 h e RTO ≤ 4 h estão em [`backup/README.md`](backup/README.md).

---

## Estrutura do repositório

```
apps/
  api/       API (NestJS) — prefixo /api, /health fora
  web/       interface (Next.js) — proxy /api → :3001
  worker/    fila do WhatsApp (PostgreSQL, sem Redis)
packages/
  shared/    schemas Zod, tipos e constantes (@petflow/shared)
  whatsapp/  provedor WhatsApp (Meta/Mock)
  config/    tsconfig base
database/    schema Prisma e migrations versionadas
config/      ESLint, Vitest, Playwright
scripts/     setup:dev, db, db-backup, validate, check-secrets, check-migrations
tests/
  helpers/       infraestrutura de testes
  integration/   testes de integração (Vitest + Supertest, PostgreSQL real)
backup/      dumps locais (fora do Git; só o README é versionado)
upgrade/     roteiro de evolução e catálogos de melhorias
docs/        documentação (índice em docs/README.md)
.github/     CI, CD e Dependabot
Arquivos Sem USO/        arquivo local de itens fora de uso (ignorado pelo Git)
```

---

## Tecnologias

| Camada | Stack |
|---|---|
| Frontend | Next.js 15 · React 19 · Tailwind CSS 4 |
| Backend | NestJS 11 · TypeScript estrito · Zod |
| Banco | PostgreSQL 17 · Prisma 5 |
| Integrações | WhatsApp Cloud API (Meta) · Mercado Pago |
| Testes | Vitest · Supertest · PostgreSQL real |
| Monorepo | npm workspaces |

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [Índice da documentação](docs/README.md) | mapa completo por finalidade |
| [Roteiro de evolução](upgrade/Prompt_Mestre.md) | as 7 fases, regras e critérios de aceite |
| [Status do projeto](docs/operations/PROJECT_STATUS.md) | fase atual, entregas e pendências |
| [Checklist de implementação](docs/operations/IMPLEMENTATION_CHECKLIST.md) | progresso item a item |
| [Changelog](docs/operations/CHANGELOG.md) | histórico de alterações |
| [Go/No-go para venda](docs/akylla/GO_NO_GO.md) | critérios para liberar o primeiro cliente pagante |
| [Checklist pré-produção](docs/akylla/CHECKLIST_PRE_PRODUCAO.md) | limitações conhecidas (L1–L14) |
| [Documento técnico completo](docs/AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md) | visão única do sistema |
| [Arquitetura](docs/architecture/ARCHITECTURE.md) · [API](docs/architecture/API.md) · [Banco](docs/architecture/DATABASE.md) | referência técnica |
| [Desenvolvimento](docs/operations/DEVELOPMENT.md) | ambiente local |
| [AGENTS.md](AGENTS.md) | regras para agentes de desenvolvimento |
