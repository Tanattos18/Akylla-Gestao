# database/

Esquema de banco do **Akylla Gestão** usando **Prisma**.

## Layout

- `prisma/schema.prisma` — fonte única do schema (models, enums, índices).
- `prisma/migrations/` — migrations gerenciadas pelo Prisma (12 pastas;
  última: `tenant_plan_limits`).
- `seeds/` — reservado; **não há seed SQL**. Dados de demonstração e
  bootstrap de admin são CLIs da API:
  - `npm run bootstrap:admin` — cria admin inicial (credenciais via
    `BOOTSTRAP_*`, idempotente).
  - `npm run db:seed:demo` — dados de demonstração da empresa piloto.

## Comandos (raiz do monorepo)

```bash
npm run db:validate    # valida o schema
npm run db:generate    # gera o client Prisma
npm run db:migrate     # cria/aplica migrations (requer PostgreSQL)
```

O schema fica em `database/prisma/` (não na raiz); todos os scripts
usam `--schema database/prisma/schema.prisma`.

## Documentação

Modelo completo, diretrizes de migration e regras por tenant:
[`docs/architecture/DATABASE.md`](../docs/architecture/DATABASE.md).
