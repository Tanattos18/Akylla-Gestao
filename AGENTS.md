# Instruções para agentes de desenvolvimento — Akylla Gestão

Este repositório contém: (1) o monorepo do **Akylla Gestão** (produto em
desenvolvimento) e (2) a pasta `automação do whatsapp/`, base histórica que
deve ser preservada e não confundida com o código do monorepo.

## Regras obrigatórias

1. **Inspecionar antes de agir**: ler `docs/operations/PROJECT_STATUS.md` e
   `docs/operations/IMPLEMENTATION_CHECKLIST.md` para saber a etapa atual.
2. **Escopo da etapa**: implementar apenas o que a etapa vigente autoriza.
   Nunca avançar para módulos de negócio ou etapas futuras sem autorização
   explícita do proprietário.
3. **Preservar arquivos existentes**: não sobrescrever, apagar ou mover arquivos
   sem antes verificar a finalidade. Preservar o histórico do CHANGELOG.
4. **Não duplicar projetos**: não criar outro projeto dentro do monorepo; usar
   os workspaces existentes (`apps/*`, `packages/*`).
5. **Dependências mínimas**: só instalar bibliotecas justificadas; registrar a
   justificativa no relatório/CHANGELOG quando relevante.
6. **Sem segredos**: nunca gravar senhas, tokens ou credenciais reais em
   código, Git ou documentação. Somente variáveis de ambiente via `.env`
   (não versionado) e `.env.example` com exemplos — **`.env.example` é o
   único template** (não criar `.env.*` alternativos; o `.gitignore`
   cobre `.env.*` e excepciona apenas `!.env.example`).
7. **Tipagem forte**: TypeScript estrito; erros tratados explicitamente.
8. **Banco de dados**: qualquer mudança de schema exige migration em
   `database/prisma/migrations/` e atualização de `docs/architecture/DATABASE.md`
   quando as diretrizes mudarem.
9. **Testes**: rodar `npm run validate` (ou, individualmente,
   `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e
   `npm run db:validate`) antes de concluir qualquer tarefa; não marcar
   verificação como concluída sem evidência. Testes ficam em
   `tests/integration/` e a infraestrutura em `tests/helpers/` — não
   misturar com o código de `apps/`.
10. **Documentação**: atualizar `docs/operations/CHANGELOG.md`,
    `docs/operations/PROJECT_STATUS.md` e
    `docs/operations/IMPLEMENTATION_CHECKLIST.md` ao final de cada etapa
    concluída.
11. **Commits**: somente quando solicitado pelo proprietário; mensagem objetiva
    no padrão do repositório.
12. **Pasta `automação do whatsapp/`**: não modificar sem instrução; não é
    parte do monorepo Akylla Gestão (excluída do lint e do build).

## Padrões permanentes

- **Identificadores técnicos legados** (compatibilidade — não são a
  marca do produto): pacotes `@petflow/*`, cookie `petflow_session`,
  bancos `petflow`/`petflow_test`, `service: "petflow-api"` e prefixo
  de comprovante `PF-`. Não renomear sem etapa dedicada com plano de
  migração.

- **`@Inject()` explícito** nos construtores de providers com injeção de
  dependência na API: o runtime de dev `tsx` (esbuild) não emite
  `emitDecoratorMetadata`, e sem ele o Nest resolve `undefined`. Ex.:
  `constructor(@Inject(PrismaService) private readonly prisma: PrismaService)`.
- Prefixo global da API: `/api` (exceto `/health`); o Next faz proxy por
  rewrites (`/api/:path*` → `localhost:3001`).
- Autenticação: cookie `HttpOnly` (`petflow_session`) com token cujo hash
  SHA-256 fica em `Session`; nunca JWT nem `localStorage`.
- Escopo de tenant: `companyId` sempre do contexto autenticado
  (`request.user.companyId`), nunca do cliente; proteger novas rotas com
  `AuthGuard` global + `@Public()` apenas onde for realmente público.
- Módulos de negócio: novos modelos com `companyId` +
  FK `Restrict` + índices por empresa; leitura individual via
  `findFirst({ id, companyId })` → 404; saldo/valores críticos sempre
  calculados no servidor (nunca aceitar do cliente); histórico de
  movimentações imutável (correção = movimento compensatório). Padrão
  completo em `docs/architecture/API.md`.

## Comandos de verificação

```bash
npm run validate      # roda as 5 verificações abaixo em sequência
npm run lint
npm run typecheck
npm test
npm run build
npm run db:validate   # requer DATABASE_URL definida
```

Configurações de lint/teste ficam em `config/`; utilitários locais em
`scripts/` (`npm run setup:dev`, `npm run db`).

## Ao final de cada tarefa

- Relatar: o que foi criado, o que foi alterado, o que foi preservado, testes
  executados e pendências.
- Parar e aguardar autorização antes da próxima etapa.
