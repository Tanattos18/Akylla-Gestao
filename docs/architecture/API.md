# API — Akylla Gestão

Prefixo global: `/api` (exceto `GET /health` e `GET /health/ready`). Autenticação por cookie
`petflow_session` (HttpOnly) — ver `ARCHITECTURE.md`. Todos os endpoints
abaixo exigem sessão válida, exceto os marcados como públicos. Escopo de
tenant sempre derivado da sessão (`companyId`); nenhum `companyId` é aceito
do cliente.

## Códigos de erro

| Código | Quando |
|---|---|
| 400 | Payload/query inválido (Zod) ou regra de negócio (saldo insuficiente, ajuste negativo, categoria/fornecedor/produto/cliente/responsável inválidos, cliente/responsável inativo, data de nascimento futura) |
| 401 | Sem sessão ou sessão inválida/expirada |
| 403 | Sem papel `ADMIN` em rotas de escrita restrita |
| 404 | Recurso inexistente **ou** de outra empresa (sem vazar existência) |
| 409 | Conflito de unicidade (email, nome de categoria/produto, SKU, barcode, nome de serviço, cliente possivelmente duplicado) |

Respostas de erro seguem `{ statusCode, message, timestamp, path }` (Zod
inclui `issues[]`).

## Autenticação (Etapa 1)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/auth/options` | público | **Fase 8:** `{registrationEnabled, emailEnabled}` para as telas públicas esconderem cadastro e recuperação de senha quando indisponíveis |
| POST | `/api/auth/login` | público | Email+senha; retorna cookie HttpOnly |
| POST | `/api/auth/register` | público (flag) | **Fase 1 · 1D:** cria empresa nova em `PENDING_VERIFICATION` + administrador e envia o link de confirmação; responde 201 `{status:"PENDING_VERIFICATION", email}` **sem sessão**. Só responde quando `REGISTRATION_ENABLED=true` (senão 404). Rate limit por IP (`register|ip`, conta também os cadastros com sucesso). Turnstile quando `TURNSTILE_SECRET_KEY` existe (`captchaToken`; sem token ou inválido → 400). E-mail global único → 409; slug único gerado do nome da empresa |
| POST | `/api/auth/verify-email` | público | `{token}` do link: uso único, expira em `EMAIL_VERIFICATION_TTL_HOURS` (24 h). Ativa a empresa, marca `emailVerifiedAt`, abre a sessão e devolve `{user, company}` (200). Inválido, usado ou expirado → 400. Rate limit por IP |
| POST | `/api/auth/resend-verification` | público (flag) | `{email}` → sempre 200 `{ok:true}` (não revela se a conta existe); se houver cadastro pendente, invalida os links anteriores e envia um novo. Rate limit `resend|ip|email` |
| — | login de conta pendente | — | `POST /api/auth/login` com senha certa e e-mail não confirmado → **403** `{code:"EMAIL_NOT_VERIFIED"}`; senha errada continua 401 genérico |
| POST | `/api/auth/reset-password` | público (flag) | Redefine a senha pelo email digitado; só responde quando `PASSWORD_RESET_ENABLED=true` (senão 404), com rate limit próprio (`reset|ip|email`); usuário inativo/inexistente → 404, email em múltiplas contas → 400; revoga as sessões abertas do usuário |
| POST | `/api/auth/request-password-reset` | público | `{email}` → sempre 200 `{ok:true}` (não revela se a conta existe); gera token de redefinição de uso único. Rate limit `request-reset|ip|email` |
| POST | `/api/auth/confirm-password-reset` | público | `{token, password}` → 200 `{ok:true}`; token inválido/expirado → 400. Rate limit `confirm-reset|ip` |
| POST | `/api/auth/2fa/setup` | sessão (só ADMIN) | `{password}` (senha atual; errada → **400**). Gera o segredo TOTP e devolve os dados para o app autenticador (2FA ainda inativo); MEMBER → 403 |
| POST | `/api/auth/2fa/enable` | sessão | `{token}` (código de 6 dígitos) confirma e ativa o 2FA; código errado → **400** (nunca 401: não derruba a sessão) |
| POST | `/api/auth/2fa/disable` | sessão | `{password}` desativa o 2FA; senha errada → **400** |
| POST | `/api/auth/2fa/verify` | público | `{challengeId, token}`: segunda etapa do login com 2FA; abre a sessão (cookie). Rate limit por IP |
| POST | `/api/auth/change-password` | sessão | **Fase 8:** `{currentPassword, newPassword}` (8–72): troca a própria senha e encerra as outras sessões do usuário (a atual continua). Senha atual errada ou igual → 400. Rate limit por usuário |
| POST | `/api/auth/logout` | sessão | Revoga a sessão atual |
| GET | `/api/auth/me` | sessão | Usuário + empresa autenticados |
| GET | `/api/users` | ADMIN | Lista usuários da empresa |
| POST | `/api/users` | ADMIN | Cria usuário na empresa. E-mail é **único em todo o sistema** (auditoria bloco 2): já usado em qualquer empresa → **409**. Toda violação de índice único (P2002) responde 409 |
| POST | `/api/users/:id/reset-password` | ADMIN | **Fase 8:** senha provisória para alguém da equipe (`{temporaryPassword}`), sem depender de e-mail; derruba as sessões. A própria senha → 403 (use `change-password`) |
| PATCH | `/api/users/:id/status` | ADMIN | Ativa/inativa (revoga sessões) |
| GET | `/health` | público | Liveness: processo respondendo (não toca no banco) |
| GET | `/health/ready` | público | Readiness (Fase 1 · 1B): processo + banco (`SELECT 1`, limite de 2 s) → 200 `{status, database:"ok", databaseLatencyMs}` ou 503 `{status:"unavailable", database:"down"}`, sem detalhes internos. URL do UptimeRobot (`docs/operations/RUNBOOK.md`) |

## Categorias

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/categories` | sessão | Lista paginada; `search`, `status`, `page`, `pageSize` |
| GET | `/api/categories/:id` | sessão | Detalhe |
| POST | `/api/categories` | ADMIN | Cria (nome único por empresa, case-insensitive) |
| PATCH | `/api/categories/:id` | ADMIN | Edita |
| PATCH | `/api/categories/:id/status` | ADMIN | Ativa/inativa |

## Fornecedores

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/suppliers` | sessão | Lista paginada; `search`, `status` |
| GET | `/api/suppliers/:id` | sessão | Detalhe |
| POST | `/api/suppliers` | ADMIN | Cria |
| PATCH | `/api/suppliers/:id` | ADMIN | Edita |
| PATCH | `/api/suppliers/:id/status` | ADMIN | Ativa/inativa |

## Produtos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/products` | sessão | Lista paginada |
| GET | `/api/products/:id` | sessão | Detalhe com categoria/fornecedor/saldo |
| POST | `/api/products` | ADMIN | Cria (valida categoria/fornecedor da empresa) |
| PATCH | `/api/products/:id` | ADMIN | Edita (SKU/barcode revalidados) |
| PATCH | `/api/products/:id/status` | ADMIN | Ativa/inativa (nunca exclui fisicamente) |

Filtros de `GET /api/products`:

| Param | Tipo | Observação |
|---|---|---|
| `search` | texto | Nome, SKU ou código de barras (case-insensitive) |
| `categoryId` / `supplierId` | id | Escopados à empresa |
| `status` | `ACTIVE` \| `INACTIVE` | |
| `lowStock` | `true`/`false` | Somente produtos com estoque baixo |
| `orderBy` | `name` \| `createdAt` \| `stockQuantity` | Whitelist |
| `direction` | `asc` \| `desc` | |
| `page` / `pageSize` | números | `pageSize` máx. 100 |

O campo `lowStock` do produto é calculado no servidor (regra em
`DATABASE.md`); o cliente nunca envia saldo.

