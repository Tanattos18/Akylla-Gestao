# Checklist pré-produção — Akylla Gestão (Etapa 12)

> **Entregável da Etapa 12** do roteiro
> `docs/PASSO_A_PASSO_OPENCODE_AKYLLA.md`. Evidências, riscos
> remanescentes, custos estimados e decisão recomendada sobre prontidão.
> **Este documento não declara "pronto para produção"** — apresenta
> evidências e limitações para decisão do proprietário.

**Data:** 2026-10-12 · **Roteiro:** Etapa 12 (final) · **Status:**
concluída.

---

## 1. Evidências de qualidade (instrução 1)

| Verificação | Comando | Resultado (2026-10-12) |
|---|---|---|
| Lint | `npm run lint` | **0 erros, 0 warnings** |
| Typecheck | `npm run typecheck` | **OK** (API, web, worker, shared) |
| Testes | `npm test` | **509/509 testes, 23 arquivos, 0 falhas** |
| Build | `npm run build` | **OK** (API + web + worker) |
| Schema | `npm run db:validate` | **válido** |
| Migrations | `npx prisma migrate deploy` | aplicadas em `petflow` e `petflow_test` |

Nenhuma regressão introduzida pela adaptação (instrução 2). Falhas
preexistentes identificadas separadamente na Seção 3 (instrução 3).

---

## 2. Revisão de segurança (instrução 4)

| Área | Situação | Evidência |
|---|---|---|
| **Segredos** | ✅ Nenhum segredo hardcoded; `.env` fora do Git (`.gitignore`); `.env.example` sem valores reais | grep por padrões de senha/token/chave = 0 hits reais |
| **Logs** | ✅ Erros logados com stack (500+); senhas/tokens nunca logados | `AllExceptionsFilter` loga apenas status + stack |
| **Autenticação** | ✅ Cookie `HttpOnly` + `sameSite=lax` + `secure` configurável; bcrypt 12 rounds; token SHA-256 em `Session`; rate limit de login (5 tentativas/15min por IP+email) | `auth.service.ts:208-210`, `login-rate.limit.ts` |
| **Autorização** | ✅ `AuthGuard` global; `AdminGuard` para escrita administrativa; `ModuleGuard` para módulos desabilitados; `@Public` apenas em webhook/health/login | guards em `app.module.ts` |
| **Tenant** | ✅ `companyId` sempre do contexto autenticado (`request.user.companyId`); nenhum `companyId` vindo de body/query/params | grep `body.companyId` = 0 |
| **Uploads** | ✅ Nenhum endpoint de upload de arquivo nesta versão | grep `FileInterceptor`/`multipart` = 0 |
| **Exportações** | ✅ CSV de relatórios gera apenas dados da empresa autenticada | testes de isolamento em `reports.test.ts` |
| **Webhooks** | ✅ WhatsApp e Mercado Pago `@Public` com verificação de assinatura (HMAC) | `whatsapp-webhook`, `mercadopago-webhook` |

---

## 3. Limitações conhecidas e falhas preexistentes (instrução 3 e 10)

Classificadas como **preexistentes** (não introduzidas pela adaptação):

### 3.1 Segurança

| # | Limitação | Severidade | Notas |
|---|---|---|---|
| L1 | 8 vulnerabilidades `npm audit` — todas em **dependências de desenvolvimento** (vitest/esbuild/postcss/tinypool), não no runtime de produção | Críticas/altas no dev-only | Correção exige upgrade do vitest (breaking change) — agendar janela |
| L2 | Rate limit de login é **in-memory** (reseta no restart; não compartilhado entre instâncias) | Média | Adequado para 1 instância; para multi-instância usar Redis |
| L3 | Sem **RLS** no Postgres — isolamento de tenant é aplicado na camada de aplicação | Média | 500+ testes de isolamento; adicionar RLS como defesa em profundidade antes de produção multi-instância |
| L4 | Sem fluxo de **exclusão LGPD** (direito ao esquecimento) | Alta (compliance) | Implementar endpoint de anonimização/exclusão com retenção legal |
| L5 | `PASSWORD_RESET_ENABLED` redefine sem token de e-mail (apenas local) | Alta se habilitado em produção | Manter desabilitado em produção até implementar fluxo com token |
| L6 | `REGISTRATION_ENABLED` cria empresa sem verificação anti-abuso | Alta se habilitado em produção | Manter desabilitado ou adicionar captcha/limite |

