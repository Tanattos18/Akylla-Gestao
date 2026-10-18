# Akylla Gestão

**Seu negócio inteiro, num só lugar.**

Sistema online de gestão para **comércio e serviços**. Reúne:

- PDV, estoque e caixa por turno;
- contas a pagar e a receber;
- clientes, agenda e lembretes pelo WhatsApp;
- comissões, crediário e ordem de serviço;
- nota fiscal por integração;
- relatórios e importação de planilhas.

Funciona no navegador do computador, tablet ou celular, e no Windows pode
ser **instalado como aplicativo**. É multiempresa: cada empresa vê só os
próprios dados, com a separação garantida no próprio banco.

Site: [akyllagestao.com.br](https://akyllagestao.com.br/) · Sistema (após
o deploy): `https://app.akyllagestao.com.br`

> **Status (2026-10-18):** o roteiro de evolução
> [`upgrade/Prompt_Mestre.md`](upgrade/Prompt_Mestre.md) está **concluído
> em código (Fases 1 a 7)**. O sistema entrega tudo o que o site promete.
> O que falta para vender depende de contratação ou configuração do
> proprietário:
> - hospedagem (VPS, com instalação já automatizada);
> - SMTP;
> - integradora fiscal e cadastro fiscal dos produtos.
>
> Detalhes em
> [`docs/operations/PROJECT_STATUS.md`](docs/operations/PROJECT_STATUS.md).

---

## Sumário