## Estoque

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/stock/entries` | sessão | Entrada (aumenta saldo) |
| POST | `/api/stock/exits` | sessão | Saída (rejeita saldo insuficiente) |
| POST | `/api/stock/adjustments` | ADMIN | Ajuste ±; `reason` obrigatório |
| GET | `/api/stock/balance/:productId` | sessão | Saldo atual + flag `lowStock` |
| GET | `/api/stock/movements` | sessão | Histórico paginado; filtros `productId`, `type` |
| GET | `/api/stock/low-stock` | sessão | Produtos ACTIVE em estoque baixo |

Payloads: `{ productId, quantity, notes?, reference? }` (entrada/saída) e
`{ productId, type: ADJUST_POSITIVE|ADJUST_NEGATIVE, quantity, reason }`
(ajuste). Quantidade sempre positiva (até 3 decimais). Resposta de
movimentação: `{ movement, stockQuantity }` — saldo sempre calculado no
servidor, dentro da transação com lock.

## Vendas (Etapa 3)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/sales` | sessão | Cria venda; recalcula tudo no servidor. Quantidade fracionada (até 3 casas, aceita "1,250") só para produtos em **KG** ou **L**; nas demais unidades fração → 400. Subtotal de cada item arredondado ao centavo |
| GET | `/api/sales` | sessão | Histórico paginado; filtros `status`, `search` (código), `from`/`to` (`YYYY-MM-DD`, UTC) |
| GET | `/api/sales/:id` | sessão | Detalhe com itens (snapshots) |
| POST | `/api/sales/:id/cancel` | ADMIN | Cancela com `reason`; devolve estoque |

Payload de criação:

```json
{
  "items": [{ "productId": "cuid", "quantity": "3" }],
  "discount": "10.00",
  "paymentMethod": "PIX",
  "paymentNote": null,
  "clientRequestId": "uuid-gerado-pelo-cliente",
  "clientId": "cuid-do-cliente-opcional"
}
```

- **Nunca** enviar preços/totais: `unitPrice`, `subtotal` e `total`
  enviados pelo cliente são descartados; o servidor usa `salePrice` do
  banco. Desconto `>` subtotal → 400; quantidade inválida ou produto
  inativo/estrangeiro à empresa → 400/404.
- `clientId` (opcional, Etapa 5): validado no servidor **antes** dos
  locks (cliente ativo e da mesma empresa; caso contrário 400
  `"Cliente inválido ou de outra empresa"`/`"Cliente está inativo"`).
  Ausente/null → venda sem cliente (venda rápida).
- `clientRequestId` (obrigatório no frontend, único por empresa) torna a
  criação idempotente: repetição → **409** sem alterar estoque.
- Resposta: `{ id, receiptCode, status, subtotal, discount, total,
  paymentMethod, paymentNote, createdAt, createdBy, clientId,
  client: { id, name }, items: [...] }` — Decimals serializados como
  string (`"259.70"`). Listagem e detalhe também incluem `client`.
- Cancelamento: `POST :id/cancel` com `{ reason }` (mín. 3 caracteres);
  venda já cancelada → **409**; venda de outra empresa → **404**;
  membro comum → **403**. Devolve estoque com movimentos `IN`
  compensatórios (`reference = receiptCode`) na mesma transação.

Busca de produtos no PDV reaproveita `GET /api/products?search=&status=ACTIVE`
(nome, SKU ou código de barras).

## Caixa e financeiro (Etapa 4)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/cash/sessions` | ADMIN | Abre a sessão (uma aberta por empresa; segunda → 409) |
| GET | `/api/cash/sessions/current` | sessão | Sessão `OPEN` com totais + `expectedBalance`; sem sessão → **404** |
| GET | `/api/cash/sessions` | sessão | Últimas 50 sessões com totais e `expectedBalance` |
| GET | `/api/cash/sessions/:id/summary` | sessão | Resumo da sessão (diferença quando fechada); outra empresa → 404 |
| POST | `/api/cash/sessions/:id/close` | ADMIN | Fecha com `countedAmount`; `expected`/`difference` calculados no servidor; já fechada → 409 |
| POST | `/api/cash/movements` | ADMIN | Movimentação manual (`type`, `amount`, `description`; `OUT` exige `justification`) com sessão aberta |
| GET | `/api/cash/movements` | sessão | Histórico paginado; filtros `from`/`to`, `sessionId`, `type`, `origin` |
| POST | `/api/cash/movements/:id/reversal` | ADMIN | Estorno auditável (`reason` ≥ 3) de lançamento `MANUAL` não estornado na sessão aberta |
| GET | `/api/cash/summary` | sessão | Resumo financeiro por período/sessão (vendas, manuais, cancelamentos, estornos, `net`) |

Payload de abertura: `{ "initialAmount": "150.00", "notes": "..." }`.
Payload de fechamento: `{ "countedAmount": "265.50", "notes": "..." }` —
resposta inclui `expectedBalance` e `differenceBalance` (nunca vêm do
cliente).

Comportamentos importantes:

- **Vendas e cancelamentos exigem caixa aberto**: `POST /api/sales` e
  `POST /api/sales/:id/cancel` respondem **409** (`"Caixa fechado: abra o
  caixa para ..."`) quando não há sessão `OPEN`; na criação/cancelamento a
  venda grava `cashSessionId` e um lançamento `CashMovement` (`origin`
  `SALE`/`SALE_CANCELMENT`, `inCash` conforme `paymentMethod === "CASH"`).
- `GET /api/cash/sessions/current` responde **404** quando não há sessão
  aberta (frontend trata 404 como "caixa fechado").
- Escrita restrita a `ADMIN` (abrir, fechar, movimentar, estornar);
  leitura liberada a qualquer sessão autenticada.
- Estorno de lançamento `SALE`/`SALE_CANCELMENT` → 400 (usar cancelamento
  da venda); lançamento já estornado → 409; sessão fechada → 409;
  lançamento de outra empresa → 404.

## Contas a pagar e a receber — Financial (Etapa 8)

Modelo `FinancialEntry` (migration `20261012164040_financial_entry`).
Título independente do caixa: a **liquidação** (`POST /:id/pay`) cria um
`CashMovement` com `origin = ACCOUNT` na sessão aberta.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/financial` | ADMIN | Cria título (`direction` `PAYABLE`/`RECEIVABLE`, `reason`, `dueDate`, `amount`, opcional `clientId`/`supplierId`/`notes`) |
| GET | `/api/financial` | sessão | Lista paginada; filtros `direction`, `status`, `search`, `from`, `to`, `page`, `pageSize` |
| GET | `/api/financial/summary` | sessão | Totais por `direction` e `status` + vencidos; filtros `from`, `to` |
| GET | `/api/financial/:id` | sessão | Detalhe; outra empresa → **404** |
| PATCH | `/api/financial/:id` | sessão | Edita campos não críticos (`description`, `dueDate`, `notes`); título `PAID`/`CANCELLED` → 409 |
| POST | `/api/financial/:id/pay` | ADMIN | `{paymentMethod?: CASH\|PIX\|CARD\|BOLETO\|TRANSFER\|OTHER}` (padrão `CASH`). Liquida: `OPEN` → `PAID` e lança no caixa; só `CASH` entra na gaveta (`inCash`); exige sessão de caixa aberta; já liquidado → 409 |
| POST | `/api/financial/:id/reverse` | ADMIN | Estorna liquidação auditável (exige `reason` ≥ 3) via movimento compensatório |
| POST | `/api/financial/:id/cancel` | ADMIN | Cancela título `OPEN` (`reason` ≥ 3); nunca apaga registro |

Comportamentos importantes:

- `status` usa o enum `FinancialStatus`: **`OPEN` / `PAID` /
  `CANCELLED`** (não `PENDING`).
- Histórico imutável: correção e cancelamento geram movimentos
  compensatórios, nunca `DELETE`.
- `POST /:id/pay` e `POST /:id/reverse` precisam de sessão de caixa
  `OPEN` (409 quando fechada).
- Escopo de tenant por `companyId` da sessão; leitura individual via
  `findFirst({ id, companyId })` → 404.

## Clientes (Etapa 5)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/clients` | sessão | Lista paginada; `search` (nome/telefone/email/CPF), `status`, `page`, `pageSize`; inclui `_count.sales` |
| GET | `/api/clients/:id` | sessão | Detalhe com contagens |
| POST | `/api/clients` | sessão | Cria (MEMBER pode — operação diária) |
| PATCH | `/api/clients/:id` | sessão | Edita |
| PATCH | `/api/clients/:id/status` | sessão | Ativa/inativa |

- Normalização no servidor (Zod compartilhado): telefone/CPF só dígitos
  (`normalizePhone`), email em minúsculas; endereço estruturado
  (`street`, `number`, `complement`, `district`, `city`, `state`, `zip`).
- **Duplicidade**: criação responde **409** `"Cliente possivelmente
  duplicado"` quando `nameKey` + algum contato coincide com cliente
  `ACTIVE`; homônimos sem contato e mesmo telefone em clientes distintos
  são permitidos (política em `DATABASE.md`).
