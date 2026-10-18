# Runbook de operação — Akylla Gestão

> **Para quem opera o sistema em produção.** Cobre monitoramento, alertas,
> resposta a incidentes, rollback e restauração. Criado na Fase 1 · 1B
> (`upgrade/Prompt_Mestre.md` §1.2/§1.3) em 2026-10-18.
>
> Partes que dependem da hospedagem (ainda não escolhida) estão marcadas
> com **[hospedagem]**. Complete-as quando o CD real (item 1G) existir.

## 1. Serviços e URLs de saúde

| Serviço | Processo | Saúde |
|---|---|---|
| API | `npm run start --workspace @petflow/api` (porta `API_PORT`, 3001) | `GET /health` = processo vivo · **`GET /health/ready` = processo + banco** |
| Web | `npm run start --workspace @petflow/web` (porta 3000) | `GET /` (200) |
| Worker | `npm run start --workspace @petflow/worker` | log `heartbeat` a cada 60 s; erros no Sentry (`service: petflow-worker`) |
| Banco | PostgreSQL 17 | `/health/ready` responde 503 se o banco não responder em 2 s |
| E-mail (SMTP) | `SMTP_HOST`/`SMTP_*` | confirmação de cadastro e redefinição de senha. Falha de envio → o cadastro responde erro 500 (Sentry) e o usuário pode reenviar pela tela de login/cadastro |
| Redis (opcional) | `REDIS_URL` | rate limit compartilhado. Fora do ar → log `Redis indisponível…; rate limit em memória até reconectar` e a API segue funcionando (limite vale por instância até voltar) |

`/health/ready` responde **200** `{"status":"ok","database":"ok","databaseLatencyMs":N}`
ou **503** `{"status":"unavailable","database":"down"}`. A resposta não traz
detalhes internos (host, erro). Não exige sessão e fica fora do prefixo
`/api`.

## 2. Monitoramento de erros — Sentry

**Configuração** (variáveis no ambiente do servidor; nunca no Git):

| Variável | Onde | Valor |
|---|---|---|
| `SENTRY_DSN` | API e worker | DSN do projeto no Sentry |
| `NEXT_PUBLIC_SENTRY_DSN` | web (no **build**) | DSN do projeto web (pode ser o mesmo) |
| `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | todos | `production`, `staging`… |
| `SENTRY_RELEASE` | API e worker | hash do commit (o CD preenche) |
| `SENTRY_TRACES_SAMPLE_RATE` | API | `0.1` |
| `SENTRY_PROFILES_SAMPLE_RATE` | API | `0` (ligue só para investigar lentidão) |

Sem DSN o Sentry fica **desligado** e nada é enviado (padrão em dev,
teste e CI). Em dev local, o web lê variáveis de `apps/web/.env.local`.

**O que é reportado:** só erros **5xx** da API (400/401/403/404/409 são
regra de negócio), erros do ciclo do worker (tag `stage`), falhas de
inicialização e erros de renderização do web (`error.tsx`,
`global-error.tsx`, `onRequestError`).

**Privacidade (LGPD):** o envio é mínimo. Não vão cookies, corpo de
requisição, query string (o link de redefinição de senha leva o token
nela), e-mail, nome, IP nem variáveis locais. O usuário aparece só pelo
`id` interno e a empresa pela tag `companyId`. A implementação está em
`apps/api/src/monitoring/sentry.ts` e é testada em
`tests/integration/monitoring.test.ts`.

**Alertas recomendados** (Sentry › Alerts):

1. *Issue nova* em `production` → e-mail/WhatsApp do responsável.
2. *Mais de 10 eventos em 5 min* (pico de erro 500) → alerta urgente.
3. *Worker sem evento de sucesso*: use o heartbeat do log da hospedagem
   **[hospedagem]**.

**Teste de alerta (critério de aceite da Fase 1):**

```bash
npm run monitoring:test   # envia 1 erro "[TESTE] Alerta de teste…" ao Sentry
```

Confirme o evento em *Issues* e o alerta no e-mail/canal. Anote a data
abaixo (§9).

## 3. Monitoramento de disponibilidade — UptimeRobot

| Monitor | Tipo | URL | Intervalo | Alerta |
|---|---|---|---|---|
| API + banco | HTTP(s) / keyword `"database":"ok"` | `https://<dominio-api>/health/ready` | 1 min | após **2 falhas seguidas** |
| Web | HTTP(s) | `https://<dominio>/` | 1 min | após 2 falhas seguidas |

Passos: UptimeRobot › *Add New Monitor* › tipo **Keyword** › URL acima ›
palavra `"database":"ok"` (deve existir) › intervalo 1 min. Em *Alert
Contacts*, cadastre e-mail + app/SMS. Nas configurações avançadas, defina
o alerta após 2 falhas.

**Teste de alerta:** pause a API (ou aponte o monitor para uma URL que
dá 503) e confirme o alerta. Depois restaure e confirme o aviso "up".
Anote a data em §9.

## 4. Resposta a incidentes

