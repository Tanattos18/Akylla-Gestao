# ADR-0001 — Defesa de tenant: guard ORM agora, RLS nativa como pré-requisito de produção

**Data:** 2026-10-15 · **Escopo:** N4 · 1.4 (compilado de melhorias)
**Status:** aceito (decisão do proprietário: "implementar com testes")

## Contexto

O isolamento multiempresa hoje depende **inteiramente** de cada serviço
lembrar de filtrar por `companyId` (regra permanente do `AGENTS.md`).
A suíte tem 569 testes cobrindo isso, mas **um único `findMany` novo e
esquecido é um vazamento silencioso** — exatamente o risco da L3.

A RLS nativa do Postgres é a defesa em profundidade ideal, mas **não é
aplicável hoje nesta stack sem um projeto dedicado**, por três razões
medidas no código:

1. **Role única e dona das tabelas** — `DATABASE_URL` usa um role que é
   owner; sem `FORCE ROW LEVEL SECURITY` + role de runtime **não-owner**,
   as policies são inertes. Trocar de role exige mudança de credenciais,
   ownership de ~25 tabelas e revisão de migrations (que rodam com o role
   administrativo).
2. **Consulta sem tenant é legítima em fluxos públicos** — login
   (`Session` por `tokenHash`, `User` por e-mail), `Company` por `slug`,
   webhook WhatsApp (por `wamid`/telefone), webhook Mercado Pago (por
   `gatewaySubscriptionId`). Uma RLS estrita quebra esses fluxos; cada um
   precisaria de política dedicada ou bypass revisado.
3. **Prisma não fixa conexão por request** — `SET LOCAL app.company_id`
   só é confiável dentro de transação interativa; envolver **toda**
   consulta em transação (extensão global) tem custo de pool/latência e
   precisa de ensaio de carga antes de adoção.

## Decisão

1. **Camada ORM (implementada nesta entrega):** extensão Prisma
   (`tenant-guard.extension.ts`) + contexto por request
   (`AsyncLocalStorage`, preenchido pelo `TenantContextInterceptor`
   após o `AuthGuard`):
   - Filtros (`findMany/findFirst/count/aggregate/groupBy/updateMany/
     deleteMany`) em modelos com `companyId` **recebem `AND: [{ companyId }]`**
     quando o `where` não traz o campo — o "findMany esquecido" passa a
     devolver só dados da própria empresa.
   - `companyId` literal **divergente** em `where`/`data` responde **403**.
   - Rotas `@Public`, CLI e seeds **não têm contexto** e o guard é
     transparente (**fail-open**, documentado): a fonte de verdade do
     isolamento continua sendo o `companyId` derivado da sessão em cada
     serviço + `AuthGuard`/`AdminGuard`/`ModuleGuard`.
2. **RLS nativa (pendência formal para produção multi-instância):** o
   draft completo está na seção seguinte. Requisitos para executar:
   role de runtime não-owner, revisão dos fluxos públicos listados,
   ensaio da suíte inteira + teste de carga. **Não aplicar sem janela
   dedicada e aprovação do proprietário.**

## Draft da migration RLS (NÃO aplicada — referência)

```sql
-- Pré-requisito 1: role de runtime sem BYPASSRLS e não-owner das tabelas.
-- Pré-requisito 2: aplicação seta, por transação interativa,
--   SELECT set_config('app.company_id', '<id>', true);
-- Pré-requisito 3: políticas dedicadas para os fluxos públicos
--   (Session/User por login, Company por slug, webhooks) ou bypass
--   via role distinto apenas nessas rotas.

-- Exemplo por tabela (repetir para as ~22 tabelas com companyId):
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_client ON "Client"
  USING ("companyId" = current_setting('app.company_id', true))
  WITH CHECK ("companyId" = current_setting('app.company_id', true));
```

> Com `current_setting(..., true)` retornando NULL (contexto ausente), a
> comparação é NULL → **nenhuma linha visível**. Por isso os fluxos
> públicos precisam ser resolvidos ANTES da aplicação.

## Consequências

- **Ganho imediato:** qualquer consulta futura esquecida de filtrar por
  `companyId`, em rota autenticada, fica confinada à empresa da sessão.
- **Custo:** uma comparação a mais por consulta em memória (sem query SQL
  adicional — a injeção é no `where` já enviado).
- **Risco residual registrado:** fail-open sem contexto é intencional
  (webhooks/CLI); camada de banco continua sem RLS até o projeto dedicado.

## Verificação

- `tests/integration/tenant-guard.test.ts` — injeção, bloqueio de
  mismatch (leitura e escrita) e transparência sem contexto.
- Suíte inteira verde (569 testes pré-existentes comprovam que nenhum
  fluxo legítimo regrediu).