- Recurso de outra empresa → 404; cliente inativo não bloqueia novo
  cadastro nem edição.

## Pets — removido (2026-10-19)

O módulo Pets saiu do produto: o Akylla Gestão é um sistema de gestão
empresarial genérico. Não há rotas `/api/pets`. A tabela `Pet` e
`Appointment.petId` ficam no banco só como legado (exportação de dados e
anonimização LGPD).

## Serviços (Etapa 5)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/services` | sessão | Lista paginada; `search`, `status`, `orderBy` (name/price/createdAt) |
| GET | `/api/services/:id` | sessão | Detalhe |
| POST | `/api/services` | ADMIN | Cria (nome único por empresa → 409) |
| PATCH | `/api/services/:id` | ADMIN | Edita |
| PATCH | `/api/services/:id/status` | ADMIN | Ativa/inativa |

- Payload: `{ name, description?, durationMinutes? (1..1440),
  price (Decimal(12,2) ≥ 0) }`; `price` sempre string no wire
  (`"80.00"`); nome duplicado na empresa → **409** `"Já existe um
  serviço com este nome nesta empresa"`.

## WhatsApp (Etapa 6)

Integração com a **WhatsApp Business Cloud API** (Meta). Webhook é o
único endpoint público desta seção; demais exigem sessão.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/whatsapp/config` | sessão | Configuração da empresa (credenciais **nunca** retornadas; só flag `hasAccessToken`) |
| PUT | `/api/whatsapp/config` | ADMIN | Salva `phoneNumberId`, `wabaId`, `displayName` + lembrete (`reminderTemplateId`, `reminderLeadMinutes` — template precisa ter exatamente 3 variáveis) |
| POST | `/api/whatsapp/config/health` | ADMIN | Testa credencial com o provedor (token sanitizado no erro) |
| PATCH | `/api/whatsapp/config/status` | ADMIN | `ACTIVE`/`DISCONNECTED` (desconectar bloqueia envios) |
| GET | `/api/whatsapp/templates` | sessão | Lista templates da empresa (filtros `status`, `search`) |
| GET | `/api/whatsapp/templates/:id` | sessão | Detalhe do template |
| POST | `/api/whatsapp/templates` | ADMIN | Cria template (`variablesCount` derivado do corpo) |
| PATCH | `/api/whatsapp/templates/:id` | ADMIN | Edita campos; aceita `approval` = `PENDING_APPROVAL`/`APPROVED`/`REJECTED` (aprovação interna) |
| PATCH | `/api/whatsapp/templates/:id/status` | ADMIN | `status` = `ACTIVE`/`INACTIVE` (enum `RecordStatus`) |
| GET | `/api/whatsapp/consents` | sessão | Lista consentimentos (filtros `status`, `search`) |
| GET | `/api/whatsapp/consents/:clientId` | sessão | Consentimento do cliente; sem registro → **404** |
| PUT | `/api/whatsapp/consents/:clientId` | ADMIN (opt-in) / sessão (opt-out) | `{ status: "OPTED_IN"|"OPTED_OUT", source }` — descadastro liberado a qualquer sessão |
| GET | `/api/whatsapp/messages` | sessão | Fila/histórico; filtros `status`, `search`, `page`, `pageSize` |
| POST | `/api/whatsapp/messages` | sessão | Enfileira (`clientId`, `templateId`, `variables`, `clientRequestId`) |
| GET | `/api/whatsapp/messages/:id` | sessão | Detalhe com template + tentativas |
| POST | `/api/whatsapp/messages/:id/cancel` | sessão | Cancela `PENDING`/`RETRY` (já em andamento → 409) |
| GET | `/api/webhooks/whatsapp` | **público** | Verificação Meta (query `hub.*`) → challenge `text/plain` |
| POST | `/api/webhooks/whatsapp` | **público** | Eventos Meta; exige `x-hub-signature-256` válido → 403 se inválido |

Comportamentos importantes:

- **Enfileirar ≠ entregar**: `POST /messages` valida no servidor
  cliente `ACTIVE` da empresa, template `APPROVED`, consentimento
  `OPTED_IN` e variáveis contra `templateVariableCount()`, e grava
  `PENDING`; o envio real é do worker (ver `ARCHITECTURE.md`).
- Idempotência: `clientRequestId` único por empresa — repetição retorna
  a mesma mensagem (sem duplicar fila).
- Webhook: verificação `HMAC-SHA256` com `WHATSAPP_APP_SECRET` sobre o
  **corpo bruto** (`rawBody`); eventos idempotentes por `wamid`+tipo;
  resposta de texto `"SAIR"` → opt-out (`source = REPLY`).
- Erros do provedor classificados server-side: 429/408/5xx =
  TRANSIENT (worker reagenda com backoff); demais = PERMANENT (falha
  imediata, `attemptCount` nunca passa de `maxAttempts` = 3).
- Recurso de outra empresa → 404; token/access token aparecem apenas em
  configuração local (`.env`), nunca em resposta ou log.

## Relatórios e dashboard (Etapa 7)

Agregação **server-side** sobre os dados reais das Etapas 1–8 — nada
é calculado no navegador e nenhum dado fictício é retornado. Todos os
endpoints exigem apenas sessão (leitura), `companyId` vem sempre do
contexto autenticado e aceitam `from`/`to` em `YYYY-MM-DD`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/reports/summary` | sessão | KPIs: vendas (concluídas/canceladas, líquido/bruto/descontos, ticket médio), vendas por dia e por forma de pagamento, caixa (sessão aberta + `inCash`/totais), estoque (baixo/zerado), clientes novos, WhatsApp por status, agendamentos por status (`services`), `modules.servicesRealized` |
| GET | `/api/reports/sales` | sessão | Totais separados concluídas × canceladas + lista paginada; filtros `from`, `to`, `status`, `paymentMethod`, `page`, `pageSize`, `format` |
| GET | `/api/reports/stock/alerts` | sessão | Produtos sem estoque ou no mínimo (inativos excluídos); `page`, `pageSize`, `format` |
| GET | `/api/reports/stock/movements` | sessão | Totais por tipo (zero-fill) + lista; filtros `productId`, `type`, período, paginação, `format` |
| GET | `/api/reports/cash` | sessão | `inCash` vs todos, estornos por origem, sessões abertas/fechadas no período |
| GET | `/api/reports/clients` | sessão | Clientes novos no período + agendamentos por status (`services`); **sem indicadores de nicho** (`newPets`/`petsBySpecies` removidos na Etapa 9) |
| GET | `/api/reports/whatsapp` | sessão | Contagem por status atual + falhas agrupadas por motivo |

Comportamentos importantes:

- **Período em UTC**: janela inclusiva `from T00:00:00.000Z`–
  `to T23:59:59.999Z`; padrão dos últimos `30` dias ancorado no
  `to`; intervalo máximo de `366` dias; `from > to`, formato ou
  data de calendário inválidos → **400** com `issues`.
- **Totais × lista (vendas)**: os totais separados concluídas ×
  canceladas consideram o período e `paymentMethod`; o filtro
  `status` altera **apenas** a lista de itens. Documentado aqui para
  evitar surpresa de consumo.
- **Ticket médio** = líquido ÷ vendas concluídas com 2 casas; sem
  vendas no período o campo volta `null` (nunca `0` fingindo dado).
- **Serviços realizados**: `summary.modules.servicesRealized` vem
  com `available: true` desde a Etapa 8; `summary.services` e
  `clients.services` trazem contagens de agendamentos por status
  (zero-fill) no período — filtros de status em `/clients` não
  existem.
- **WhatsApp**: contagem pelo status **atual** do registro;
  `ACCEPTED` (aceito pela API Meta) não é `DELIVERED`.
- **CSV** (`format=csv` em sales, stock/alerts, stock/movements):
  `text/csv` + `Content-Disposition` com filename
  `akylla_<relatório>_<from>_<to>.csv`, linhas separadas por CRLF,
  escape por aspas e neutralização de injeção (célula iniciada por
  `=`, `+`, `-`, `@`, TAB ou CR — inclusive após espaço inicial —
  recebe apóstrofo); teto de `5000` linhas e **ignora paginação**;
  exige sessão (401 sem cookie).
- Recurso de outra empresa nunca aparece (404/escopo); parâmetro
  `companyId` enviado pelo cliente é **ignorado**.