### 3.2 Operação

| # | Limitação | Severidade | Notas |
|---|---|---|---|
| L7 | CI presente, **CD/deploy ainda placeholder** | Média | `.github/workflows/ci.yml` roda lint/typecheck/test (Postgres 17)/build/db:validate em push e PR; `cd.yml` só executa migrations + `echo` — falta definir hosting e secrets |
| L8 | Sem **backups automatizados** de banco | Alta | Antes de produção: agendar pg_dump diário + teste de restauração |
| L9 | Sem monitoramento/aler-tificação (uptime, erros) | Média | Sentry ou similar para erros; UptimeRobot para availability |
| L10 | Expiração de assinatura é **lazy** (na leitura), não por job | Baixa | Funcional; para precisão exata, agendar cron de expiração |

### 3.3 Produto

| # | Limitação | Severidade | Notas |
|---|---|---|---|
| L11 | Seed ainda tem "Mundo Pet" (temático) | Baixa | Decisão D2 Etapa 10: reescrever com aprovação |
| L12 | UI `/faturamento` não exibe limites/uso do plano | Média | Backend pronto (`userLimit` etc. no `planSelect`); front pendente |
| L13 | Cobrança recorrente real não ativada | Alta (comercial) | Sandbox implementado; ativar exige E2E + aprovação |
| L14 | Escrita do catálogo global de planos não exposta | Baixa | Exige papel de plataforma |

---

## 4. Ambientes (instrução 6)

| Ambiente | Banco | Uso | Status |
|---|---|---|---|
| **Desenvolvimento** | `petflow` (local) | Codificação, migrations de teste | ✅ Em uso |
| **Teste** | `petflow_test` (local, reset automático por `global-setup`) | Suíte Vitest (509 testes) | ✅ Em uso |
| **Produção** | `petflow` (servidor gerenciado) | Usuários reais | ⛔ Não configurado — requer definição de hospedagem + backup antes |

---

## 5. Variáveis de ambiente (instrução 7)

Todas documentadas em `.env.example` **sem valores secretos**:

| Variável | Padrão | Produção |
|---|---|---|
| `DATABASE_URL` | local | obrigatória (gerenciada) |
| `AUTH_COOKIE_SECURE` | `false` | **`true`** |
| `AUTH_SESSION_TTL_HOURS` | 12 | conforme política |
| `AUTH_RATE_LIMIT_MAX` | 5 | ajustar conforme tráfego |
| `PASSWORD_RESET_ENABLED` | ausente/false | **ausente** (até fluxo com token) |
| `REGISTRATION_ENABLED` | ausente/false | **ausente** (ou com anti-abuso) |
| `WHATSAPP_PROVIDER` | `mock` | `meta` + token real |
| `WHATSAPP_ACCESS_TOKEN` | vazio | obrigatório |
| `WHATSAPP_APP_SECRET` | vazio | obrigatório (verificação webhook) |
| `MERCADOPAGO_ENV` | `sandbox` | `production` |
| `MERCADOPAGO_ACCESS_TOKEN` | vazio | obrigatório |
| `MERCADOPAGO_WEBHOOK_SECRET` | vazio | obrigatório |
| `APP_ORIGINS` | `http://localhost:3000` | domínio real |

---

## 6. Estimativa de custos de hospedagem (instrução 8)

Estimativas para **1 instância** de um SaaS pequeno (até ~50 empresas
ativas), em BRL/mês:

| Item | Opção econômica | Opção gerenciada | Notas |
|---|---|---|---|
| VPS / App server | ~R$ 50 (Hetzner CX22 / DigitalOcean Basic) | ~R$ 100 (Render/Railway base) | Node + Next.js no mesmo VPS é suficiente |
| PostgreSQL | ~R$ 0 (próprio VPS) | ~R$ 50–100 (Neon/Supabase/RDS small) | Gerenciado = backup automático |
| Domínio | ~R$ 5/ano (`.com.br` ~R$ 40/ano) | idem | Registro.br |
| CDN/HTTPS | ~R$ 0 (Caddy/Let's Encrypt) | ~R>0 Cloudflare free | Certificado automático |
| Mercado Pago | R$ 0 fixo | R$ 0 fixo | Taxa por transação (~3,49% + R$ 0,39) |
| WhatsApp Cloud API | R$ 0 (conversas de serviço) | idem | Meta cobra por conversa iniciada fora do serviço |
| **Total estimado** | **~R$ 55–100/mês** | **~R$ 155–250/mês** | Antes de volume |

> **Recomendação:** iniciar com opção econômica (1 VPS + Postgres local +
> Caddy); migrar para banco gerenciado quando houver backup automatizado
> e restore testado.

---

## 7. Itens obrigatórios antes da comercialização (instrução 10)

Checklist do proprietário — **não comercializar sem concluir**:

- [ ] **Backups automatizados** de banco com **teste de restauração** real
      (instrução 5 — não executado aqui; requer ambiente de produção)
- [ ] Definir **ambiente de produção** (hosting + domínio + TLS)
- [ ] Habilitar `AUTH_COOKIE_SECURE=true` e HTTPS
- [ ] Decidir sobre `PASSWORD_RESET_ENABLED` (recomendado: manter off até
      fluxo com token de e-mail)
- [ ] Decidir sobre `REGISTRATION_ENABLED` (recomendado: off + convite ou
      captcha)
- [ ] Resolver vulnerabilidades `npm audit` (upgrade vitest → 5.x em
      janela dedicada)
- [ ] Implementar **exclusão/anonimização LGPD**
- [ ] Ativar **CI** (lint + test + build no push)
- [ ] Configurar monitoramento de erros (Sentry ou similar) e uptime
- [ ] E2E sandbox do Mercado Pago com cartão de teste + aprovação antes
      de ativar cobrança recorrente
- [ ] Reescrever seed com dados não temáticos de pet shop (após aprovação)
- [ ] UI `/faturamento` exibindo limites e uso do plano

---

## 8. Decisão recomendada sobre prontidão (critério da etapa)

**Recomendação: NÃO declarar pronto para produção.** O código está
funcional, testado (509/509) e com segurança básica sólida (cookie
HttpOnly, bcrypt 12, rate limit, tenant isolado, webhooks assinados),
**porém faltam controles operacionais e de compliance** (backups com
restore testado, LGPD, CI, monitoramento, resolução de vulnerabilidades
de dev-dependencies) e a **cobrança recorrente real não foi validada em
E2E**.

**Caminho sugerido:** concluir os itens da Seção 7 → deploy de staging
interno → E2E do Mercado Pago em sandbox → aprovação do proprietário →
produção restrita (pilotos) → produção geral.

---

## 9. Relatório final de testes

- **Total:** 509 testes em 23 arquivos — **todos passando** (2026-10-12).
- **Cobertura funcional:** auth/tenancy, usuários, clientes, produtos,
  estoque, vendas/PDV, caixa, financeiro (AP/AR), assinaturas de cliente,
  billing SaaS + limites + Mercado Pago sandbox, WhatsApp (mock/meta),
  agendamentos, relatórios/indicadores, módulos por empresa.
- **Padrões verificados:** isolamento cross-tenant (404/escopo),
  AdminGuard, idempotência, validação Zod, assinatura de webhooks,
  expiração lazy de assinatura, rate limit de login.
- **Ambiente de execução:** PostgreSQL 17 local; banco `petflow_test`
  recriado por `global-setup` a cada execução.
