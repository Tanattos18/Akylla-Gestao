# ADR-0001 — Defesa de tenant: guard ORM + RLS nativa do PostgreSQL

> **Atualização 2026-10-18 (Fase 1 · 1E): a RLS nativa foi implementada.**
> Ver a seção "Implementação da RLS" no fim. As seções abaixo registram a
> decisão original (2026-10-15).

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


## Implementação da RLS (2026-10-18, Fase 1 · 1E)

Os três bloqueios do contexto original foram resolvidos assim:

1. **Role dono das tabelas:** `FORCE ROW LEVEL SECURITY` faz a política
   valer também para o dono. O role da aplicação (`logistica` em dev) não
   é superusuário nem tem `BYPASSRLS`, verificado em teste. Não foi
   preciso trocar credenciais nem ownership.
2. **Fluxos públicos e de sistema:** a política aceita
   `app.rls_bypass = 'on'`. A API liga o bypass só quando não há
   contexto de tenant (rotas `@Public`, login, webhooks, CLI). Worker,
   scripts de CLI e backup abrem conexão de sistema (`systemDatabaseUrl`:
   `options=-c app.rls_bypass=on`). Em rota autenticada, a API define
   `app.company_id` e desliga o bypass.
3. **Conexão por request:** padrão do exemplo oficial do Prisma
   (`prisma-client-extensions/row-level-security`, Apache-2.0). Cada
   consulta fora de transação roda em `[set_config(...), consulta]` numa
   transação em lote. `$transaction` (interativa e em lote) define o
   contexto no primeiro statement. Consultas já dentro de transação não
   são re-embrulhadas (`__internalParams.transaction`), e a atomicidade é
   coberta por teste.

**Política** (25 tabelas: as 24 com `companyId` e mais `Company` por `id`):

```sql
USING (current_setting('app.rls_bypass', true) = 'on'
       OR "companyId" = current_setting('app.company_id', true))
WITH CHECK (mesma condição)
```

Sem nenhuma configuração, a conexão não vê nem grava nada (fail-closed).
O `set_config(..., true)` é local à transação, então não vaza entre
requisições do pool.

**Limites conhecidos:**

- O bypass é uma configuração de sessão: quem tem acesso SQL direto ao
  role pode ligá-lo. A RLS protege contra **bugs da aplicação** (consulta
  sem filtro, SQL bruto esquecido), não contra credencial vazada. Contra
  isso valem segredos fora do Git e role sem privilégio de DDL em
  produção.
- Tabelas sem `companyId` (`SaleItem`, `Session`, `WhatsAppMessageAttempt`,
  tokens) não têm política própria. Ficam protegidas pelo pai (FK) e
  pelas regras da aplicação.
- `__internalParams` não é API pública do Prisma: ao atualizar o Prisma,
  rode `tests/integration/rls.test.ts`, que testa a atomicidade.

**Custo medido:** a suíte completa (614 testes) levou 30,0 s com RLS
contra 31,9 s antes, sem regressão perceptível.

**Regras permanentes (AGENTS.md):** toda tabela nova com `companyId`
entra na política na própria migration. Migration com DML começa com
`SET LOCAL app.rls_bypass = 'on';`.

**Verificação:** `tests/integration/rls.test.ts` (16): políticas e FORCE
nas 25 tabelas, role sem bypass, conexão crua vê 0 linhas, WITH CHECK
contra outra empresa, contexto local à transação, conexão de sistema,
SQL bruto da aplicação confinado à empresa, `Company` própria, transação
interativa e em lote, caminho HTTP via `TenantContextInterceptor` e
atomicidade (rollback interativo e falha em lote). A suíte inteira roda
com a RLS ativa.