- **Dicionário completo dos indicadores** (definição, fórmula, fonte,
  estado vazio e como rastrear cada número):
  `docs/akylla/DICIONARIO_INDICADORES.md` (Etapa 9).

## Agendamentos (Etapa 8)

Sessão autenticada — **sem `AdminGuard`**: agenda é operação diária e
também membros criam/editam. `companyId` sempre da sessão.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/appointments` | sessão | Cria (201): `clientId`, `serviceId`, `startLocal` (`YYYY-MM-DDTHH:mm`), `utcOffsetMinutes`, `notes?` |
| GET | `/api/appointments` | sessão | Lista; filtros `from`, `to` (dia em `startLocal`), `status`, `clientId`, `serviceId`, `search`, `page`, `pageSize` |
| GET | `/api/appointments/:id` | sessão | Detalhe (404 cross-tenant) |
| PATCH | `/api/appointments/:id` | sessão | Edição parcial/reagendamento (apenas status não-terminal) |
| PATCH | `/api/appointments/:id/status` | sessão | `CONFIRMED`, `COMPLETED` ou `NO_SHOW` (terminal → 409) |
| POST | `/api/appointments/:id/cancel` | sessão | Cancela (201): `reason` 3..500 obrigatório; terminal → 409 |

Comportamentos importantes:

- **Horário calculado no servidor**: `startAt`/`endAt` derivam de
  `startLocal` + `utcOffsetMinutes` (leste-positivo, ±840 min — o
  cliente envia `-getTimezoneOffset()`); `durationMinutes` vem do
  serviço (`1..1440`, obrigatório). Passado (tolerância 60 s) → **400**.
- **Conflito da empresa inteira**: em transação com
  `SELECT ... FOR UPDATE` na `Company` (mesmo padrão da sessão de
  caixa), qualquer `SCHEDULED`/`CONFIRMED` sobreposto
  (`startAt < end AND endAt > start`) → **409**; fim-início exato
  permitido; `COMPLETED`/`CANCELLED`/`NO_SHOW` não bloqueiam; a
  edição exclui o próprio registro da checagem.
- **Validações**: cliente ativo, serviço ativo, todos
  da empresa (cross-tenant → 404); `endAt` sempre derivado (nunca
  vem do cliente).
- **Lembrete automático** (`syncReminder`, mesma transação do CRUD):
  enfileira `WhatsAppMessage` com chave `appointment-reminder:<id>`
  (`origin: SERVICE_REMINDER`, única por empresa),
  `nextAttemptAt = max(now, startAt − reminderLeadMinutes)` e
  variáveis `[cliente, serviço, "dd/mm/aaaa às HH:mm"]`;
  revalida config ≠ `DISCONNECTED`, template selecionado
  `APPROVED`/ativo com 3 variáveis, telefone E.164 e consentimento
  `OPTED_IN`; reagendar atualiza a pendente, cancelar/concluir/inelegível
  cancela com motivo; falha de lembrete só loga — o CRUD nunca falha.
- Campos de lembrete também em `GET/PUT /api/whatsapp/config`:
  `reminderTemplateId` (template da empresa com exatamente 3
  variáveis → 400 caso contrário) e `reminderLeadMinutes`
  (5..40320, default 1440).

## Assinaturas e billing (Etapa 9)

Duas famílias: assinaturas dos **clientes da empresa** (tenant-scoped,
escrita com `AdminGuard`) e **billing da empresa no SaaS** (catálogo
global + assinatura única por empresa). Pagamentos usam o caixa
existente (sem gateway); `companyId` sempre da sessão.

### Planos e assinaturas de clientes

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/subscription-plans` | sessão | Lista; `search`, `status`, `page`, `pageSize`, `orderBy` (`name`/`price`/`createdAt`) |
| POST | `/api/subscription-plans` | ADMIN | Cria (201): `name` único por empresa → 409, `price`, `durationDays` (1..3650), `description?` |
| GET | `/api/subscription-plans/:id` | sessão | Detalhe (404 cross-tenant) |
| PATCH | `/api/subscription-plans/:id` | ADMIN | Edição parcial (404 cross-tenant) |
| PATCH | `/api/subscription-plans/:id/status` | ADMIN | `ACTIVE`/`INACTIVE` |
| GET | `/api/subscriptions` | sessão | Lista; `status`, `clientId`, `deliveryId`, `search`, `page`, `pageSize`; expiração lazy |
| POST | `/api/subscriptions` | ADMIN | Cria (201): `clientId`, `planId`, `startAt?` (ISO), `registerPayment?`, `deliveryId?` (entrega do mesmo cliente; outra empresa → 404, outro cliente → 400) |
| GET | `/api/subscriptions/:id` | sessão | Detalhe com `payments` (404 cross-tenant; expiração lazy) |
| POST | `/api/subscriptions/:id/renew` | ADMIN | Renova (201): exige caixa aberto; cancelada → 409 |
| POST | `/api/subscriptions/:id/cancel` | ADMIN | Cancela (201): `reason` 3..500; duplo → 409 |

Comportamentos importantes:

- **Criação**: cliente e plano devem estar ativos e da empresa
  (cross-tenant → 404, inativo → 400); `startAt` opcional (padrão
  `now`); `registerPayment: true` cria `CashMovement` `IN`/`MANUAL`
  (`inCash: true`, origem `MANUAL`, `subscriptionId` vinculado) em
  transação **após** `lockOpenCashSession` — caixa fechado → **409**.
- **Renovação** (transação): trava a sessão de caixa, novo período
  começa em `max(now, endAt)`, `status` volta a `ACTIVE`,
  `renewalCount + 1`, `lastPaymentAt = now` e movimento de caixa
  "Renovação de assinatura: cliente — plano"; assinatura `CANCELLED`
  → **409**; caixa fechado → **409**.
- **Cancelamento**: `updateMany({ id, companyId, status: ACTIVE })` —
  0 linhas → **409** (dupla corrida/estado inválido); grava motivo,
  `cancelledAt` e `cancelledByUserId`.
- **Expiração lazy**: leituras (`GET` lista/detalhe) marcam
  `EXPIRED` quando `endAt < now`; a mudança de status também reage
  em `GET` individual.

### Billing da empresa no SaaS (globais)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/billing/plans` | sessão | Catálogo global ativo (`{ items }`), ordenado por preço; inclui `userLimit`/`clientLimit`/`productLimit` (`null` = ilimitado) |
| GET | `/api/billing/subscription` | sessão | Assinatura da empresa (404 se ausente; expiração lazy) |
| GET | `/api/billing/access` | sessão | **Fase 8:** situação de acesso `{status, trialEndsAt, paidUntil, graceEndsAt, daysLeft, readOnly, planName, cycle}` (`EXEMPT`, `TRIAL`, `ACTIVE`, `GRACE`, `READ_ONLY`, `SUSPENDED`) |
| GET | `/api/billing/usage` | sessão | `{subscription, usage:{users, clients, products}}` para comparar com os limites do plano |
| POST | `/api/billing/subscription/cancel` | ADMIN | Cancela (201): `reason?` ≤ 500; duplo → 409 |
| GET | `/api/billing/modules` | sessão | Kits (Fase 8b): preço mensal de cada módulo avulso ativo `{items:[{module,label,description,priceMonthly,active,sortOrder}]}` |
| GET | `/api/billing/gateway` | ADMIN | Describe do gateway: `{ env: "sandbox" \| "production", credentialsConfigured }` |
| POST | `/api/billing/checkout` | ADMIN | Cria preapproval no Mercado Pago (sandbox por padrão): `{ planId, payerEmail }` → `{ checkoutUrl, gatewaySubscriptionId }`; sem token → 400 com mensagem explícita |

### Webhook Mercado Pago (Etapa 11)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/webhooks/mercadopago` | `@Public` + assinatura HMAC | Processa eventos `type=preapproval`: assinatura `x-signature` verificada com `MERCADOPAGO_WEBHOOK_SECRET`; idempotente por `gatewaySubscriptionId`; resposta `{ received, processed }` |

Comportamentos importantes:

- `TenantPlan`/`TenantSubscription` são **globais por decisão
  documentável** (exceção à regra de `companyId`): o catálogo é da
  plataforma e a assinatura é única por empresa (`companyId @unique`).
- Escrita do catálogo global **não é exposta** nesta etapa (exige
  papel de plataforma — pendência registrada).
