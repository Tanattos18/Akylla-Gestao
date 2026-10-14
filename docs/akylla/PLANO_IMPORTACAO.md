# Akylla Gestão — Importação de planilhas (CSV)

**Data:** 13/10/2026
**Natureza:** nova funcionalidade fora do roteiro 0–12, autorizada pelo
proprietário ("aceitar importação de planilhas para alimentar os dados
da empresa").
**Status: AGUARDANDO APROVAÇÃO** — decisões D1–D4 já aprovadas pelo
proprietário; decisões técnicas D5–D8 descritas neste documento
aguardam confirmação antes de qualquer migration ou código.

---

## 1. Decisões aprovadas (D1–D4)

| # | Decisão | Escolha |
|---|---|---|
| D1 | Entidades importáveis | **Todas**: categorias, fornecedores, produtos (+ estoque inicial), clientes e serviços |
| D2 | Formato | **CSV apenas** (sem lib Excel; exportações do sistema já são CSV; Excel salva como CSV) |
| D3 | Duplicatas (mesmo SKU/nome/email na empresa) | **Pular com aviso** — registro existente é mantido; linha reportada como "ignorada — já existe"; reimportações seguras |
| D4 | Auditoria | **Tabela `ImportBatch`** (migration aditiva) — histórico por empresa: tipo, arquivo, contagens, resultado |

## 2. Decisões técnicas propostas (D5–D8 — aguardam aprovação)

| # | Decisão | Proposta | Justificativa |
|---|---|---|---|
| D5 | Preview antes de gravar | **`dryRun=true` opcional** no upload — valida todas as linhas e retorna o mesmo relatório do import real, sem gravar nada e sem criar `ImportBatch` | Importação em massa sem preview força o usuário a "testar" no banco de produção |
| D6 | Dependência de parse | **`csv-parse`** (pure JS, madura, usada mundialmente) + **`multer`/`@types/multer`** declarados explicitamente no `apps/api` (hoje só transitivos via `@nestjs/platform-express`) | Parser CSV correto com aspas, CRLF e vírgula dentro de campo não se improvisa; `csv-parse` ~1 dependência pequena e sem binários |
| D7 | Referências por nome | Produtos referenciam categoria/fornecedor **pelo nome** na planilha (resolvido por `nameKey` na empresa); **não encontrado → linha rejeitada com erro**, sem auto-criação | Auto-criar esconderia typos ("Higiene" vs "Higienn"); usuário importa categorias/fornecedores primeiro (fluxo guiado na UI) |
| D8 | Limites do plano SaaS | Checagem **uma única vez antes do lote**: `count` atual do recurso + nº de linhas novas válidas > limite da assinatura `ACTIVE` → **403** com nome do plano (mesma mensagem do `TenantLimitsService`); sem assinatura — nenhum limite (regra D3 da Etapa 11 preservada) | Chamar `assertCanCreate` por linha faria N+1 queries; checagem em lote é barata e coerente |

## 3. Modelo (migration aditiva)

```prisma
enum ImportType {
  CATEGORY
  SUPPLIER
  PRODUCT
  CLIENT
  SERVICE
}

enum ImportStatus {
  COMPLETED
  FAILED
}

model ImportBatch {
  id            String       @id @default(cuid())
  companyId     String
  company       Company      @relation(fields: [companyId], references: [id], onDelete: Restrict)
  type          ImportType
  status        ImportStatus @default(COMPLETED)
  filename      String
  createdCount  Int          @default(0)
  skippedCount  Int          @default(0)
  errorCount    Int          @default(0)
  errors        Json?        // amostra: [{ row, message }] até 100 entradas
  createdByUserId String
  createdBy     User         @relation(fields: [createdByUserId], references: [id], onDelete: Restrict)
  createdAt     DateTime     @default(now())

  @@index([companyId, createdAt])
}
```

- Adições aditivas: `importBatches` em `Company` e `User`.
- `dryRun` **não** persiste linha em `ImportBatch` (só retorna o relatório).
- `errors` guarda amostra (máx. 100 itens) para não estourar a coluna;
  `errorCount` guarda o total real.
- Falha inesperada no meio do lote → transação `prisma.$transaction`
  revertida, batch gravado com `status=FAILED` (fora da transação, para
  sobreviver ao rollback).

## 4. API

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/imports/template?type=PRODUCT` | ADMIN | Devolve CSV modelo (cabeçalho + 2 linhas de exemplo) para o tipo |
| POST | `/api/imports` | ADMIN | `multipart/form-data`: campo `type`, campo `dryRun` (`"true"`/`"false"`, padrão false) e arquivo `file` (`.csv`, máx. 5 MB / 5000 linhas) → relatório JSON |
| GET | `/api/imports` | ADMIN | Histórico paginado de `ImportBatch` da empresa |

- **`POST /api/imports` — resposta**:

```json
{
  "dryRun": false,
  "batchId": "clx...",            // null quando dryRun
  "type": "PRODUCT",
  "totalRows": 120,
  "created": 95,
  "skipped": 20,
  "errors": 5,
  "errorDetails": [               // até 100
    { "row": 7, "message": "Linha 7: categoria \"Higiene\" não encontrada" }
  ]
}
```

- Erros: 400 (CSV sem cabeçalho esperado, tipo inválido, arquivo
  ausente/estoura limite), 403 (MEMBER ou limite de plano atingido),
  413 (arquivo > 5 MB via limite do multer).
- Parser: UTF-8 (aceita **BOM**); delimitador detectado entre `,` e `;`
  (Excel pt-BR salva com `;`) pela primeira linha; aspas com escape
  conforme RFC 4180 via `csv-parse`.
- Todos os registros criados usam `companyId` da sessão (`@Auth()`).

## 5. Formatos CSV por tipo

Regras comuns: primeira linha = cabeçalho exato (case-insensitive);
colunas extras são ignoradas; célula vazia = campo omitido; **linha em
branco é pulada**.

### CATEGORY

| Coluna | Obrigatória | Regra |
|---|---|---|
| `nome` | ✅ | `nameField`; duplicado (nameKey) → skip |
| `descricao` | | máx. 500 |

### SUPPLIER

| Coluna | Obrigatória | Regra |
|---|---|---|
| `nome` | ✅ | duplicado por nome (case-insensitive) → skip |
| `documento` | | máx. 20 |
| `email` | | validado por `emailFieldSchema` |
| `telefone` | | máx. 30 |
| `observacoes` | | máx. 500 |

### PRODUCT

| Coluna | Obrigatória | Regra |
|---|---|---|
| `nome` | ✅ | |
| `sku` | | uppercase; SKU já existente **ou** linha anterior com mesmo SKU → skip da linha |
| `codigo_barras` | | normalizado; igualdade por unicidade `(companyId, barcode)` |
| `unidade` | | enum `UNIDADE\|KG\|G\|L\|ML\|CAIXA\|PACOTE\|ROLLO`; vazio → `UNIDADE`; inválida → erro |
| `preco_custo` / `preco_venda` | | decimal BR aceito (`1.234,56` e `1234.56`); vazio → 0 |
| `estoque_minimo` | | decimal; vazio → 0 |
| `saldo_inicial` | | decimal ≥ 0; **> 0 gera `StockMovement IN`** após o create (notes: "Estoque inicial (importação)", reference: nome do arquivo) — saldo nunca vem do cliente direto, sempre vira movimento auditável |
| `categoria` | | nome resolvido na empresa (D7); não achado → erro da linha |
| `fornecedor` | | idem |

### CLIENT

| Coluna | Obrigatória | Regra |
|---|---|---|
| `nome` | ✅ | duplicado (nameKey) → skip |
| `telefone` / `celular` | | `phoneField` |
| `email` | | validado |
| `cpf` | | 11 dígitos (mesma regra atual) |
| `endereco`, `numero`, `complemento`, `bairro`, `cidade`, `estado`, `cep` | | campos de endereço |
| `observacoes` | | máx. 500 |

### SERVICE

| Coluna | Obrigatória | Regra |
|---|---|---|
| `nome` | ✅ | duplicado (nameKey) → skip |
| `descricao` | | máx. 1000 |
| `duracao_minutos` | | 1..1440 inteiro |
| `preco` | ✅ | decimal BR; > 0 |

### Ordem de importação sugerida (na UI)

1. Categorias → 2. Fornecedores → 3. Produtos → 4. Clientes →
5. Serviços. (A API aceita qualquer ordem; a UI orienta a sequência
para que `categoria`/`fornecedor` já existam.)

## 6. Regras de negócio

- **ADMIN apenas** em todas as rotas (`AdminGuard` por método, padrão
  do projeto); MEMBER → 403.
- **Uma transação por lote**: linhas válidas são criadas atomicamente;
  erro inesperado → rollback total + `ImportBatch FAILED`.
- **Linhas com erro não abortam o lote** (padrão "pular com aviso"):
  são contadas em `errorCount` e reportadas; linhas válidas seguem.
- **Skip determinístico**: unicidade checada contra o banco **e** contra
  linhas já processadas no mesmo lote (planilhas com SKU repetido
  interno).
- Validação por linha reusa os schemas Zod de `@petflow/shared`
  (`createCategorySchema`, `createSupplierSchema`, `createProductSchema`
  sem `categoryId/supplierId` — resolvidos por nome —, `createClientSchema`,
  `createServiceSchema`) com mensagens prefixadas por número da linha.
- **Limites de plano (D8)**: 1 checagem pré-lote; produtos e clientes
  são os recursos limitados (`productLimit`, `clientLimit`).
- **Segurança**: arquivo > 5 MB → 413; > 5000 linhas → 400; conteúdo
  lido como texto (nunca executado); CSVs de exportação do sistema já
  escapam fórmulas — o import não tem risco equivalente (não reexporta
  células do arquivo cru).

## 7. UI

- **Página nova `/importacoes`** (link na navegação, visível para
  ADMIN):
  1. Seletor de tipo + link "Baixar modelo CSV";
  2. Upload (`<input type="file" accept=".csv,text/csv">`) + checkbox
     "Simular (não gravar)";
  3. Resultado: barras criados/ignorados/erros + tabela de
     `errorDetails` com número da linha;
  4. Histórico de importações (`GET /api/imports`, paginado).
- Ordem de importação orientada na própria página (passo a passo 1–5).
- Botões "Importar CSV" dentro de `/produtos` e `/clientes` ficam para
  etapa futura (a página central atende o fluxo completo).

## 8. Testes (`tests/integration/imports.test.ts`)

1. MEMBER no `POST /api/imports` → 403; no `GET` → 403.
2. Upload sem arquivo / tipo inválido / cabeçalho errado → 400.
3. Categorias: happy path (cria N), duplicata no lote e no banco →
   skip, relatório coerente.
4. Produtos: cria com categoria/fornecedor por nome; `categoria`
   inexistente → erro da linha e as demais criadas; `saldo_inicial` > 0
   → `StockMovement IN` com produto e saldo final correto.
5. SKU duplicado interno no CSV → segunda linha skipada.
6. Clientes: decimal/CPF/validações Zod por linha; nameKey duplicado →
   skip.
7. `dryRun=true` → relatório retorna contagens mas **nenhum** registro
   criado e nenhum `ImportBatch`.
8. Reimportar o mesmo arquivo → `created=0`, `skipped=N` (idempotência
   do skip).
9. Limite de plano: assinatura `ACTIVE` com `productLimit` no limite →
   403; sem assinatura → cria normalmente.
10. CSV com BOM e delimitador `;` → processa igual.
11. Tenancy: registros e histórico isolados por empresa (A×B).
12. Histórico: `GET /api/imports` paginado, só da empresa.
13. Arquivo > 5001 linhas → 400.

## 9. Dependências novas (justificativa)

| Pacote | Onde | Justificativa |
|---|---|---|
| `csv-parse` | `apps/api` | Parse RFC 4180 (aspas, CRLF, delimitador detectável) — parser manual introduziria bugs |
| `multer` + `@types/multer` | `apps/api` | FileInterceptor exige multer; hoje só transitivo — declarar explicitamente (regra 5 do AGENTS.md) |

## 10. Riscos e rollback

- **Migration aditiva** (nova tabela + enums; sem alterar tabela
  existente) — risco baixo; rollback = drop da tabela (nenhum dado de
  negócio depende dela).
- Lote grande (5000 linhas × create individual) em transação única
  pode demorar ~segundos; aceitável para implantação; fila assíncrona
  fica para etapa futura se necessário.
- `errors Json` limitado a 100 amostras por lote (documentado na UI).
- Se aprovado sem D5 (sem dryRun), o risco de "teste no banco real"
  aumenta — não recomendado.

## 11. Checklist de execução (após aprovação)

- [ ] Migration `20261013_import_batch` (aplicar em `petflow` e
      `petflow_test` após aprovação)
- [ ] Schemas Zod + tipos em `@petflow/shared` (relatório, query de
      histórico, enums)
- [ ] Módulo `apps/api/src/imports` (controller/service/module,
      `@Inject()` explícito, `AdminGuard`, `TenantLimits` em lote)
- [ ] UI `/importacoes` + navegação + `lib/types.ts`
- [ ] `tests/integration/imports.test.ts` (+13 cenários)
- [ ] `resetDatabase` apaga `importBatch` antes de `user`
- [ ] Docs: `DATABASE.md`, `API.md`, `CHANGELOG.md`,
      `PROJECT_STATUS.md`, `IMPLEMENTATION_CHECKLIST.md`
- [ ] Validações: `lint` → `typecheck` → `test` → `build` →
      `db:validate`