1. [O que o site promete × o que o sistema entrega](#o-que-o-site-promete--o-que-o-sistema-entrega)
2. [Perfis: Comércio, Serviços e Híbrido](#perfis-comércio-serviços-e-híbrido)
3. [Módulos](#módulos)
4. [Mapa de telas](#mapa-de-telas)
5. [Segurança, dados e LGPD](#segurança-dados-e-lgpd)
6. [Qualidade e testes](#qualidade-e-testes)
7. [Roteiro de evolução (7 fases)](#roteiro-de-evolução-7-fases)
8. [Como executar (desenvolvimento)](#como-executar-desenvolvimento)
9. [Colocar no ar (VPS) e instalar como aplicativo](#colocar-no-ar-vps-e-instalar-como-aplicativo)
10. [Backup e restauração](#backup-e-restauração)
11. [Estrutura do repositório](#estrutura-do-repositório)
12. [Tecnologias](#tecnologias)
13. [Documentação](#documentação)

---

## O que o site promete × o que o sistema entrega

| Promessa do site | Situação |
|---|---|
| Frente de caixa (nome, código, leitor), descontos, várias formas de pagamento, baixa automática no estoque | ✅ `/pdv` |
| Caixa por turno com valor esperado e diferença | ✅ `/caixa` |
| Estoque com saldo em tempo real e alerta de mínimo | ✅ `/produtos` |
| Contas a pagar e a receber com vencimento | ✅ `/financeiro` |
| Clientes, histórico de compras e aviso de cadastro duplicado | ✅ `/clientes` |
| Painel e relatórios por período, com exportação e impressão | ✅ `/dashboard`, `/relatorios` |
| Agenda com conflito de horário e lembrete automático pelo WhatsApp | ✅ `/agenda` (dia, semana e mês), `/whatsapp` |
| Importação de clientes e produtos por CSV com prévia de erros | ✅ `/importacoes` |
| Equipe vende e atende; o dono controla caixa, usuários e configurações | ✅ perfis ADMIN/MEMBER validados no servidor |
| Cada empresa só acessa os próprios dados | ✅ no servidor **e** no banco (Row-Level Security do PostgreSQL) |
| Planos Essencial / Profissional / Completo com limites | ✅ R$ 79,90 / 149,90 / 249,90 por mês (anual com 2 meses grátis), teste de 14 dias, somente leitura para inadimplente e painel do dono para ativar planos ([`COBRANCA.md`](docs/akylla/COBRANCA.md)) |
| Perfis Comércio, Serviços e Híbrido | ✅ escolha guiada no cadastro (`/onboarding`), páginas `/para/comercio`, `/para/servicos`, `/para/hibrido` |
| Comissões | ✅ `/comissoes`, `/profissionais`: regras por produto, categoria e profissional, cálculo no PDV e na OS, pagamento pelo caixa |
| Crediário | ✅ `/crediario` + PDV: limite por cliente, parcelas calculadas no servidor, vencidas, recebimento pelo caixa |
| Ordem de serviço com fotos | ✅ `/os`: orçamento → aprovação → execução → conclusão, fotos/PDF, baixa de peças, conta a receber e comissão |
| Nota fiscal (NFC-e, NF-e, NFS-e) por integração | 🟡 módulo pronto com **emissora simulada** (`/fiscal`, botões no PDV, na venda e na OS); emissão real depende de contratar a integradora ([`FISCAL.md`](docs/akylla/FISCAL.md)) |

---

## Perfis: Comércio, Serviços e Híbrido

Depois de confirmar o e-mail, o administrador escolhe o perfil e o
sistema liga os módulos certos. Dá para trocar depois em
**Configurações**.

| Perfil | Para quem | Módulos ligados |
|---|---|---|
| **Comércio** | lojas, mercadinhos, adegas, papelarias, conveniência | nota fiscal, comissões, crediário, WhatsApp |
| **Serviços** | salões, clínicas, oficinas, assistências técnicas | serviços, agenda, ordem de serviço, comissões, WhatsApp |
| **Comércio e serviços** | pet shops, oficinas com loja, estúdios que vendem produtos | os dois conjuntos + crediário |
| **Personalizado** | quem quer escolher | liga/desliga módulo a módulo |

Módulo desligado some do menu e tem as rotas **bloqueadas no servidor**
(`ModuleGuard`), mas os dados são mantidos. O núcleo nunca é desligado:
PDV, estoque, caixa, financeiro, clientes e relatórios. Regras em
[`ONBOARDING.md`](docs/akylla/ONBOARDING.md).

---

## Módulos

### Núcleo (sempre ativo)

| Módulo | O que entrega |
|---|---|
| **Autenticação e usuários** | sessão em cookie `HttpOnly`, perfis ADMIN/MEMBER, 2FA (TOTP) para administradores, confirmação de e-mail no cadastro, recuperação de senha |
| **Empresa** | nome, CNPJ/CPF, telefone e endereço (saem no comprovante), identificador único, perfil e módulos (`/configuracoes`) |
| **Clientes** | busca, contatos normalizados, histórico e aviso de duplicidade |
| **Produtos, categorias, fornecedores e estoque** | SKU e código de barras únicos por empresa, entradas, saídas e ajustes em histórico que não se apaga, alerta de mínimo |
| **Vendas / PDV** | busca por nome, SKU ou código de barras, desconto, formas de pagamento (inclusive crediário), comprovante impresso, cancelamento auditado |
| **Caixa** | turno com abertura e fechamento, valor esperado × contado, entradas, saídas e estornos auditados |
| **Financeiro (AP/AR)** | contas a pagar e a receber com vencimento, baixa pelo caixa e estorno |
| **Dashboard e relatórios** | indicadores calculados no servidor, filtros por período, CSV seguro e impressão |
| **Busca global** | barra do topo: clientes, produtos, vendas, OS, serviços e pets, com navegação por teclado |
| **Importação de planilhas** | CSV de categorias, fornecedores, produtos, clientes e serviços, com simulação antes de gravar |
| **Faturamento (SaaS)** | plano da empresa, uso × limites, checkout Mercado Pago (sandbox) |

### Módulos opcionais

| Módulo | O que entrega |
|---|---|
| **Comissões** | profissionais, regras (produto > categoria > profissional > empresa), desconto rateado, liberação e pagamento pelo caixa ([regras](docs/akylla/COMISSOES.md)) |
| **Crediário** | venda a prazo com parcelas mensais, limite por cliente, vencidas e recebimento ([regras](docs/akylla/CREDIARIO.md)) |
| **Ordem de serviço** | estados estritos, itens (produtos, serviços, livres), anexos com fotos/PDF, conclusão com estoque, financeiro e comissão ([regras](docs/akylla/ORDEM_DE_SERVICO.md)) |
| **Nota fiscal** | NFC-e/NF-e na venda e NFS-e na OS por integradora, token e certificado A1 **cifrados**, webhook assinado, cancelamento com justificativa ([regras](docs/akylla/FISCAL.md)) |
| **Serviços** | catálogo com preço e duração |
| **Agendamentos** | agenda por dia, semana e mês, conflito de horário, status e lembretes |
| **WhatsApp** | Cloud API oficial da Meta: templates, consentimento, fila com retentativas e webhook assinado |
| **Assinaturas de clientes** | planos recorrentes pagos no caixa, com renovação e cancelamento auditados |
| **Pets** | ficha de animais vinculada ao cliente |

---

## Mapa de telas

| Rota | Para quê |
|---|---|
| `/para/comercio`, `/para/servicos`, `/para/hibrido` | páginas públicas por perfil |
| `/login`, `/cadastro`, `/confirmar-email`, `/redefinir-senha` | entrar, criar conta e recuperar a senha |
| `/termos`, `/privacidade` | termos de uso e política de privacidade |
| `/onboarding`, `/configuracoes` | perfil do negócio, dados da empresa e módulos |
| `/pdv`, `/vendas` | vender, comprovante e histórico |
| `/caixa`, `/financeiro` | turnos, movimentos e contas a pagar/receber |
| `/crediario` | contas e parcelas do crediário |
| `/comissoes`, `/profissionais` | comissões e equipe comissionada |
| `/os` | ordens de serviço |
| `/fiscal` | configuração e notas emitidas |
| `/clientes`, `/pets` | clientes e fichas de animais |
| `/produtos`, `/categorias`, `/fornecedores` | catálogo e estoque |
| `/servicos`, `/agenda` | serviços e agendamentos |
| `/planos`, `/assinaturas` | assinaturas de clientes |
| `/whatsapp/*` | configuração, templates, consentimento e envios |
| `/importacoes` | importar planilhas |
| `/dashboard`, `/relatorios` | indicadores, exportação e impressão |
| `/usuarios`, `/faturamento` | equipe e plano da empresa (admin) |
| `/plataforma` | painel do dono: todas as empresas, pagamentos, teste, isenção e suspensão |

Documentação da API: `/api/docs` (Swagger, gerada do código).

---

## Segurança, dados e LGPD

| Compromisso | Como é cumprido |
|---|---|
| **Isolamento por empresa** | `companyId` sempre vem da sessão. Registro de outra empresa responde 404. **RLS no PostgreSQL** (`ENABLE` + `FORCE` + política `tenant_isolation` em todas as tabelas com empresa), com a API rodando num role **sem** superusuário ou `BYPASSRLS` ([ADR-0001](docs/architecture/ADR-0001-tenant-defense.md)) |
| **Cálculos no servidor** | preços, totais, saldos, parcelas e comissões são sempre recalculados no backend |
| **Histórico que não se apaga** | vendas, estoque e caixa são registro contínuo; correção vira lançamento compensatório com autor, data e motivo |
| **Dinheiro** | `Decimal(12,2)` no banco e transmitido como texto; nunca ponto flutuante |
| **Concorrência** | travas `FOR UPDATE` em ordem fixa (caixa → produtos) e atualizações condicionais (409 em conflito) |
| **Autenticação** | bcrypt, sessão com hash SHA-256 no banco, rate limit (Redis opcional), confirmação de e-mail, captcha Turnstile opcional, 2FA para admin |
| **Segredos fiscais** | token e certificado A1 cifrados com AES-256-GCM; nunca devolvidos pela API |
| **Webhooks** | Mercado Pago, WhatsApp e fiscal com assinatura HMAC em tempo constante, anti-replay, e recusa total sem segredo configurado |
| **LGPD** | consentimento registrado, exportação e anonimização de cliente, exportação completa da empresa |
| **Backup** | dump diário com **restauração testada automaticamente** em banco temporário |
| **Monitoramento** | Sentry em API, worker e web (sem dados pessoais) e `GET /health/ready` para o UptimeRobot; procedimentos em [`RUNBOOK.md`](docs/operations/RUNBOOK.md) |
| **Segredos** | só em `.env` (fora do Git); `.env.example` sem valores reais; varredura de segredos na CI |

---

## Qualidade e testes

| Verificação | Resultado (2026-10-18) |
|---|---|
| `npm run validate` (lint, typecheck, testes, build, schema) | ✅ verde |
| Testes de integração em PostgreSQL real | **733/733** (42 arquivos), incluindo isolamento por RLS |
| Cobertura de services/controllers da API | **93,7%** das linhas (CI falha se cair) |
| E2E no navegador (Playwright) | **7 fluxos**: login; cliente; caixa → venda → NFC-e → fechamento; importação CSV; rota protegida; CNPJ no comprovante + busca global; agenda semana/mês |
| Acessibilidade (axe, WCAG 2.1 AA) | **0 violações** em 36 telas |
| Contrato da API | toda rota do código documentada em `API.md` (teste falha se não estiver) |
| `npm audit` (produção) | 0 vulnerabilidades |

A CI do GitHub roda tudo isso a cada envio para a `main`.

---

## Roteiro de evolução (7 fases)

Especificação completa em [`upgrade/Prompt_Mestre.md`](upgrade/Prompt_Mestre.md).

| Fase | Tema | Entregas | Status |
|---|---|---|---|
| **1** | Confiabilidade | backup testado, Sentry + runbook, rate limit Redis, verificação de e-mail, RLS, `npm audit` = 0, CI/CD | ✅ |
| **2** | Retenção | comissões, crediário, ordem de serviço com anexos | ✅ |
| **3** | Fiscal | NFC-e / NF-e / NFS-e por integração (emissora simulada; integradora real 🟡 depende de contrato) | ✅ código |
| **4** | Perfis | onboarding Comércio / Serviços / Híbrido, configurações de módulos, páginas por perfil | ✅ |
| **5** | Design e UX | tabela, diálogo, avisos e abas padronizados; impressão; acessibilidade | ✅ |
| **6** | Qualidade | cobertura na CI, E2E Playwright, OpenAPI em `/api/docs`, teste de contrato | ✅ |
| **7** | Produto | dados da empresa no comprovante, uso do plano, busca global, agenda semana/mês, seeds por segmento, impressão de relatórios | ✅ |
| **Extra** | Distribuição | instalação automatizada em VPS; aplicativo instalável no Windows (PWA) | ✅ |
| **8** | Cobrança do SaaS | teste grátis de 14 dias, tolerância, somente leitura, painel do dono (`/plataforma`), 2FA em Configurações | ✅ (Mercado Pago em produção 🟡) |

**Pendências do proprietário:**
- ✅ **sistema no ar** em `https://app.akyllagestao.com.br` (VPS
  Hostinger KVM 1); falta ativar o 2FA do dono;
- SMTP para os e-mails de confirmação;
- Redis e Turnstile (opcionais);
- integradora fiscal, cadastro fiscal dos produtos e certificado A1;
- UptimeRobot.

**Fora do escopo:** modo offline completo, emissor fiscal próprio, ERP
contábil e RH/folha.

---

## Como executar (desenvolvimento)

### Pré-requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | 22+ |
| npm | 10+ |
| PostgreSQL | 17 (porta 5432); `pg_dump`/`pg_restore`/`psql` são usados pelo backup |
| Git | 2.x |

### Instalação

```bash
git clone https://github.com/Tanattos18/Akylla-Gestao.git
cd Akylla-Gestao
npm run setup:dev   # .env, dependências, Prisma, migrations e admin inicial
```

Ou manualmente:

1. `npm install`;
2. `cp .env.example .env` e preencher `DATABASE_URL` e `BOOTSTRAP_*`;
3. `npm run db:migrate`;
4. `npm run bootstrap:admin`.

> O `.env` não é versionado e `.env.example` é o único template. Os nomes
> `petflow` (banco), `petflow_session` (cookie) e `@petflow/*` (pacotes)
> são identificadores técnicos legados, mantidos por compatibilidade.

### Rodar (três terminais)

```bash
npm run dev:api      # API    → http://localhost:3001/health  (docs: /api/docs)
npm run dev:web      # Web    → http://localhost:3000
npm run dev:worker   # fila do WhatsApp
```

### Verificações

```bash
npm run validate       # lint + typecheck + test + build + db:validate (obrigatório)
npm run test:coverage  # testes + cobertura

# Com API (3001) e web (3000) no ar:
npm run test:e2e       # fluxos no navegador (Playwright)
npm run test:a11y      # acessibilidade (axe)
```

### Dados de demonstração

```bash
npm run db:seed:demo -- --company=<slug|id|e-mail-do-admin> --preset=comercio
```

Os presets (sempre numa empresa vazia) são:
- `comercio` (padrão): Empório Central;
- `servicos`: Studio Beleza;
- `alimentacao`: Padaria Pão Quente;
- `pet`: Mundo Pet.

Cada um cria catálogo, clientes, 30 dias de vendas e caixa, agenda,
assinaturas e WhatsApp de exemplo. Na VPS, o comando é
`sudo bash /opt/akylla/scripts/deploy/vps/create-demo.sh comercio`.
Planilhas fictícias para demonstrar a importação: [`docs/demo/`](docs/demo/LEIA-ME.md).

---

## Colocar no ar (VPS) e instalar como aplicativo

O site de divulgação continua na hospedagem atual. O sistema roda numa
**VPS Ubuntu 24.04** (ex.: Hostinger KVM 2) no subdomínio
`app.akyllagestao.com.br`. Guia completo em
[`DEPLOY_VPS.md`](docs/operations/DEPLOY_VPS.md).

```bash
curl -fsSL https://raw.githubusercontent.com/Tanattos18/Akylla-Gestao/main/scripts/deploy/vps/install.sh -o install.sh
sudo bash install.sh app.akyllagestao.com.br seu@email.com   # instala tudo
sudo bash /opt/akylla/scripts/deploy/vps/create-admin.sh     # primeira empresa e admin
sudo bash /opt/akylla/scripts/deploy/vps/update.sh           # atualizações futuras
```

O `install.sh` instala Node 22, PostgreSQL 17 e Caddy (HTTPS automático)
e sobe API, web e worker no systemd. Também configura o firewall e o
backup diário. As senhas e chaves são geradas **no próprio servidor**.

**Aplicativo no Windows (PWA):** com o sistema no ar, abra o endereço no
Edge ou no Chrome e clique em **"Instalar aplicativo"**. O Akylla ganha
ícone no menu Iniciar e janela própria, com atalhos para PDV, Vendas,
Caixa e Agenda. Os dados continuam no servidor; sem internet aparece a
tela "Sem conexão".

Outros provedores (Render, Railway…):
[`DEPLOY.md`](docs/operations/DEPLOY.md).

---

## Backup e restauração

```bash
npm run db:backup                 # dump + retenção (30 dias) + restore testado em banco temporário
npm run db:backup -- --retain=7   # outra retenção
npm run db:restore-test           # só testa o restore do dump mais recente
npm run db:restore -- <arquivo>   # restaura (destrutivo; confira o banco alvo)
```

O restore só passa se o banco restaurado tiver as mesmas linhas, as
mesmas migrations e nenhuma diferença em relação ao `schema.prisma`.
Agendamento, cópia externa, RPO ≤ 24 h e RTO ≤ 4 h estão em
[`backup/README.md`](backup/README.md).

---

## Estrutura do repositório

```
apps/
  api/       API (NestJS): prefixo /api, /health fora, OpenAPI em /api/docs
  web/       interface (Next.js): proxy /api → API; PWA (manifest, sw.js)
  worker/    fila do WhatsApp
packages/
  shared/    schemas Zod, tipos e constantes (@petflow/shared)
  whatsapp/  provedor WhatsApp (Meta/Mock)
  config/    tsconfig base
database/    schema Prisma e migrations versionadas (com RLS)
config/      ESLint, Vitest, Playwright
scripts/     setup:dev, db, db-backup, validate, check-secrets, check-migrations, a11y
  deploy/vps/  install.sh, update.sh, create-admin.sh
tests/
  helpers/       infraestrutura de testes
  integration/   integração (Vitest + Supertest, PostgreSQL real)
  e2e/           fluxos no navegador (Playwright)
backup/      dumps locais (fora do Git; só o README é versionado)
upgrade/     roteiro de evolução e catálogos de melhorias
docs/        documentação (índice em docs/README.md)
.github/     CI (lint, testes + cobertura, build, navegador), CD e Dependabot
Arquivos Sem USO/  arquivo local de itens fora de uso (ignorado pelo Git)
```

---

## Tecnologias

| Camada | Stack |
|---|---|
| Frontend | Next.js 16 · React 19 · Tailwind CSS 4 · PWA |
| Backend | NestJS 11 · TypeScript estrito · Zod · Swagger/OpenAPI |
| Banco | PostgreSQL 17 (RLS) · Prisma 5 |
| Integrações | WhatsApp Cloud API (Meta) · Mercado Pago · integradora fiscal (abstraída) · SMTP · Cloudflare Turnstile · Sentry |
| Testes | Vitest · Supertest · Playwright · axe-core |
| Infra | npm workspaces · GitHub Actions · Ubuntu + Caddy + systemd |

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [Índice da documentação](docs/README.md) | mapa completo por finalidade |
| [Status do projeto](docs/operations/PROJECT_STATUS.md) | fase atual, entregas e pendências |
| [Changelog](docs/operations/CHANGELOG.md) | histórico de alterações |
| [Checklist de implementação](docs/operations/IMPLEMENTATION_CHECKLIST.md) | progresso item a item |
| [Deploy em VPS](docs/operations/DEPLOY_VPS.md) · [Deploy (outros provedores)](docs/operations/DEPLOY.md) · [Runbook](docs/operations/RUNBOOK.md) | colocar no ar e operar |
| [API](docs/architecture/API.md) · [Banco](docs/architecture/DATABASE.md) · [Arquitetura](docs/architecture/ARCHITECTURE.md) | referência técnica |
| [Cobrança do SaaS](docs/akylla/COBRANCA.md) · [Comissões](docs/akylla/COMISSOES.md) · [Crediário](docs/akylla/CREDIARIO.md) · [OS](docs/akylla/ORDEM_DE_SERVICO.md) · [Fiscal](docs/akylla/FISCAL.md) · [Onboarding](docs/akylla/ONBOARDING.md) | regras de negócio dos módulos |
| [Componentes e acessibilidade](docs/akylla/DESIGN_SYSTEM.md) | padrão visual e auditoria |
| [Go/No-go para venda](docs/akylla/GO_NO_GO.md) · [Checklist pré-produção](docs/akylla/CHECKLIST_PRE_PRODUCAO.md) | critérios para o primeiro cliente pagante |
| [Roteiro de evolução](upgrade/Prompt_Mestre.md) · [Referências no GitHub](upgrade/REFERENCIAS_GIT.md) | as 7 fases e repositórios de apoio |
| [AGENTS.md](AGENTS.md) | regras para agentes de desenvolvimento |