- **Enforcement de limites (Etapa 11, decisão D3)**: `TenantLimitsService`
  verifica `userLimit`/`clientLimit`/`productLimit` no `create` de
  Users/Clients/Products — **apenas** para empresas com assinatura
  `ACTIVE`; sem assinatura, expirada ou cancelada, nenhum limite é
  aplicado. Limite `NULL` = ilimitado.
- **Gateway Mercado Pago (Etapa 11, decisão D4)**: sandbox por padrão;
  checkout cria preapproval e a assinatura só fica `ACTIVE` quando o
  webhook confirma o pagamento; sem `MERCADOPAGO_ACCESS_TOKEN`, o
  checkout retorna 400 explícito (nunca cobra por engano).

## Módulos por empresa (Etapa 10)

Ativação/desativação de módulos de negócio por tenant (decisão D3 —
opção B: tabela `CompanyModule`).

| Método e rota | Guard | Descrição |
|---|---|---|
| `GET /api/company-modules` | Sessão | Lista os 9 módulos desativáveis (incluindo `ADS`, anúncios, desde 2026-10-29) com `module`, `status` (`ACTIVE` = padrão quando não há linha) e `label`; Kits (Fase 8b): `entitled` = contratado (kit + avulsos; tudo no teste/isenta). Rota de módulo não contratado → **403** `{code:"MODULE_NOT_CONTRACTED"}` |
| `PATCH /api/company-modules` | `AdminGuard` | Upsert `{ module, status }` da empresa autenticada (Zod `upsertCompanyModuleSchema`) |

- **Bloqueio no servidor:** `ModuleGuard` (APP_GUARD, registrado após
  `AuthGuard`) consulta `CompanyModule`; `DISABLED` → **403** com mensagem
  "Módulo desativado para esta empresa". Rotas marcadas com
  `@RequireModule(...)`: `services`, `appointments`,
  `whatsapp/config|templates|consents|messages`,
  `subscriptions`, `subscription-plans`, `ads/*` e `clients/:id/ads` (`ADS`). Rotas **sem** decorator e rotas
  `@Public` (ex.: webhook `/api/webhooks/whatsapp`) nunca são bloqueadas.
- Ocultação de cards na home acompanha o status (UI), mas **não é
  controle de acesso** — a fonte de verdade é o guard.
- Núcleo (clientes, produtos, vendas, caixa, financeiro, relatórios,
  billing, usuários) não é desativável.

## Importação de planilhas (CSV)

Upload de CSV em massa para alimentar dados da empresa (decisões D1–D8
de `docs/akylla/PLANO_IMPORTACAO.md`). Plano aberto: `/importacoes`
(UI `apps/web/src/app/importacoes/page.tsx`), rota na navegação apenas
para ADMIN.

| Método e rota | Guard | Descrição |
|---|---|---|
| `GET /api/imports/template?type=CATEGORY` | `AdminGuard` | Modelo CSV da entidade (`text/csv` com BOM e `;`, `Content-Disposition: attachment; filename=akylla_modelo_<entidade>.csv`) |
| `POST /api/imports` | `AdminGuard` | Upload multipart `file` (CSV ≤ 5 MB, ≤ 5000 linhas de dados) + campos `type` (obrigatório) e `dryRun` (`"true"`/`"false"`, padrão `false`) |
| `GET /api/imports?page=1&pageSize=10` | `AdminGuard` | Histórico paginado de `ImportBatch` da empresa (mais novo primeiro), com `createdByName` |

- **Tipos aceitos:** `CATEGORY`, `SUPPLIER`, `PRODUCT`, `CLIENT`,
  `SERVICE` (Zod `importTypeSchema` em `@petflow/shared`).
- **Resposta do upload** (`importReportSchema`): `batchId`, `type`,
  `filename`, `dryRun`, `totalRows`, `created`, `skipped`, `errors`,
  `errorDetails[]` (`row` = linha física, `field`, `message`; máx. 100).
- **Erros por linha** não abortam o lote (400 com `errorDetails` só
  quando falha a estrutura: extensão ≠ `.csv`, cabeçalho sem colunas
  obrigatórias, arquivo vazio, > 5000 linhas, delimitador não
  detectado).
- **Duplicidades** são puladas com aviso (não são erro): ver
  `DATABASE.md` a regra por tipo; duplicidade interna do arquivo também
  conta como `skipped`.
- **Limites de plano (D8):** com assinatura `ACTIVE`, o total atual +
  linhas do lote não pode exceder `clientLimit`/`productLimit` → **403**
  "Limite do plano <nome> atingido". Sem assinatura não há limite
  (regra "sem assinatura = sem limite" preservada). Checagem única
  pré-lote, antes do dry-run.
- **Referências por nome:** produtos podem citar `categoria`/`fornecedor`
  pelo nome (match por `nameKey`/nome normalizado); inexistente → erro
  na linha (não auto-cria — decisão D7).
- **Delimitador:** detectado na primeira linha (`,` vs `;`); BOM UTF-8
  aceito; preços em formato BR (`1.234,56`) e telefones normalizados no
  servidor.
- Arquivo > 5 MB → **413** (Multer `LIMIT_FILE_SIZE` tratado em
  `AllExceptionsFilter`).
- Nenhuma rota marcada `@Public()`; todas exigem sessão +
  `AdminGuard` (MEMBER → 403).

## Comissões (Fase 2 · 2.1)

Módulo opcional `COMMISSIONS` (`@RequireModule`; desativado → 403). Regras
de negócio: [`docs/akylla/COMISSOES.md`](../akylla/COMISSOES.md).

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/professionals` | sessão | lista (`search`, `status`, paginação) |
| GET | `/api/professionals/:id` | sessão | detalhe (outra empresa → 404) |
| POST | `/api/professionals` | ADMIN | `{name, document?, commissionDefault?}` (0–100, string); nome duplicado (normalizado) → 409 |
| PATCH | `/api/professionals/:id` | ADMIN | edição parcial |
| PATCH | `/api/professionals/:id/status` | ADMIN | `{status: ACTIVE\|INACTIVE}` |
| GET | `/api/commission-rules` | ADMIN | lista (`professionalId`, `active`) |
| POST | `/api/commission-rules` | ADMIN | `{professionalId?, productId?, categoryId?, percentage, releasePolicy?, active?}`; produto **e** categoria → 400; alvo de outra empresa → 400 |
| PATCH | `/api/commission-rules/:id` | ADMIN | edição parcial (inclusive `active`) |
| GET | `/api/commissions` | sessão | lista (`from`, `to`, `professionalId`, `status`, paginação) + `totals {amount, baseAmount}` |
| GET | `/api/commissions/summary` | sessão | fechamento por profissional no período: `pending`, `released` (`toPay`), `paid`, `cancelled` |
| GET | `/api/commissions/:id` | sessão | detalhe com `lines` (base/%/valor/regra por item) |
| POST | `/api/commissions/:id/release` | ADMIN | `PENDING → RELEASED` + conta a pagar; outro status → 409 |
| POST | `/api/commissions/:id/pay` | ADMIN | `{paymentMethod?}` como em `/api/financial/:id/pay`; liquida a conta a pagar (exige **caixa aberto**, senão 409) → `PAID` |

**Integração com vendas:** `POST /api/sales` aceita `professionalId?`
(ativo, da empresa, senão 400; módulo desativado → 403). A comissão é
calculada no servidor, na mesma transação da venda, e
`POST /api/sales/:id/cancel` cancela ou estorna a comissão na mesma
transação. O detalhe da venda traz `professional {id, name}`.

**Financeiro:** títulos `origin: COMMISSION` sincronizam com a comissão
(liquidar → `PAID`; estornar → `RELEASED`) e não podem ser editados nem
cancelados avulsos (409). `COMMISSION_REVERSAL` (a receber) não pode ser
editado.

## Crediário (Fase 2 · 2.2)

Módulo opcional `CREDIT`. Regras: [`docs/akylla/CREDIARIO.md`](../akylla/CREDIARIO.md).

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/credit-accounts` | sessão | carteira (`search`, `status`) com `available` e `overdue` por cliente + `totals {receivable, overdue, overdueCount}` |
| GET | `/api/credit-accounts/:clientId` | sessão | conta + parcelas (sem conta → 404) |
| PATCH | `/api/credit-accounts/:clientId` | ADMIN | `{creditLimit?, status?}`: aprova (cria) ou ajusta; criar sem limite → 400; cliente de outra empresa → 404 |
| GET | `/api/credit-installments` | sessão | parcelas (`status`, `clientId`, `from`/`to` de vencimento) + `totals.amount` |
| POST | `/api/credit-installments/:id/pay` | ADMIN | `{paymentMethod?}` (só dinheiro vai para a gaveta); recebe a parcela (caixa aberto, senão 409); paga/cancelada → 409 |

