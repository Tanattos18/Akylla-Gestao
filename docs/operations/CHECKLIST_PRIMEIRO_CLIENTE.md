# Checklist — primeiro cliente pagante

**Papel deste arquivo:** roteiro executável para sair do estado atual
(código completo, sem operação) até o primeiro cliente **pago em
produção**. Cada item tem comando/ arquivo concreto e **critério de
aceite testável**.

- **Não é plano aprovado** (regra 2 do `AGENTS.md`) — é o que executa
  **depois** de autorização, item a item.
- Origem das ideias: [`../../upgrade/MELHORIAS.md`](../../upgrade/MELHORIAS.md)
  (P0/P1) e o roteiro comercial discutido em 2026-10-14.
- Complementa (não substitui)
  [`../akylla/CHECKLIST_PRE_PRODUCAO.md`](../akylla/CHECKLIST_PRE_PRODUCAO.md):
  aquele lista **limitações conhecidas**; este lista **o que fazer**.

---

## Situação atual (linha de base — 2026-10-14)

| | Estado |
|---|---|
| Código | completo: 26 controllers, 28 models, 39 páginas, 13 migrations |
| Testes | **538/538** em PostgreSQL real; `npm run validate` verde |
| CI | ativa (`.github/workflows/ci.yml`: lint, typecheck, test com Postgres 17, build, `db:validate`) |
| Deploy | **não existe** (`cd.yml` só roda migrations + `echo`) |
| Backup | **não existe** (sem `pg_dump` agendado, sem restore testado) |
| LGPD | **não existe** (`apps/api/src/lgpd/` ausente) |
| Cobrança | Mercado Pago em **sandbox**; nunca validou pagamento real |
| Monitoramento | **não existe** |
| Segurança prod | 2 vulnerabilidades `npm audit --omit=dev` (`postcss` via `next`) |

---

## Definição de "pronto para vender"

O checklist está concluído quando **todos** os itens marcados como
**obrigatório** abaixo estão `[x]` e o **critério de aceite final**
(§Critério de aceite) passa.

---

## Semana 1 — Poder hospedar

> Objetivo: o sistema roda em um endereço público, com deploy
> automatizado, backup e alerta. **Nada disto é opcional.**

### 1.1 Definir hosting — **obrigatório**

- [ ] Decidir provedor (regra: decisão explícita do proprietário).
  Opções baratas para 1 instância: VPS + Docker, Railway, Render,
  Fly.io.
- [ ] Provisionar: banco PostgreSQL gerenciado (ou `pg` no mesmo VPS
      **com disco persistente**), domínio, TLS.
- [ ] Definir os secrets no GitHub Environments `staging` e
      `production`: `DATABASE_URL`, `AUTH_COOKIE_SECURE=true`,
      `APP_ORIGINS`, `WHATSAPP_*`, `MERCADOPAGO_*`.

**Aceite:** `https://<dominio>/health` responde 200 de fora.

**Depende de:** nada. **Primeiro item a executar.**

### 1.2 Fechar o CD — **obrigatório**

- [ ] Trocar os placeholders do `cd.yml`:
  - `.github/workflows/cd.yml:40` → `run: echo "Deploy to staging..."`
  - `.github/workflows/cd.yml:75` → `run: echo "Deploy to production..."`
- [ ] Adicionar passo de verificação pós-deploy (curl em `/health`).
- [ ] Conferir que `npm run db:deploy` roda **antes** do deploy da app
      (já está assim em `cd.yml:34-37` e `:69-72`).
- [ ] Ativar *manual approval* no environment `production` do GitHub.

**Aceite:** push em `main` sobe staging sozinho; produção só após
aprovação manual; rollback documentado (reverter commit + novo deploy,
ou restaurar snapshot do banco).

### 1.3 Backup automatizado **com restore testado** — **obrigatório**

- [ ] Criar `npm run db -- backup` (hoje `scripts/db.mjs` só tem
      `reset|studio|seed|status` — adicionar o subcomando `backup`).
- [ ] Agendar `pg_dump` diário (cron do provedor ou GitHub Actions
      agendado) com retenção de 30 dias **fora** da máquina da app.
- [ ] Restaurar em banco efêmero e rodar `npm run validate`.

**Aceite (obrigatório e não negociável):** existe um dump com data e
uma **restauração concluída com sucesso** registrada. Sem isto, não há
backup — há um arquivo que ninguém sabe se abre.

