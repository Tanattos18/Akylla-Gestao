# Deploy em produção — Akylla Gestão

> Fase 1 · 1G. Guia que serve para qualquer provedor que rode Node 22 com
> comandos de build/start e ofereça "deploy hook" (Render, Railway, Koyeb,
> Fly.io, VPS com webhook). A escolha do provedor é decisão do
> proprietário. Operação e rollback: [`RUNBOOK.md`](RUNBOOK.md).

## 1. Peças

| Peça | O quê | Observação |
|---|---|---|
| **PostgreSQL 17** | banco gerenciado | backup do provedor (PITR) **e** `npm run db:backup` diário (cópia independente) |
| **API** | serviço web (porta `API_PORT`) | health check: `GET /health/ready` |
| **Web** | serviço web Next.js (porta 3000) | faz proxy de `/api/*` para a API |
| **Worker** | processo sem porta | fila do WhatsApp; log `heartbeat` a cada 60 s |
| **Redis** (opcional) | rate limit compartilhado | obrigatório se a API rodar com mais de 1 instância |
| **SMTP** | e-mail transacional | obrigatório com `REGISTRATION_ENABLED=true` |
| **Volume de arquivos** | anexos das OS (`UPLOADS_DIR`) | disco **persistente** montado na API; sem ele os anexos somem a cada deploy. Backup à parte (ver `backup/README.md`) |

## 2. Banco: role da aplicação (obrigatório — RLS)

O usuário administrador padrão dos provedores costuma ser superusuário ou
ter `BYPASSRLS`, o que **desliga a RLS sem aviso** (ADR-0001). Crie um role
próprio e use-o em `DATABASE_URL`:

```sql
-- como administrador do banco
CREATE ROLE akylla_app LOGIN PASSWORD '<senha-forte>' NOSUPERUSER NOBYPASSRLS;
ALTER DATABASE <banco> OWNER TO akylla_app;
ALTER SCHEMA public OWNER TO akylla_app;
-- confira:
SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'akylla_app'; -- f, f
```

## 3. Comandos por serviço

Todos rodam na **raiz** do repositório. O `npm ci` já gera o Prisma Client
(`postinstall`).

| Serviço | Build | Start |
|---|---|---|
| API | `npm ci && npm run build:shared && npm run build:whatsapp && npm run build --workspace @petflow/api` | `npm run start --workspace @petflow/api` |
| Worker | `npm ci && npm run build:shared && npm run build:whatsapp && npm run build --workspace @petflow/worker` | `npm run start --workspace @petflow/worker` |
| Web | `npm ci && npm run build:shared && npm run build --workspace @petflow/web` | `npm run start --workspace @petflow/web` |

As **migrations** não rodam no start: o workflow de deploy aplica
`npm run db:deploy` antes de disparar os serviços (§5).

## 4. Variáveis de ambiente

Referência completa e comentada: `.env.example`. Nunca coloque valores no
Git: use o painel de variáveis/segredos do provedor.

**API**

| Variável | Valor em produção |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | role `akylla_app` (§2), com `sslmode=require` se o provedor exigir |
| `API_PORT` | opcional: sem ela a API usa `PORT`, que o provedor define, e depois 3001 |
| `APP_ORIGINS` | URL pública do web (ex.: `https://app.akyllagestao.com.br`) |
| `AUTH_COOKIE_SECURE` | `true` (a API recusa subir sem isso em produção) |
| `REGISTRATION_ENABLED` | `true` só com SMTP configurado |
| `REGISTER_RATE_LIMIT_MAX` | `3` (por hora, por IP) |
| `PASSWORD_RESET_ENABLED` | ausente/`false` (o fluxo com token por e-mail é outro e já existe) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | dados do provedor de e-mail |
| `TURNSTILE_SECRET_KEY` | chave secreta do Turnstile (opcional) |
| `FISCAL_ENCRYPTION_KEY` | 64 caracteres hex (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). **Guarde fora do servidor também**: perder a chave = recadastrar token e certificado |
| `FISCAL_WEBHOOK_SECRET` | segredo HMAC combinado com a integradora (webhook `/api/webhooks/fiscal`) |
| `REDIS_URL` | `rediss://…` (obrigatório com mais de 1 instância) |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`, `SENTRY_RELEASE` | monitoramento |
| `WHATSAPP_*`, `MERCADOPAGO_*` | conforme a ativação de cada integração |

**Worker:** `NODE_ENV`, `DATABASE_URL` (mesmo role), `WHATSAPP_*`,
`WORKER_*`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`. O worker abre conexão de
sistema por conta própria (`systemDatabaseUrl`).

**Web, no build:** `API_INTERNAL_URL` (URL **interna** da API, sem barra
final, para onde o proxy `/api/*` vai), `NEXT_PUBLIC_SENTRY_DSN`,
`NEXT_PUBLIC_SENTRY_ENVIRONMENT=production` e
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` (opcional). Essas variáveis entram no
**build**: mudar exige novo build.

## 5. GitHub Actions (deploy automático)

`.github/workflows/cd.yml` roda **depois do CI verde na `main`** (ou
manualmente em *Actions › Deploy › Run workflow*). Ele fica parado até
você configurar:

1. *Settings › Environments › New environment* → `production`. Marque
   **Required reviewers** (você), para que cada deploy espere sua
   aprovação.
2. *Settings › Secrets and variables › Actions*:
   - **Variables:** `DEPLOY_ENABLED=true`, `PRODUCTION_API_URL`,
     `PRODUCTION_WEB_URL`
   - **Secrets:** `PRODUCTION_DATABASE_URL`, `DEPLOY_HOOK_API`,
     `DEPLOY_HOOK_WORKER`, `DEPLOY_HOOK_WEB`

Sequência do workflow: checkout do commit aprovado pelo CI → `npm ci` →
`npm run db:deploy` (migrations aditivas, compatíveis com a versão
anterior) → dispara os 3 deploy hooks → espera `GET /health/ready` com
`"database":"ok"` (até 10 min) e `GET /login` no web. Falhou: seguir o
rollback do `RUNBOOK.md` §5.

> Limite conhecido: o health check não confere *qual* versão respondeu
> (a anterior pode responder enquanto a nova sobe). Confira o deploy no
> painel do provedor e o `SENTRY_RELEASE` nos eventos.

## 6. Depois do primeiro deploy (checklist)

- [ ] `https://<api>/health/ready` → 200 com `"database":"ok"`
- [ ] Cadastro de teste: chega o e-mail de confirmação, o link ativa a conta
- [ ] `npm run monitoring:test` com o DSN de produção → evento no Sentry
      (registrar no RUNBOOK §9)
- [ ] UptimeRobot no `/health/ready` (keyword `"database":"ok"`) → teste de
      alerta registrado
- [ ] `npm run db:backup` agendado (02:00) com cópia externa e alerta de falha
- [ ] Role do banco sem SUPERUSER/BYPASSRLS (§2)
- [ ] Atualizar `docs/akylla/GO_NO_GO.md` com as evidências