**Venda:** `POST /api/sales` com `paymentMethod: "CREDIARIO"` exige
`clientId` e `credit {installments 1–24, firstDueDate}` (400 se faltar;
`credit` com outra forma → 400). Sem conta, bloqueada ou acima do limite →
403. Não lança entrada no caixa. O cancelamento devolve só o que foi pago.
Todas as leituras marcam parcelas vencidas (`OVERDUE`).

**Financeiro:** `origin: CREDIT_SALE` sincroniza com a parcela (liquidar →
paga; estornar → em aberto) e não pode ser editado nem cancelado avulso
(409).

## Ordens de serviço (Fase 2 · 2.3)

Módulo opcional `SERVICE_ORDERS`; qualquer usuário da empresa opera. Regras:
[`docs/akylla/ORDEM_DE_SERVICO.md`](../akylla/ORDEM_DE_SERVICO.md).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/service-orders` | lista (`status`, `clientId`, `search` por nº/cliente/título, `from`/`to`) + `countsByStatus` |
| GET | `/api/service-orders/:id` | detalhe com itens e anexos; `code` = `OS-00001` |
| POST | `/api/service-orders` | `{clientId, professionalId?, title, notes?, discount?, items[]}`; item = `{serviceId?\|productId?, description?, quantity, unitPrice?}` (catálogo → preço do catálogo; livre → `description` + `unitPrice`) |
| PATCH | `/api/service-orders/:id` | `title`/`discount`/`professionalId` só em rascunho/orçamento (senão 409); `notes` até cancelar |
| PUT | `/api/service-orders/:id/items` | substitui os itens (rascunho/orçamento) e recalcula |
| PATCH | `/api/service-orders/:id/status` | `{status}` = **próximo** estado (pular → 400). `COMPLETED` → estoque, conta a receber e comissão |
| POST | `/api/service-orders/:id/cancel` | `{reason}` (3–500); concluída/cancelada → 409 |
| POST | `/api/service-orders/:id/attachments` | multipart `file`: JPG/PNG/PDF (tipo pelos bytes) até 5 MB (413), máx. 20 |
| GET | `/api/service-orders/:id/attachments/:attachmentId` | download (`nosniff`, `no-store`) |
| DELETE | `/api/service-orders/:id/attachments/:attachmentId` | só antes de concluir/cancelar (senão 409) |
| GET | `/api/service-orders/:id/messages` | mensagens de WhatsApp vinculadas (`origin: SERVICE_ORDER`) |

**WhatsApp:** `POST /api/whatsapp/messages` aceita `serviceOrderId?` (OS
do mesmo cliente; outra → 404/400) para vincular a mensagem.
**Financeiro:** `origin: SERVICE_ORDER` não pode ser editado (409); ao
receber, libera comissões `ON_PAYMENT` da OS.

## Fiscal por integração (Fase 3)

Módulo opcional `FISCAL`. Regras e pendências: [`docs/akylla/FISCAL.md`](../akylla/FISCAL.md).

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/fiscal/status` | sessão | `{active, environment, simulated}` (para PDV/OS) |
| GET | `/api/fiscal/config` | ADMIN | configuração **sem segredos** (`hasApiToken`, dados do certificado) |
| PUT | `/api/fiscal/config` | ADMIN | `{provider?, environment?, active?, cnpj?, apiToken?, nfceSeries?, nfeSeries?}`; ativar exige CNPJ (e token + certificado para integradora real) → 400; sem `FISCAL_ENCRYPTION_KEY` → 503 |
| POST | `/api/fiscal/config/certificate` | ADMIN | multipart `file` (.pfx ≤ 64 KB) + `password`; senha errada, arquivo inválido ou vencido → 400 |
| POST | `/api/fiscal/documents` | ADMIN | `{saleId\|serviceOrderId, type}`: venda → NFCE/NFE (NF-e exige cliente com CPF); OS concluída → NFSE. Inativo → 400; duplicada ativa → 409 |
| GET | `/api/fiscal/documents` | sessão | lista (`type`, `status`, `saleId`, `serviceOrderId`, `from`/`to`) |
| GET | `/api/fiscal/documents/:id` | sessão | detalhe (`hasXml`) |
| GET | `/api/fiscal/documents/:id/xml` | sessão | download do XML |
| POST | `/api/fiscal/documents/:id/cancel` | ADMIN | `{reason}` 15–255; só autorizada (senão 409) |
| POST | `/api/webhooks/fiscal` | público + HMAC | `x-fiscal-timestamp` (±5 min) + `x-fiscal-signature: sha256=HMAC(ts.corpo)`; sem segredo → 403; idempotente |

**Vendas:** cancelar venda com nota pendente ou autorizada → 409 (cancele a
nota antes).

## Onboarding por perfil (Fase 4)

Regras: [`docs/akylla/ONBOARDING.md`](../akylla/ONBOARDING.md).

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/onboarding/presets` | sessão | perfis ativos em ordem (`slug`, `name`, `description`, `defaultModules`, `defaultFiscalEnabled`) |
| GET | `/api/onboarding/status` | sessão | `{segment, completed, completedAt}` |
| POST | `/api/onboarding/apply` | ADMIN | `{slug}` (`COMERCIO`, `SERVICOS`, `HIBRIDO`, `PERSONALIZADO`). Idempotente: módulos do perfil → ACTIVE, demais → DISABLED (Personalizado não altera). Retorna 200 com o status. Slug inválido → 400 |

## LGPD e dados da empresa (N3 · 9.x, Fase 7)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/lgpd/consent` | sessão | Registra aceite `{type, version, role?, clientId?}` (termos/privacidade) |
| GET | `/api/lgpd/consents` | sessão | Lista os aceites da empresa (`clientId` opcional) |
| GET | `/api/lgpd/clients/:id/data-export` | ADMIN | Todos os dados do cliente (portabilidade, art. 18) |
| DELETE | `/api/lgpd/clients/:id/anonymize` | ADMIN | Anonimiza o cliente (mantém vendas e histórico financeiro) |
| GET | `/api/company/export` | ADMIN | Exportação integral da empresa (portabilidade/encerramento) |
| GET | `/api/company` | sessão | **Fase 7:** dados da empresa `{id, name, slug, document, phone, address, segment, createdAt}` |
| PATCH | `/api/company` | ADMIN | `{name?, document?, phone?, address?}`; `document` é CPF (11) ou CNPJ (14), aceita máscara e grava só dígitos; `""`/`null` remove. Vazio → 400. Os dados saem no comprovante (`/api/auth/me` também os devolve) |
| PATCH | `/api/company/slug` | ADMIN | `{slug}` (3–60, minúsculas, números e hífens). Único entre todas as empresas: em uso → 409 (pelo índice único, já que a RLS esconde as outras empresas) |

## Busca global (Fase 7 · 7.3)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/search` | sessão | `?q=` (2–80). Até 5 resultados por tipo (clientes por nome/e-mail/telefone/CPF, produtos por nome/SKU/código de barras, vendas pelo código, OS por número/título, serviços), só da empresa da sessão e sem os tipos de módulos desligados. Resposta `{query, groups:[{kind, label, items:[{kind, id, title, subtitle, href}]}]}` |

## Documentação OpenAPI (Fase 6 · 6.3)

`GET /api/docs` (Swagger UI) e `GET /api/docs/openapi.json`, gerados do
código: rotas pelo Nest, corpos e filtros pelos schemas Zod das rotas,
sessão/ADMIN/módulo pelos decorators. Ligada fora de produção; em
produção só com `API_DOCS_ENABLED=true`. O teste
`tests/integration/contract.test.ts` falha se uma rota existir no código
e não nesta página (ou o contrário).

## Cobrança do SaaS e painel do dono (Fase 8)

**Regra de acesso** (`apps/api/src/billing/access.ts`):

