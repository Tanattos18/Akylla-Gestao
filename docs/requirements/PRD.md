# PRD — Akylla Gestão

> **Documento de requisitos do produto.** Derivado das diretrizes
> (`docs/AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md`), do mapa de módulos
> aprovado (`docs/akylla/MAPA_DE_MODULOS.md`) e do documento técnico
> completo (`docs/AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md`).
> Status: roteiro de construção (Etapas 0–12) concluído — ver
> `docs/operations/PROJECT_STATUS.md`.

## 1. Visão geral

O **Akylla Gestão** é um SaaS web multiempresa de gestão para pequenos
negócios brasileiros. Centraliza clientes, produtos, estoque, vendas,
caixa, financeiro, agendamentos e comunicação com clientes em um único
sistema — com isolamento total entre empresas, permissões por perfil e
trilha de auditoria em cada operação.

O produto foi desenhado a partir de um **núcleo comum de comércio e
gestão** (operações que atravessam quase todos os pequenos negócios)
e **módulos opcionais** ativáveis por segmento.

### Problema endereçado

Pequenos negócios operam com planilhas soltas e ferramentas
desconectadas, sem visão confiável de estoque, caixa e resultado, e sem
controle de quem fez o quê.

### Posicionamento

- Não é um ERP completo: operações fiscais, contábeis, de frota ou de
  produção estão fora do escopo inicial.
- Prioriza processos comuns de comércio e prestação de serviços
  (lojas, mercadinhos, papelarias, oficinas, pet shops, salões,
  clínicas).

## 2. Objetivos

| # | Objetivo | Métrica de sucesso |
|---|---|---|
| O1 | Operação diária em um só lugar (venda, caixa, estoque) | PDV com baixa automática de estoque e fechamento de caixa auditável |
| O2 | Dados confiáveis por empresa | 100% das leituras/escritas isoladas por `companyId` no servidor |
| O3 | Trilha de auditoria | Nenhuma venda/movimentação apagada; cancelamentos compensatórios com autor, data e motivo |
| O4 | Adaptação por segmento | Módulos opcionais ativáveis/desativáveis por empresa |
| O5 | Monetização SaaS | Planos globais, assinatura da empresa, limites de uso e checkout via Mercado Pago |

## 3. Público-alvo

- **Primário:** donos e gestores de pequenos negócios brasileiros
  (1–10 usuários), com operação de comércio e/ou serviços.
- **Usuários internos:** administrador (configura tudo) e membro
  (opera o dia a dia).
- **Segmentos priorizados:** varejo (roupas, calçados, presentes),
  mercados/adegas, papelarias, assistências técnicas, pet shops,
  salões e clínicas (com módulos de pets e agenda).

## 4. Escopo (MVP entregue)

### 4.1 Núcleo (sempre disponível, não desativável)

| Módulo | Requisitos resumidos |
|---|---|
| Autenticação e usuários | Login por sessão `HttpOnly`; perfis ADMIN/MEMBER; primeiro administrador via variáveis de ambiente; cadastro aberto e redefinição de senha por flags |
| Empresas (tenancy) | Isolamento por tenant; `companyId` sempre derivado da sessão autenticada |
| Clientes | Cadastro com busca, contatos normalizados, endereço, histórico e anti-duplicidade heurística |
| Fornecedores e categorias | Cadastros de apoio ao catálogo |
| Produtos e estoque | SKU/barcode únicos por empresa; entradas/saídas/ajustes; saldo em tempo real com lock; alerta de estoque mínimo |
| Vendas e PDV | Busca por nome/SKU/código de barras, desconto, formas de pagamento, comprovante, idempotência, cancelamento auditável |
| Caixa | Abertura/fechamento por turno; entradas/saídas manuais; estorno auditável; uma única sessão aberta por empresa |
| Financeiro (AP/AR) | Contas a pagar/receber com vencimento, status e baixa vinculada ao caixa |
| Dashboard e relatórios | Indicadores calculados no servidor; filtros por período; exportação CSV protegida |
| Faturamento (billing) | Planos globais da plataforma e assinatura da própria empresa no SaaS |

### 4.2 Módulos opcionais (genéricos, ativáveis por segmento)

| Módulo | Requisitos resumidos | Ativação |
|---|---|---|
| Serviços | Catálogo com preço e duração | `CompanyModule` |
| Agendamentos | Agenda diária, conflito de horário, transições de status, lembrete automático de WhatsApp | `CompanyModule` |
| Assinaturas de clientes | Planos recorrentes com pagamento pelo caixa, renovação e cancelamento auditado | `CompanyModule` |
| WhatsApp | Cloud API oficial da Meta: templates, consentimento auditável, fila com retentativas e webhook assinado | `CompanyModule` |

### 4.3 Módulo de nicho (opcional)

| Módulo | Requisitos resumidos |
|---|---|
| Pets | Ficha de animais vinculada ao cliente (espécie, raça, sexo, peso); desativável e fora da navegação inicial |

## 5. Fora de escopo

- Emissão fiscal (NFC-e/NFe), conciliação de adquirente e maquininha;
- Módulos contábeis, de frota, de produção ou de RH;
- Marketplace, IA e recursos de clínica veterinária completa;
- Entrega offline do PDV;
- Recorrência automática de cobrança (hoje: renovação manual +
  checkout sandbox).

## 6. Requisitos não funcionais

| Categoria | Requisito |
|---|---|
| Segurança | Sessão em cookie `HttpOnly` com hash SHA-256 no banco; bcrypt (12 rounds); rate limit de login; guards globais de sessão, papel e módulo; webhooks com verificação HMAC |
| Integridade | Valores monetários em `Decimal(12,2/3)`; totais e saldos recalculados no servidor; locks `FOR UPDATE` em ordem fixa; idempotência por chave única |
| Auditoria | Ledgers imutáveis (vendas, estoque, caixa, financeiro); cancelamentos/estornos compensatórios com autor, data e motivo |
| Conformidade | LGPD: consentimento de WhatsApp auditável com opt-in/opt-out; checklist pré-comercial em `docs/akylla/CHECKLIST_PRE_PRODUCAO.md` |
| Qualidade | TypeScript estrito; lint 0; suíte de testes em PostgreSQL real; migrações versionadas em `database/prisma/migrations/` |
| Localização | Interface pt-BR, moeda BRL, datas DD/MM/AAAA |
| Custo | Arquitetura de baixo custo (estimativa em `CHECKLIST_PRE_PRODUCAO.md` §6) |

## 7. Critérios de aceite gerais

1. `npm run lint` 0 erros, `npm run typecheck` OK, `npm test` verde em
   PostgreSQL real, `npm run build` OK, `npm run db:validate` OK;
2. Nenhuma leitura/escrita acessível entre empresas (auditoria A×B em
   `tests/integration/tenancy-audit.test.ts`);
3. Toda ação restrita é negada no servidor (403), não apenas oculta na
   interface;
4. Nenhum segredo em repositório; `.env.example` apenas com exemplos.

## 8. Referências

- Diretrizes de produto: `docs/AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md`
- Mapa de módulos (aprovado): `docs/akylla/MAPA_DE_MODULOS.md`
- Documento técnico completo (23 seções):
  `docs/AKYLLA_GESTAO_DOCUMENTACAO_COMPLETA.md`
- Arquitetura, API e banco: `docs/architecture/`
- Status e pendências: `docs/operations/PROJECT_STATUS.md`
