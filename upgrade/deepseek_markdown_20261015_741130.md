# Melhorias Akylla Gestão — Plano de Transformação em SaaS Comercial

**Versão:** 1.0 · **Data:** 2026-10-15
**Base:** Documentação técnica `AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md`, repositório `github.com/Tanattos18/Akylla-Gestao` e pesquisa de mercado (2025–2026).
**Status atual:** 538/538 testes · Roteiro Etapas 0–12 concluído · Sem deploy, sem backup, sem cobrança real.

---

## Sumário

1. [Visão geral do diagnóstico](#1-visão-geral-do-diagnóstico)
2. [Infraestrutura e Deploy](#2-infraestrutura-e-deploy)
3. [Segurança e Conformidade](#3-segurança-e-conformidade)
4. [Banco de Dados e Dados](#4-banco-de-dados-e-dados)
5. [CI/CD e Automação](#5-cicd-e-automação)
6. [Monitoramento e Observabilidade](#6-monitoramento-e-observabilidade)
7. [Documentação](#7-documentação)
8. [Design e Frontend](#8-design-e-frontend)
9. [Testes e Qualidade](#9-testes-e-qualidade)
10. [Produto e Funcionalidades](#10-produto-e-funcionalidades)
11. [Documentação Legal e LGPD](#11-documentação-legal-e-lgpd)
12. [Comercial e Vendas](#12-comercial-e-vendas)
13. [Roadmap de Execução](#13-roadmap-de-execução)
14. [Referências](#14-referências)

---

## 1. Visão geral do diagnóstico

### 1.1 O que já está pronto

| Área | Estado |
|---|---|
| Núcleo de gestão | Produtos, estoque, PDV, caixa, financeiro (AP/AR), clientes, serviços, relatórios, agendamentos, WhatsApp, assinaturas — todos implementados e testados |
| Isolamento multiempresa | `companyId` sempre derivado da sessão; recurso alheio responde 404; 538 testes em PostgreSQL real cobrem isso |
| Trilha de auditoria | Estoque, caixa e vendas são ledgers imutáveis; correção é movimento compensatório |
| Importação de planilhas | Módulo completo com 29 testes, dry-run e relatório de erros |
| Módulos opcionais | `CompanyModule` permite desativar pets, agendamentos, serviços, WhatsApp e assinaturas por empresa |
| Billing SaaS | Planos, limites, gateway Mercado Pago (sandbox) e webhook idempotente |

### 1.2 Lacunas que impedem produção paga

| Lacuna | Risco |
|---|---|
| Sem deploy real (`cd.yml` é placeholder) | Não há como colocar no ar |
| Sem backup com restore testado | Um `db:reset` acidental = perda total de dados do cliente |
| Sem LGPD (direito ao esquecimento) | Multa e exposição jurídica |
| Sem monitoramento | Erro 500 descoberto pelo cliente |
| Cobrança real nunca validada | Risco de cobrar errado ou não cobrar |
| 2 vulnerabilidades de produção (`postcss` via `next`) | XSS e path traversal |
| Rate limit in-memory | Reseta no restart e não vale entre instâncias |
| Sem RLS no Postgres | Isolamento depende só da aplicação |
| Sem E2E de interface | Link quebrado passa 100% verde nos testes |

### 1.3 Veredito

> **O sistema funciona. O que falta é o caminho até o primeiro cliente pagante.** As melhorias abaixo estão organizadas para transformar um código tecnicamente maduro em um produto comercialmente viável.

---

## 2. Infraestrutura e Deploy

### 2.1 Escolha da plataforma de hospedagem

O monorepo Akylla tem três componentes que precisam rodar continuamente: **API NestJS** (porta 3001), **Web Next.js** (porta 3000) e **Worker** (fila WhatsApp). A escolha da plataforma deve considerar custo, facilidade de deploy e suporte a banco PostgreSQL gerenciado.

**Comparativo de plataformas (2025–2026):**

| Plataforma | Modelo | Custo mensal estimado (API + Web + Worker + Postgres) | Pontos fortes | Pontos fracos |
|---|---|---|---|---|
| **Railway** | PaaS com Postgres gerenciado | US$ 40–80 | DX excelente, deploy rápido, worker nativo | Preço sobe com uso |
| **Render** | PaaS com Postgres gerenciado | US$ 60–100 | Preço transparente, Web Service + Worker + Cron | Deploy mais lento que Railway |
| **Fly.io** | Containers Docker multi-região | US$ 30–70 | Baixa latência, always-on Docker | Curva de aprendizado maior |
| **VPS próprio (Hetzner/DigitalOcean)** | IaaS | US$ 20–40 | Controle total, custo previsível | Exige manutenção de TLS, deploy, backup |
| **Vercel (Next.js) + Railway (API)** | Híbrido | US$ 20–50 | Next.js otimizado na Vercel | API e worker em outro provedor |

**Recomendação para o Akylla:** **Railway** ou **Render**. Ambos suportam monorepo, PostgreSQL gerenciado, workers em background e deploy via Dockerfile ou comando direto. Um serviço completo (Web + API + Worker + Postgres) fica na faixa de **US$ 60–80/mês** no Render.

### 2.2 Fechar o `cd.yml` (placeholder → deploy real)

O arquivo `.github/workflows/cd.yml` hoje sobe dependências, faz build, roda `db:deploy` e executa um `echo` no lugar do deploy real (`cd.yml:40` e `cd.yml:75`). O caminho recomendado:

```yaml
# Estrutura sugerida para cd.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run build
      - run: npm test
      - name: Deploy API + Web + Worker
        run: |
          railway up --service akylla-api
          railway up --service akylla-web
          railway up --service akylla-worker
      - name: Run migrations
        run: npm run db:deploy
      - name: Health check
        run: curl -f https://<dominio>/health