| Situação | Quando | Efeito |
|---|---|---|
| `EXEMPT` | `Company.billingExempt`, ou sem assinatura e sem `trialEndsAt` (empresas criadas pelo bootstrap/CLI ou anteriores à Fase 8) | tudo liberado |
| `TRIAL` | antes de `trialEndsAt` (cadastro: `TRIAL_DAYS`, padrão 14) | tudo liberado, sem limites de plano |
| `ACTIVE` | período pago vigente (cancelada vale até o fim do período) | liberado, com os limites do plano |
| `GRACE` | até 5 dias depois do fim do teste/período | liberado, com aviso |
| `READ_ONLY` | depois da tolerância | `AccessGuard` (global): métodos de escrita → **402** `{code:"SUBSCRIPTION_READ_ONLY"}`; leitura liberada. Sempre liberados: `/api/auth/*`, `/api/billing/*`, `/api/platform/*`, `/api/company/export`, `/api/lgpd/*` e webhooks |
| `SUSPENDED` | suspensa pelo dono (`Company.status = INACTIVE`) | login bloqueado e sessões revogadas |

A empresa **não ativa nem renova o próprio plano** (as rotas
`PUT /api/billing/subscription` e `POST /api/billing/subscription/renew`
foram removidas): a assinatura nasce pelo dono da plataforma ou pelo
gateway (Mercado Pago). Nenhum dado é apagado em nenhuma situação.

**Painel do dono** (`PlatformGuard`): e-mail em `PLATFORM_ADMIN_EMAILS`,
papel ADMIN e, em produção, 2FA ativo; senão 403. Usa conexão de sistema
(atravessa a RLS de propósito) e registra quem fez cada ação.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/platform/companies` | dono | `?search=&status=`: empresas (até 200) com admin, último login, uso (usuários, clientes, produtos, vendas 30 dias), isenção, suspensão e `access` |
| POST | `/api/platform/companies` | dono | `{companyName, adminName, adminEmail, trialDays=14}` (0–90): cadastra a empresa e o admin (e-mail já verificado) e devolve `{company, temporaryPassword}` (senha provisória mostrada uma vez). E-mail já usado → 409 |
| GET | `/api/platform/companies/:id` | dono | uma empresa |
| GET | `/api/platform/companies/:id/payments` | dono | pagamentos registrados (imutáveis) |
| POST | `/api/platform/companies/:id/activate` | dono | `{planId, cycle: MONTHLY\|YEARLY, method: PIX\|BOLETO\|CARD\|MERCADO_PAGO\|OTHER, amount?, note?}`: registra o pagamento e ativa/renova (com trava da empresa: pagamentos simultâneos somam). Novo período começa no que vier por último entre agora, o fim do período pago e o fim do teste grátis; mensal = 1 mês de calendário, anual = 12 meses; valor padrão = preço do plano no ciclo. Kits (Fase 8b): `extraModules[]` opcionais; valor padrão = kit + avulsos (`computeComboPrice`: anual = kit anual + 10× cada avulso) |
| POST | `/api/platform/companies/:id/trial` | dono | `{days}` (1–90): estende o teste a partir de `max(agora, fim do teste)` |
| POST | `/api/platform/companies/:id/exempt` | dono | `{exempt}`: isenta ou remove a isenção |
| POST | `/api/platform/companies/:id/suspend` | dono | `{reason}`: suspende (login bloqueado, sessões revogadas) |
| POST | `/api/platform/companies/:id/reactivate` | dono | reativa a empresa suspensa (senão 400) |
| POST | `/api/platform/companies/:id/modules` | dono | Kits (Fase 8b): `{planId, extraModules[]}` troca o kit e os avulsos na hora, sem pagamento (sem assinatura: cria uma vencida, que vale após o pagamento). Avulsos já no kit são descartados |
| GET | `/api/platform/catalog` | dono | `{plans, modules}`: kits (preços, `includedModules`, limites, ordem) e preço de cada módulo avulso |
| PUT | `/api/platform/plans/:id` | dono | `{description?, priceMonthly, priceYearly\|null, includedModules[], userLimit, clientLimit, productLimit}` (limites `null` = ilimitado) |
| PUT | `/api/platform/modules/:module` | dono | `{description?, priceMonthly?, active?}`: preço/oferta de um módulo avulso |
| POST | `/api/platform/companies/:id/reset-password` | dono | senha provisória para o admin principal da empresa (`{email, temporaryPassword}`); derruba as sessões dele |

## Clientes e produtos digitais (transformação 2026-10-23)

Na interface, "Assinaturas" aparecem como **Contratos**. Rotas sem
`@RequireModule` (núcleo); `companyId` sempre da sessão.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/digital-products` | sessão | Catálogo; `search`, `type`, `status`, `page`, `pageSize`, `orderBy` (`name`/`defaultPrice`/`createdAt`) |
| POST | `/api/digital-products` | ADMIN | Cria (201): `name` único por empresa → 409, `type` (`SITE`, `PROFESSIONAL_PROFILE`, `SYSTEM`, `ONLINE_STORE`, `HOSTING`, `DOMAIN`, `MAINTENANCE`, `ADS_MANAGEMENT` — pacote de gestão de anúncios), `defaultPrice`, `billingPeriod` (`MONTHLY`/`YEARLY`), `description?` |
| GET | `/api/digital-products/:id` | sessão | Detalhe com `deliveriesCount` (404 cross-tenant) |
| PATCH | `/api/digital-products/:id` | ADMIN | Edição parcial |
| PATCH | `/api/digital-products/:id/status` | ADMIN | `ACTIVE`/`INACTIVE` |
| GET | `/api/deliveries` | sessão | Entregas; `search` (nome, domínio, URL, cliente), `clientId`, `type`, `status`, `billingState`, `orderBy`; cada item traz `billing` (situação de cobrança) |
| POST | `/api/deliveries` | sessão | Cria (201): `clientId`, `name`, `type`, `productId?`, `siteUrl?`, `adminUrl?`, `repositoryUrl?` (http/https), `domain?`, `domainRenewalAt?`/`hostingRenewalAt?` (AAAA-MM-DD), `hostingProvider?`, `notes?`, `status?`, `neverPause?` |
| GET | `/api/deliveries/:id` | sessão | Detalhe com `contractsCount` (404 cross-tenant) |
| PATCH | `/api/deliveries/:id` | sessão | Edição parcial; texto vazio limpa o campo; `neverPause` + `PAUSED` → 409 |
| GET | `/api/clients/:id/history` | sessão | Linha do tempo do cliente: cadastro, entregas, contratos (início/cancelamento), financeiro, agenda e OS |
| GET | `/api/deliveries/:id/checks` | sessão | Últimas 50 checagens do monitor do site (`ok`, `httpStatus`, `responseMs`, `error`) |
| GET | `/api/deliveries/:id/credentials` | sessão | Logins da entrega **sem senha** (`hasSecret`); `archived=true` inclui arquivados |
| POST | `/api/deliveries/:id/credentials` | ADMIN | Cria (201): `label`, `username?`, `secret?` (gravada cifrada AES-256-GCM), `url?`, `notes?` |
| PATCH | `/api/delivery-credentials/:id` | ADMIN | Edição parcial; `secret` ausente mantém, `""` apaga; arquivado → 409 |
| POST | `/api/delivery-credentials/:id/reveal` | ADMIN | `{secret}` em claro, `Cache-Control: no-store`; registra `REVEAL` na auditoria |
| POST | `/api/delivery-credentials/:id/archive` | ADMIN | Arquiva (não apaga); duplo → 409 |
| GET | `/api/delivery-credentials/:id/access-log` | ADMIN | Auditoria imutável: `CREATE`/`UPDATE`/`REVEAL`/`ARCHIVE`, quem e quando |
| GET | `/api/digital/overview` | sessão | Início: receita mensal recorrente, a receber em 30 dias, atrasados, vencimentos (contrato/domínio/hospedagem) em 30 dias e sites fora do ar |
| POST | `/api/deliveries/:id/pause` | ADMIN | Pausa o site até pagar (`{reason}` 3..500); "nunca pausar" → 409; já pausada → 409 |
| POST | `/api/deliveries/:id/activate` | ADMIN | Ativa (ou reativa, se inativa) — `{reason?}` |
| POST | `/api/deliveries/:id/deactivate` | ADMIN | Inativa: cliente desistiu (`{reason}`); "nunca pausar" → 409 |
| GET | `/api/deliveries/:id/billing-actions` | sessão | Histórico imutável das decisões (quem, quando, motivo) |
| GET | `/api/deliveries/:id/install-code` | ADMIN | `{publicKey, snippet}` do script de status (gera a chave na 1ª vez); "nunca pausar" → 409 |
| POST | `/api/subscriptions/:id/grace` | ADMIN | Prazo combinado `{until: AAAA-MM-DD, note}`; data no passado → 400 |
| GET | `/api/subscriptions/:id/billing-actions` | sessão | Histórico de decisões do contrato |
| GET | `/api/billing-settings` | sessão | Pausa automática (`autoPauseEnabled` padrão **false**, `autoPauseDays`) e textos efetivos |
| PUT | `/api/billing-settings` | ADMIN | Altera; texto `""` volta ao padrão |
| GET | `/api/public/site-status/:key` | **público** | Script do site do cliente: `{status: ativo\|aviso\|pausado\|inativo, message}`; sem dados pessoais, CORS `*`, cache 60 s, limite por IP; chave desconhecida → 404; "nunca pausar" → sempre `ativo` |
| GET | `/api/digital/reports` | sessão | `months` 1..24 (padrão 12): receita recorrente e recebido por mês, receita por produto do catálogo, inadimplência (taxa e maiores devedores) e clientes por status |
| GET | `/api/overdue-policy` | sessão | `{warnDays, pauseDays, autoPauseEnabled: false, pixKey}` (padrão 1 e 10) |
| PUT | `/api/overdue-policy` | ADMIN | `{warnDays 0..365, pauseDays 1..365, pixKey?}` (`pixKey` `""` apaga, ausente mantém); pausa ≤ aviso → 400. Nenhuma pausa automática |