| Severidade | Exemplo | Reação |
|---|---|---|
| **S1** | site fora, `/health/ready` 503, vendas falhando para todos | agir imediatamente; avisar clientes em até 30 min |
| **S2** | um módulo falhando (WhatsApp, relatório), erro para parte dos clientes | agir no mesmo dia |
| **S3** | erro pontual, sem perda de dados | próximo ciclo de manutenção |

**Roteiro S1/S2:**

1. **Confirmar:** abrir `/health/ready`, a issue no Sentry e os logs da
   hospedagem **[hospedagem]**.
2. **Classificar a causa:**
   - *Banco fora* (`/health/ready` 503) → painel do provedor de banco;
     se houver corrupção ou perda, ir para §7 (restauração).
   - *Deploy recente* (erro começou após uma publicação) → **rollback**
     (§5). Não tente corrigir em produção.
   - *Dependência externa* (Meta/WhatsApp, Mercado Pago) → o sistema
     segue funcionando; a fila do worker reprocessa com backoff. Só
     acompanhar.
3. **Comunicar** os clientes afetados (WhatsApp/e-mail de suporte) com o
   horário previsto.
4. **Registrar** o incidente (data, duração, causa, ação, prevenção) no
   CHANGELOG ou num registro de incidentes.

**Incidente de dados pessoais (LGPD):** se houver acesso indevido a dados
de clientes, preservar evidências (logs, eventos do Sentry), avaliar o
risco e comunicar a ANPD e os titulares quando houver risco relevante
(art. 48 da LGPD), com apoio jurídico.

## 5. Rollback de deploy

Regra: **voltar primeiro, investigar depois.**

1. **Aplicação** **[hospedagem]**: redeploy da versão anterior. No
   Railway/Render, *Deployments › versão anterior › Redeploy/Rollback*.
   Com Docker, subir a imagem da tag anterior. No Git, nunca reescreva a
   `main`; faça `git revert <commit>` e publique.
2. **Migrations:** as migrations do Prisma são aplicadas por
   `npm run db:deploy` e **não têm "down" automático**.
   - Migration **aditiva** (nova tabela/coluna opcional): a versão
     anterior do código convive com ela. Faça só o rollback da
     aplicação.
   - Migration que **falhou no meio**: corrigir e marcar com
     `npx prisma migrate resolve --rolled-back <nome> --schema database/prisma/schema.prisma`
     (ou `--applied`, se foi concluída manualmente) e reaplicar.
   - Migration **destrutiva** que precisa ser desfeita: escrever uma
     migration nova compensatória. Se houve perda de dados, restaurar o
     backup (§7).
   - Por isso o padrão do projeto é **migrations aditivas** e a remoção
     de coluna em duas publicações (primeiro parar de usar, depois
     remover).
3. **Feature flags existentes** (desligar sem novo deploy, só variável
   de ambiente + restart): `REGISTRATION_ENABLED`,
   `PASSWORD_RESET_ENABLED`, `WHATSAPP_PROVIDER=mock` (para os envios
   reais) e módulos por empresa via `CompanyModule` (`/api/company-modules`).
4. Confirmar `/health/ready` 200 e o Sentry sem erros novos.

## 6. Backup

Diário às 02:00 com restauração testada automaticamente:
`npm run db:backup`. Detalhes (agendamento, retenção, cópia externa, RPO
≤ 24 h, RTO ≤ 4 h) em [`../../backup/README.md`](../../backup/README.md).
Se o backup falhar (exit ≠ 0), o agendador deve alertar **[hospedagem]**.

## 7. Restauração do banco (desastre)

Meta: **RTO ≤ 4 h**, **RPO ≤ 24 h**.

1. Colocar o sistema em manutenção (parar API e worker) para ninguém
   gravar no banco danificado.
2. Escolher o dump: o mais recente válido em `backup/` ou na cópia
   externa. Teste antes: `npm run db:restore-test -- <arquivo>`.
3. Criar um banco novo (não sobrescrever o danificado; ele é evidência)
   e restaurar: `DATABASE_URL=<banco novo> npm run db:restore -- <arquivo>`.
4. `DATABASE_URL=<banco novo> npm run db:deploy` (aplica migrations mais
   novas que o dump, se houver).
5. Apontar `DATABASE_URL` da API e do worker para o banco novo, subir os
   serviços e confirmar `/health/ready` 200.
6. Comunicar os clientes sobre a janela de dados perdida (entre o dump e
   o incidente).

## 8. Rotina

| Quando | O quê |
|---|---|
| Diário | conferir alertas do Sentry/UptimeRobot e o log do backup |
| Semanal | revisar issues abertas no Sentry; `npm audit --omit=dev` |
| Mensal | drill de restauração completo (§7 num ambiente separado) + `npm run validate`; testar alertas (§2 e §3) |

## 9. Registro de testes de alerta

| Data | Teste | Resultado | Responsável |
|---|---|---|---|
| 2026-10-18 | Sentry (`npm run monitoring:test`), org `fgr-43`, ambiente `development` | evento `983e81d671094effb9d49ca8a658db79` enviado; API e worker iniciaram com Sentry ligado. Aguarda confirmação no painel/e-mail | Joas |
| — | Sentry em produção | pendente: DSN no servidor (item 1G) | — |
| — | UptimeRobot (`/health/ready`) | pendente: falta URL pública | — |