**Risco se pular:** perda total de dado do cliente pagante.

### 1.4 Monitoramento e alerta — **obrigatório**

- [ ] Sentry (ou GlitchTip auto-hospedado) na API e no worker, DSN via
      env.
- [ ] UptimeRobot/Healthchecks.io batendo em `GET /health` (já é
      `@Public`) com alerta por e-mail/Telegram.
- [ ] Alerta de erro 500 configurado.

**Aceite:** derrubar a API em staging gera alerta em < 5 min.

---

## Semana 2 — Poder confiar

> Objetivo: fechar as brechas de segurança e conformidade que tornam
> o contrato com o cliente um risco seu.

### 2.1 Zerar vulnerabilidades de produção — **obrigatório**

- [ ] Branch dedicada; um pacote por commit; `npm run validate` entre
      cada passo:
  - `next` → **16.4.1** (resolve `postcss`, as 2 de produção)
  - `vitest` → major atual (resolve `esbuild`/`tinypool`, as 6 de dev)
- [ ] Confirmar: `npm audit --omit=dev` → **0 vulnerabilidades**.

**Aceite:** comando acima limpo + 538/538 verdes.

**Referência:** `MELHORIAS.md` §4.3; limitação L1.

### 2.2 Endpoint LGPD de anonimização — **obrigatório**

- [ ] Migration aditiva se necessário (ex.: campo
      `anonymizedAt` em `Client`) + registro em `DATABASE.md`.
- [ ] `apps/api/src/lgpd/` — `DELETE /api/clients/:id/anonymize`
      protegido por `AdminGuard`.
- [ ] Anonimizar PII (nome → "Cliente removido", telefone/CPF/e-mail →
      mascarados) **preservando** `Sale`, `CashMovement` e
      `FinancialEntry` (a contabilidade depende).
- [ ] Trilha: quem pediu, quando, autor.
- [ ] Testes em `tests/integration/` (padrão já usado pelos 24
      arquivos existentes).

**Aceite:** após o endpoint, busca por CPF/e-mail do cliente devolve
nada; relatórios financeiros do período continuam íntegros;
`npm run validate` verde.

**Referência:** `MELHORIAS.md` §1.2; limitação L4.

### 2.3 D-7 do design: contraste — **obrigatório** (meio dia)

- [ ] Regra: **cor de texto só nos stops 700+**. Stops 500/600 seguem
      válidos como fundo, borda e ícone grande.
- [ ] Varredura em `apps/web/src`: `text-amber-500|600` → `-700`;
      `text-success-500` como texto → `-700`.
- [ ] Revalidar os pares com razão ≥ 4.5:1.

**Aceite:** nenhum `text-{color}-5xx/6xx` como cor de texto.

**Referência:** `MELHORIAS_DESIGN.md` §0 D-7 e §4.3.

### 2.4 Termos de uso e política de privacidade — **obrigatório**

- [ ] Duas páginas públicas no `apps/web` (`/termos`, `/privacidade`).
- [ ] Consentimento obrigatório no `/cadastro` (checkbox).
- [ ] Texto revisado juridicamente (fora do escopo técnico).

**Aceite:** cadastro não conclui sem aceite registrado (gravar a versão
e o timestamp do aceite).

### 2.5 Semana 2 — itens recomendados

- [ ] **D-1** `--foreground` indefinida em `globals.css:39` — definir
      no `@theme` (15 min).
- [ ] **D-5** criar `loading.tsx`, `error.tsx`, `not-found.tsx` em
      `apps/web/src/app/` (o App Router já renderiza; custo quase
      zero).

---

## Semana 3 — Poder cobrar

> Objetivo: validar a receita de ponta a ponta e preparar a
> demonstração comercial.

### 3.1 E2E real do Mercado Pago — **obrigatório**

- [ ] Cartão de teste do Mercado Pago em sandbox.
- [ ] Fluxo completo: `/faturamento` → checkout → preapproval →
      **webhook real** (`POST /api/webhooks/mercadopago`) →
      `TenantSubscription.status = ACTIVE`.
- [ ] Repetir: pagamento recusado → assinatura **não** fica `ACTIVE`.
- [ ] Documentar o resultado em `docs/operations/`.