- `neverPause`: produtos próprios e clientes estratégicos; a entrega
  não aceita o status `PAUSED` enquanto a flag estiver ligada.
- **Monitor de sites** (worker, a cada 5 min, `SITE_MONITOR_ENABLED`):
  só `HEAD` e, se o servidor recusar, `GET` com o corpo descartado —
  nunca `POST`, formulário, cookie ou credencial. Checa entregas `ACTIVE`
  com `siteUrl` e `monitorEnabled`; grava `monitorStatus`/`monitorDownSince`
  e o histórico `SiteCheck` (30 dias).
- **Cobrança automática dos contratos** (worker, de hora em hora): o
  contrato ativo/vencido de empresa ativa ganha o título a receber
  (`FinancialEntry` origem `SUBSCRIPTION`, `originId`
  `<contrato>:<inicio|renovacao>:<AAAA-MM-DD>`) do período seguinte quando
  faltam ≤ 30 dias para o fim (e o do 1º período, se não houve pagamento).
  Idempotente pelo unique `(companyId, origin, originId)`. **Pagar o título
  de renovação** (`POST /api/financial/:id/pay`) renova o contrato; renovar
  pelo caixa (`POST /api/subscriptions/:id/renew`) quita o título aberto.
  `GET /api/subscriptions/:id` traz `receivables`.
- **Lembretes de cobrança** (worker): WhatsApp com os modelos aprovados
  `cobranca_lembrete` (1 a 3 dias antes), `cobranca_vencimento` (no dia) e
  `cobranca_atraso` (do dia de aviso até antes do dia de pausa), 5
  variáveis: cliente, contrato, valor, vencimento, chave Pix. Uma vez por
  título e tipo (`idempotencyKey`), só com consentimento `OPTED_IN`,
  telefone válido e integração ativa; nunca para cliente com entrega
  "nunca pausar". Nada é pausado.
- **Logins**: chave `CREDENTIALS_ENCRYPTION_KEY` (ou, sem ela,
  `FISCAL_ENCRYPTION_KEY`); sem chave → 503 ao gravar senha.
- Script `npm run db:seed:akylla` (idempotente) cadastra o cliente
  "Akylla (próprio)" com as entregas do próprio Akylla e o cliente de
  teste "Akylla Studio (teste)", todas com `neverPause`. Opções
  `--desativar-demos` / `--reativar-demos` suspendem ou reativam as
  empresas `demo-*` (dados mantidos) e `--simular` só mostra o que faria.

## Gestão de anúncios — módulo ADS (2026-10-29, fases A1 e A2)

Plano em `upgrade/PLANO_ANUNCIOS.md`; guia de uso em
`docs/akylla/ANUNCIOS.md`. Todas as rotas exigem o módulo `ADS`
(`@RequireModule`): fora do plano → 403 `MODULE_NOT_CONTRACTED`;
desativado pela empresa → 403. A verba é paga pelo cliente direto à
plataforma: aqui só ficam referências, métricas e o histórico.
Indicadores sempre calculados no servidor (divisão por zero → `null`;
mesmo dia: API > CSV > MANUAL — `docs/akylla/DICIONARIO_INDICADORES.md`).

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/ads/overview` | sessão | `from`/`to` (AAAA-MM-DD; padrão mês atual): campanhas ativas, indicadores do período, `managementMonthly` (mensalidades ativas dos contratos de gestão — entrega `ADS_MANAGEMENT` ou ligados a campanha — por mês), `byClient`, `stale` (ativas sem métrica há 3+ dias) |
| GET | `/api/ads/accounts` | sessão | Contas de anúncio; `clientId`, `platform`, `status`. Token nunca sai |
| POST | `/api/ads/accounts` | ADMIN | Cria (201): `clientId`, `platform` (`META`/`GOOGLE`/`TIKTOK`/`OTHER`), `name`, `externalAccountId?`; repetido na mesma plataforma → 409; cliente de outra empresa → 404 |
| PATCH | `/api/ads/accounts/:id` | ADMIN | `name?`, `externalAccountId?`, `status?` (`ACTIVE`/`INACTIVE`) |
| GET | `/api/ads/campaigns` | sessão | Lista paginada; `search`, `clientId`, `status`, `platform`; cada item traz `indicators` e `lastMetricDate` |
| POST | `/api/ads/campaigns` | ADMIN | Cria (201): `clientId`, `platform`, `objective`, `name`, `promotedItem?` (vazio → nome da entrega), `deliveryId?`, `adAccountId?` (mesmo cliente e plataforma), `subscriptionId?`, `targetUrl?` (vazio → site da entrega), `audienceNotes?`, `dailyBudget?`/`totalBudget?`, `startAt?`/`endAt?`, `notes?`. `utmCampaign` é **gerado** (slug único por empresa) e nunca aceito do cliente |
| GET | `/api/ads/campaigns/:id` | sessão | Detalhe: `indicators`, `metrics` (linha efetiva por dia + `overridden`), `logs` (100 últimos), `allowedStatuses` (404 cross-tenant) |
| PATCH | `/api/ads/campaigns/:id` | ADMIN | Edição parcial (cliente e plataforma fixos); registra `UPDATE` |
| POST | `/api/ads/campaigns/:id/status` | ADMIN | `{status, reason?}`: transições válidas (finalizada não volta); pausar/finalizar exigem motivo (3+) → registra `STATUS` |
| PUT | `/api/ads/campaigns/:id/metrics/:date` | ADMIN | Lança a métrica `MANUAL` do dia (`impressions`, `reach`, `clicks`, `spend`, `results`); repetir o dia corrige e registra `METRIC_FIX` com antes/depois; dia futuro → 400 |
| POST | `/api/ads/campaigns/:id/metrics/import` | ADMIN | Multipart `file` (.csv ≤ 5 MB), `dryRun` (padrão `true` = prévia), `campaignName?`: CSV do Gerenciador de Anúncios da Meta ou do Google Ads (pt-BR/en, vírgula decimal, UTF-8/UTF-16). Grava `source=CSV` por dia (substitui o CSV do mesmo dia) e registra `CSV_IMPORT` |
| GET | `/api/ads/campaigns/:id/link` | sessão | `url?` (padrão `targetUrl`): `{url, utmSource, utmMedium: "cpc", utmCampaign}`; mantém os parâmetros do site |
| GET | `/api/clients/:id/ads` | sessão | Aba Anúncios da ficha: `indicators`, `campaigns`, `accounts` (404 cross-tenant) |

- `AdCampaignLog` é imutável: não há rota de alteração e um trigger no
  banco recusa `UPDATE`.
- Precedência por dia: a linha `API` (fase A5) vence `CSV`, que vence
  `MANUAL`; as outras continuam gravadas e aparecem em `overridden`.

## Padrão para módulos futuros

1. Modelo sempre com `companyId` + FK `Restrict` e índices por empresa.
2. `findFirst({ where: { id, companyId: auth.companyId } })` em toda
   leitura/escrita individual; 404 quando não encontrar.
3. Guards: leitura com sessão; escrita sensível com `AdminGuard`.
4. Nunca aceitar saldo/valores críticos enviados pelo cliente como fonte
   de verdade.
