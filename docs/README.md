# Documentação — Akylla Gestão

**Papel deste arquivo:** índice técnico de toda a documentação do
projeto. A apresentação de produto (para quem chega no repositório)
está no [`../README.md`](../README.md).

Para começar, leia nesta ordem:

1. [`../README.md`](../README.md) — visão de produto e como executar
2. [Documento técnico completo](AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md) — mapa único do sistema
3. [Status do projeto](operations/PROJECT_STATUS.md) — onde estamos hoje

---

## Estado atual do produto

| Documento | Conteúdo |
|---|---|
| [Documento técnico completo](AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md) | 23 seções: stack, módulos, DB, auth, frontend, testes, segurança, pendências |
| [Status do projeto](operations/PROJECT_STATUS.md) | etapa vigente, entregas, pendências (fonte única das contagens correntes) |
| [Checklist de implementação](operations/IMPLEMENTATION_CHECKLIST.md) | progresso etapa a etapa |
| [Changelog](operations/CHANGELOG.md) | histórico completo de alterações |

## Produto (sempre atual)

| Documento | Conteúdo |
|---|---|
| [Diretrizes do produto](AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md) | posicionamento, tom, o que anunciar/não anunciar |
| [PDV](akylla/PDV.md) | fluxo de venda, API, regras, comprovante, limitações |
| [Limitações de vendas](akylla/LIMITACOES_VENDAS.md) | fluxo PDV validado e o que não fazemos |
| [Dicionário de indicadores](akylla/DICIONARIO_INDICADORES.md) | definição exata de cada número do dashboard |

## Arquitetura e dados

| Documento | Conteúdo |
|---|---|
| [Arquitetura](architecture/ARCHITECTURE.md) | tecnologias e decisões registradas |
| [API](architecture/API.md) | endpoints, permissões, payloads, convenções |
| [Banco de dados](architecture/DATABASE.md) | modelo, migrations, diretrizes |

## Operação e qualidade

| Documento | Conteúdo |
|---|---|
| [Desenvolvimento](operations/DEVELOPMENT.md) | ambiente e execução local |

## Entregáveis de etapa

> Registros de entrega por etapa. Descrevem o sistema **na data da
> entrega** e trazem banner quando já foram superados. Quando
> conflitarem com os documentos acima, valem os de estado atual.

| Documento | Etapa |
|---|---|
| [Diagnóstico inicial](akylla/DIAGNOSTICO_INICIAL.md) | 0 — linha de base |
| [Plano de adaptação](akylla/PLANO_DE_ADAPTACAO.md) | 1 — etapas, riscos, aceitação |
| [Identidade e navegação](akylla/IDENTIDADE_E_NAVEGACAO.md) | 2 — marca, textos e navegação |
| [Auditoria multiempresa](akylla/AUDITORIA_MULTIEMPRESA.md) | 3 — isolamento A×B |
| [Mapa de módulos](akylla/MAPA_DE_MODULOS.md) | 4 — classificação núcleo/opcional/nicho |
| [Modelo financeiro](akylla/MODELO_FINANCEIRO.md) | 8 — caixa e contas a pagar/receber (AP/AR) |
| [Redesign do painel](akylla/REDESIGN_PAINEL.md) | design tokens + layout topbar B |
| [Plano de modularização](akylla/PLANO_MODULARIZACAO.md) | 10 — destinos dos módulos de nicho |
| [Plano de billing](akylla/PLANO_BILLING.md) | 11 — planos, limites por tenant, Mercado Pago |
| [Checklist pré-produção](akylla/CHECKLIST_PRE_PRODUCAO.md) | 12 — evidências e limitações L1–L14 |
| [Plano de importação](akylla/PLANO_IMPORTACAO.md) | pós-12 — importação de CSVs (D1–D8) |
| [Passo a passo OpenCode](PASSO_A_PASSO_OPENCODE_AKYLLA.md) | roteiro Etapas 0–12 (13 etapas) |

## Requisitos

| Documento | Conteúdo |
|---|---|
| [PRD](requirements/PRD.md) | requisitos do Akylla Gestão (produto, escopo, não funcionais) |

---

## Convenções

- **Idioma:** português do Brasil.
- **Estado:** documentos de etapa usam data; documentos de estado
  atual são reescritos quando o sistema muda (ver CHANGELOG).
- **Nomenclatura:** `docs/akylla/` = produto/entregáveis de etapa ·
  `docs/architecture/` = técnica · `docs/operations/` = processo ·
  `docs/requirements/` = requisitos do produto.
- **Agentes:** regras em [`../AGENTS.md`](../AGENTS.md).
- **READMEs do repo:** este arquivo é o índice de documentação; o
  `README.md` da raiz é a vitrine do produto; `database/README.md`
  resume o layout Prisma. Não criar novos README sem necessidade.