**Aceite:** evidência gravada de uma assinatura `ACTIVE` criada por
pagamento **real do sandbox**, não pelo `MockMercadoPagoProvider`.

**Referência:** limitação L13; `MELHORIAS.md` §2.4.

### 3.2 Seed neutro por segmento — **obrigatório para demo**

- [x] Seeds por segmento (comercio, servicos, alimentacao); o preset
      "Mundo Pet" e o módulo Pets foram retirados em 2026-10-19.

**Aceite:** o demo usado na venda não parece de nicho.

### 3.3 Argumento comercial de migração — **obrigatório**

- [ ] Montar o roteiro de demonstração **começando pela importação**:
      1. cliente envia planilha de clientes/produtos (CSV)
      2. `/importacoes` com `dryRun` → revisão
      3. confirmar → dados no sistema em minutos
- [ ] Ter 2 planilhas-exemplo prontas (uma de cada segmento).

**Aceite:** roteiro escrito e ensaiado 2 vezes antes da primeira
reunião.

### 3.4 Itens recomendados da semana 3

- [ ] **`/faturamento` exibindo limites e uso** (limitação L12) —
      backend já expõe `userLimit`/`clientLimit`/`productLimit`;
      falta a tela. É argumento de venda.
- [ ] **Edição dos dados da empresa** (`PATCH /api/company`) —
      lacuna D1 do `MAPA_DE_MODULOS.md`. Sem isto, o cliente se chama
      errado no sistema para sempre.

---

## Modelo comercial do piloto

**Não** assinar recorrente no cliente 1. Modelo sugerido:

| | |
|---|---|
| Formato | setup + uso por 90 dias, com desconto |
| Escopo | 1 empresa, 1 segmento, módulos núcleo + WhatsApp |
| Exigido do cliente | planilha de migração, 1 operador treinado, testador do caixa diário |
| Exigido de você | SLA mínimo, backup diário, canal de suporte (WhatsApp/e-mail) |
| Ao fim | reavaliar preço e converter para assinatura |

**Cláusulas mínimas do contrato:** (1) responsabilidade sobre dado
(backup + LGPD), (2) nível de serviço mínimo, (3) cobrança recorrente
ativada após o piloto.

---

## Critério de aceite final (go / no-go)

Marcar **GO** só se **todos** forem verdadeiros:

- [ ] `https://<dominio>/health` 200 e deploy automático funcionando
- [ ] Existe dump com data **e** restore concluído registrado
- [ ] Alerta de uptime e de erro 500 recebidos pelo menos uma vez
- [ ] `npm audit --omit=dev` = 0 vulnerabilidades
- [ ] Endpoint LGPD testado de ponta a ponta
- [ ] Evidência de assinatura `ACTIVE` via pagamento real do sandbox
- [ ] Termos + privacidade publicados e aceite registrado no cadastro
- [ ] `npm run validate` verde no commit de produção
- [ ] Demo ensaiado 2 vezes, começando pela importação

**NO-GO** enquanto qualquer item obrigatório estiver pendente.

---

## Riscos aceitos (registrar a decisão)

Listar aqui, com data e autor, o que se decidiu aceitar temporariamente
(ex.: "rate limit in-memory aceito para 1 instância — L2";
"sem 2FA até o cliente 3 — MELHORIAS §1.7"). Sem registro, não é
aceite — é esquecimento.

| Data | Risco aceito | Motivo | Autor |
|---|---|---|---|
| | | | |

---

## Fora de escopo deste checklist

Coisas que **não** devem entrar aqui sem decisão nova:

- Cobrança recorrente em produção para cliente real (após GO + piloto)
- RLS no Postgres (defesa em profundidade; ver `MELHORIAS.md` §1.4)
- Multi-instância / Redis (só quando houver 2+ instâncias)
- Dark mode, PWA, tema por segmento (design; `MELHORIAS_DESIGN.md`)
- Funcionalidades novas de produto

---

## Ordem de execução

1. Autorizar o **plano** (este arquivo) — regra 2 do `AGENTS.md`.
2. Executar item a item, na ordem das semanas. Cada item concluído:
   `[x]` + evidência em `CHANGELOG.md`.
3. Rodar `npm run validate` ao fim de cada semana.
4. Ao fechar o §Critério de aceite, registrar **GO** em
   `PROJECT_STATUS.md` e iniciar o piloto.
