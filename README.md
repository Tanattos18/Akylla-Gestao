# Akylla Gestão

**SaaS multiempresa de gestão para pequenos negócios brasileiros.**

Centralize clientes, produtos, estoque, vendas, caixa, financeiro,
agendamentos e comunicação com clientes em um único sistema — com
isolamento total entre empresas, permissões por perfil e trilha de
auditoria em cada operação.

> **Status:** 12 de 12 etapas do roadmap Akylla concluídas
> (fundação + núcleo genérico + módulos + billing SaaS + checklist
> pré-produção). Painel com layout topbar escura (opção B). Detalhes em
> [`docs/operations/PROJECT_STATUS.md`](docs/operations/PROJECT_STATUS.md)
> e índice completo em [`docs/README.md`](docs/README.md).

---

## Sumário

1. [Propósito](#propósito)
2. [Para quem é](#para-quem-é)
3. [Módulos](#módulos)
4. [Ativação por segmento](#ativação-por-segmento)
5. [Como funciona a operação](#como-funciona-a-operação)
6. [Qualidade, segurança e auditoria](#qualidade-segurança-e-auditoria)
7. [Como executar o projeto](#como-executar-o-projeto)
8. [Estrutura do repositório](#estrutura-do-repositório)
9. [Tecnologias](#tecnologias)
10. [Documentação](#documentação)

---

## Propósito

O **Akylla Gestão** é um software como serviço (SaaS) pensado para o
pequeno empreendedor brasileiro que precisa controlar a operação do seu
negócio sem depender de planilhas soltas ou ferramentas desconectadas.

O produto foi desenhado a partir de um **núcleo comum de comércio e
gestão** — o tipo de operação que atravessa quase todos os pequenos
negócios: cadastrar clientes, controlar produtos e estoque, vender,
abrir e fechar o caixa, acompanhar contas a pagar e a receber, medir
resultados. Sobre esse núcleo, **módulos opcionais** podem ser
habilitados conforme o segmento de cada empresa (agendamentos,
catálogo de serviços, assinaturas de clientes, WhatsApp).

O Akylla Gestão **não se posiciona como ERP completo** para qualquer
setor. Operações que exijam módulos fiscais, contábeis, de frota ou de
produção estão fora do escopo inicial.

### Diferenciais

- **Multiempresa de verdade:** cada empresa enxerga apenas os próprios
  dados. O isolamento é imposto no servidor (`companyId` sempre derivado
  da sessão autenticada) — nunca depende do comportamento da interface.
- **Valores e saldos confiáveis:** preços, totais, saldos de estoque e
  de caixa são recalculados no servidor a cada operação; nada de estado
  crítico confiado ao navegador.
- **Trilha de auditoria:** vendas, movimentações e lançamentos nunca são
  apagados. Cancelamentos e estornos geram registros compensatórios com
  autor, data e motivo.
- **Módulos que crescem com o negócio:** a empresa começa com o núcleo e
  ativa novos módulos quando precisar — sem trocar de sistema.

---

## Para quem é

Priorizado para **pequenos negócios** com processos comuns de comércio e
gestão de produtos e serviços:

- Lojas de roupas, calçados, acessórios e presentes;
- Mercadinhos, adegas e lojas de conveniência;
- Papelarias, livrarias e lojas de presentes;
- Oficinas, assistências técnicas e pequenos serviços;
- Pet shops, salões e clínicas (com o módulo de pets e agenda);
- Qualquer negócio que precise de clientes, produtos, caixa e
  controle financeiro básico em um só lugar.

---

## Módulos

### Núcleo (sempre disponível)

| Módulo | O que entrega |
|---|---|
| **Autenticação e usuários** | Login por sessão `HttpOnly`, perfis ADMIN/MEMBER, primeiro administrador via variáveis de ambiente |
| **Empresas** | Isolamento multiempresa por tenant; dados de cada empresa separados no banco e no servidor |
| **Clientes** | Cadastro com busca, contatos normalizados, endereço e histórico — base para vendas, agenda e assinaturas |
| **Fornecedores e categorias** | Cadastros de apoio ao catálogo de produtos |
| **Produtos e estoque** | SKU e código de barras únicos por empresa, entradas/saídas/ajustes, saldo em tempo real, alerta de estoque mínimo |
| **Vendas e PDV** | Frente de caixa com busca por nome/SKU/código de barras, desconto, formas de pagamento, comprovante e histórico |
| **Caixa** | Abertura/fechamento por turno, entradas e saídas manuais, estorno auditável, uma única sessão aberta por empresa |
| **Financeiro (AP/AR)** | Contas a pagar e a receber com vencimento, status e baixa — separado do caixa e do billing do SaaS |
| **Dashboard e relatórios** | Indicadores calculados no servidor, filtros por período, exportação CSV protegida |
| **Faturamento da empresa (billing)** | Planos globais da Akylla e assinatura da própria empresa no SaaS |

### Módulos opcionais (genéricos, ativáveis por segmento)

| Módulo | O que entrega | Ativação |
|---|---|---|
| **Serviços** | Catálogo de serviços com preço e duração | `CompanyModule` |
| **Agendamentos** | Agenda diária, conflito de horário, transições de status e lembrete automático de WhatsApp | `CompanyModule` |
| **Assinaturas de clientes** | Planos recorrentes com pagamento pelo caixa, renovação e cancelamento auditado | `CompanyModule` |
| **WhatsApp** | Integração oficial com a Cloud API da Meta: templates, consentimento auditável, fila com retentativas e webhook assinado | `CompanyModule` |

### Módulo de nicho (opcional)

| Módulo | Observação |
|---|---|
| **Pets** | Ficha de animais vinculada ao cliente (espécie, raça, sexo, peso). Desativável; fora da navegação inicial. Uso típico: pet shops, clínicas e salões |

---

## Ativação por segmento

Desde a Etapa 10, cada empresa decide quais módulos opcionais utiliza.
O mecanismo é a tabela **`CompanyModule`** (opção aprovada pelo
proprietário):

- **Ausência de linha = módulo ativo** (padrão — todas as empresas
  existentes funcionam sem nenhuma configuração);
- Linha gravada com `DISABLED` **bloqueia as rotas do módulo no
  servidor** (`ModuleGuard`) — a ocultação de cards na interface
  acompanha o status, mas **não é controle de acesso**: a fonte de
  verdade é sempre o backend;
- Escrita restrita ao administrador (`PATCH /api/company-modules`);
- O núcleo (clientes, produtos, vendas, caixa, financeiro, relatórios,
  billing) **nunca é desativável**;
- Webhook do WhatsApp e demais rotas públicas permanecem acessíveis
  mesmo com o módulo desativado.

Detalhes técnicos em
[`docs/architecture/API.md`](docs/architecture/API.md#módulos-por-empresa-etapa-10)
e
[`docs/akylla/PLANO_MODULARIZACAO.md`](docs/akylla/PLANO_MODULARIZACAO.md).

---

## Como funciona a operação

### Perfis de acesso

| Área | Administrador | Membro |
|---|:--:|:--:|
| Clientes, fichas e vendas no PDV | sim | sim |
| Caixa: abrir, fechar, entradas/saídas e estorno | sim | somente leitura |
| Catálogo: serviços, produtos, categorias, fornecedores | sim | somente leitura |
| Agendamentos e leitura de relatórios | sim | sim |
| Cancelar venda, configurar/enviar WhatsApp e usuários | sim | — |
| Planos, assinaturas de clientes, faturamento e módulos da empresa | sim | somente leitura |

A regra é sempre a mesma: a interface apenas reflete o que o servidor já
exige — tentar uma ação sem permissão responde com erro, não com tela
bonita.

### Rotina de um dia de trabalho

1. **Abra o caixa** (`/caixa`) informando o troco inicial — sem caixa
   aberto, o PDV bloqueia venda e o pagamento de assinatura responde
   409.
2. **Confira a agenda do dia** (`/agenda`, se o módulo estiver ativo):
   confirme ou conclua atendimentos; lembretes de WhatsApp saem
   automaticamente se a antecedência estiver configurada.
3. **Atenda no PDV** (`/pdv`): venda produtos com baixa automática de
   estoque.
4. **No fim do turno, feche o caixa** (`/caixa/fechar`): conte o
   dinheiro fisicamente e informe — o sistema calcula saldo esperado e
   diferença.
5. **Acompanhe os números** (`/dashboard` e `/relatorios`).

### Mapa de páginas

| Rota | Para quê | Quem usa |
|---|---|---|
| `/` | Home com cards dos módulos ativos da empresa | todos |
| `/login`, `/cadastro`, `/redefinir-senha` | Entrar, criar conta e definir/recuperar a senha | todos |
| `/usuarios` | Gerenciar contas e perfis | admin |
| `/clientes`, `/pets` | Clientes e (se ativo) ficha de animais | todos |
| `/servicos` | Catálogo de serviços (preço/duração) | admin escreve |
| `/produtos`, `/categorias`, `/fornecedores` | Estoque e catálogo | admin escreve; entrada/saída de estoque: todos |
| `/pdv`, `/vendas` | Vender e histórico (cancelar: admin) | todos |
| `/caixa`, `/caixa/*`, `/financeiro` | Turnos, movimentos, contas a pagar/receber e resumo | admin opera, todos leem |
| `/agenda` | Agendamentos do dia (módulo opcional) | todos |
| `/planos`, `/assinaturas` | Planos e assinaturas de clientes (módulo opcional) | admin escreve |
| `/faturamento` | Plano da empresa no Akylla Gestão (billing do SaaS) | admin |
| `/whatsapp`, `/whatsapp/*` | Config, templates, consentimento e envios (módulo opcional) | admin (leitura: todos) |
| `/dashboard`, `/relatorios` | Indicadores, relatórios e exportação CSV | todos |

---

## Qualidade, segurança e auditoria

| Compromisso | Como o Akylla Gestão entrega |
|---|---|
| **Dados isolados por empresa** | `companyId` obrigatório em toda entidade, derivado da sessão autenticada — nunca enviado pelo cliente |
| **Permissões no servidor** | Guards globais de sessão, perfil administrativo e módulo ativo; o frontend apenas reflete o que o servidor já exige |
| **Valores monetários corretos** | Decimais de 2 casas no banco e nas validações — nunca ponto flutuante |
| **Nada de estado crítico confiado ao cliente** | Preços, totais, saldos de estoque, saldo de caixa e diferenças são recalculados no servidor |
| **Trilha de auditoria** | Vendas, movimentações de estoque e de caixa nunca são apagadas: cancelamento e estorno criam registros compensatórios com autor, data e motivo |
| **Sessões seguras** | Cookie `HttpOnly` com hash SHA-256 no banco; revogação no logout e ao inativar usuários |
| **Concorrência tratada** | Trava pessimista (`FOR UPDATE`) em ordem fixa: caixa → produtos — vendas simultâneas nunca corrompem saldo |
| **Exportação CSV segura** | Proteção contra injeção de fórmulas (`=`, `+`, `-`, `@`, inclusive após espaço) e limite de 5000 linhas |

**Evidências de verificação (Etapa 10):**

- `490` testes automatizados em PostgreSQL real — **490 aprovados**
  (cobrindo autenticação, catálogo, PDV, caixa, financeiro, clientes,
  WhatsApp, agenda, assinaturas, billing, relatórios, tenancy e
  módulos por empresa)
- `npm run lint` — 0 erros · `npm run typecheck` — 5 workspaces OK
- `npm run build` — shared, whatsapp, API, web e worker compilando ·
  `npm run db:validate` — schema válido

---

## Como executar o projeto

### 1. Pré-requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | 20 ou superior |
| npm | 11+ (workspaces nativos) |
| PostgreSQL | 17 (porta 5432) |
| Git | 2.x |

### 2. Instalação

```bash
git clone https://github.com/Tanattos18/Akylla-Gestao.git
cd Akylla-Gestao
npm install
cp .env.example .env
```

### 3. Variáveis de ambiente (`.env`)

```dotenv
DATABASE_URL=postgresql://usuario:senha@localhost:5432/petflow
BOOTSTRAP_COMPANY_NAME=Minha Empresa
BOOTSTRAP_COMPANY_SLUG=minha-empresa
BOOTSTRAP_ADMIN_NAME=Administrador
BOOTSTRAP_ADMIN_EMAIL=admin@exemplo.com
BOOTSTRAP_ADMIN_PASSWORD=<senha-forte>
```

> O `.env` **não é versionado** e nunca deve conter senhas reais em
> arquivos versionados. O nome do banco (`petflow`) e do cookie de
> sessão (`petflow_session`) são mantidos por compatibilidade técnica.

### 4. Banco de dados

```bash
npm run db:migrate     # aplica as migrations
npm run db:validate    # valida o schema Prisma
```

### 5. Primeiro administrador

```bash
npm run bootstrap:admin
```

Comando idempotente: cria empresa e administrador apenas se ainda não
existirem.

### 6. Executar (três terminais)

```bash
npm run dev:api        # API  → http://localhost:3001/health
npm run dev:web        # Web  → http://localhost:3000
npm run dev:worker     # worker de tarefas
```

Acesse `http://localhost:3000` e entre com o e-mail/senha do
administrador.

### 7. Verificações antes de qualquer alteração

```bash
npm run lint           # padrão de código
npm run typecheck      # tipagem estrita
npm test               # testes em PostgreSQL real
npm run build          # build completo
npm run db:validate    # schema Prisma
```

Guia completo de ambiente em
[`docs/operations/DEVELOPMENT.md`](docs/operations/DEVELOPMENT.md).

### Dados de demonstração

Para uma apresentação ao cliente, popule uma empresa vazia:

```bash
npm run db:seed:demo -- --company=<slug|id|e-mail-do-admin>
```

O script (transação única, só roda em empresa sem produtos/clientes)
cria categorias, fornecedores, produtos com estoque, clientes,
serviços, vendas em sessões de caixa, agendamentos, assinaturas, dados
do WhatsApp e um usuário membro de teste. **Observação:** o seed ainda
contém dados temáticos de pet shop — a reescrita com dados de comércio
variado está prevista em etapa futura.

---

## Estrutura do repositório

```
apps/
  web/       interface web (Next.js)
  api/       API (NestJS)
  worker/    tarefas em segundo plano (fila do WhatsApp)
packages/
  shared/    tipos e validações compartilhados (Zod)
  whatsapp/  cliente do provedor WhatsApp (Meta Cloud API)
  config/    configurações comuns (TypeScript)
database/    schema Prisma, migrations e seeds
docs/        documentação (ver docs/README.md)
tests/       testes de integração (Vitest + Supertest)
automação do whatsapp/   base histórica preservada (fora do monorepo)
```

---

## Tecnologias

| Camada | Stack |
|---|---|
| Frontend | Next.js 15 · React 19 · Tailwind CSS 4 |
| Backend | NestJS 11 · TypeScript estrito · Zod |
| Banco | PostgreSQL 17 · Prisma ORM |
| Mensageria | WhatsApp Business Cloud API (Meta) · fila própria com worker |
| Testes | Vitest · Supertest · PostgreSQL real |
| Processos | npm workspaces (monorepo) |

---

## Documentação

Este `README.md` apresenta o produto. O **índice técnico** de todos os
documentos (estado, arquitetura, operação, histórico) está em
[`docs/README.md`](docs/README.md).

| Documento | Conteúdo |
|---|---|
| [Índice da documentação](docs/README.md) | mapa completo, organizado por finalidade |
| [Documento técnico completo](docs/AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md) | mapa único do sistema (23 seções) |
| [Status do projeto](docs/operations/PROJECT_STATUS.md) | etapa atual, entregas e pendências |
| [Checklist de implementação](docs/operations/IMPLEMENTATION_CHECKLIST.md) | progresso etapa a etapa |
| [Changelog](docs/operations/CHANGELOG.md) | histórico completo de alterações |
| [Checklist pré-produção](docs/akylla/CHECKLIST_PRE_PRODUCAO.md) | limitações e itens antes de comercializar |
| [PDV](docs/akylla/PDV.md) | fluxo de venda, regras e API |
| [Arquitetura](docs/architecture/ARCHITECTURE.md) | tecnologias e decisões registradas |
| [API](docs/architecture/API.md) | endpoints, permissões e payloads |
| [Banco de dados](docs/architecture/DATABASE.md) | modelo de dados e diretrizes |
| [Desenvolvimento](docs/operations/DEVELOPMENT.md) | ambiente e execução local |
| [AGENTS.md](AGENTS.md) | regras para agentes de desenvolvimento |

---

**Akylla Gestão** — roadmap de 12 etapas concluído.
