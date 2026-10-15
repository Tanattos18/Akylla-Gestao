# Plano de Transformação Comercial e Roadmap Técnico: Akylla Gestão

Este documento apresenta uma análise profunda, técnica e fundamentada da viabilidade do sistema **Akylla Gestão** (`github.com/Tanattos18/Akylla-Gestao`) para comercialização como SaaS multiempresa (B2B). O material compila o diagnóstico do repositório, o estado da suíte de testes e o plano para colocar a aplicação no ar de forma escalável e rentável.

---

## 1. Avaliação de Viabilidade e Funcionamento do Sistema

### O sistema vai funcionar para vendas comerciais?
**Sim, o sistema possui uma base técnica bem construída, mas ainda não está pronto para operar comercialmente em escala sem intervenções estratégicas.**

### Pontos Fortes e Cobertura Técnica Atual
1. **Arquitetura Multi-Tenant Sólida:** As consultas e mutações utilizam o `companyId` derivado exclusivamente da sessão autenticada (`request.user.companyId`), impedindo vazamento de dados entre empresas (vazamento horizontal / IDOR) na camada de aplicação.
2. **Histórico Imutável e Consistência Financeira:** O sistema adota o padrão *Ledger* em estoque, caixa e vendas. Correções são feitas via movimentações compensatórias, eliminando inconsistências contábeis.
3. **Mecanismos de Concorrência e Idempotência:** Uso de locks pessimistas (`SELECT ... FOR UPDATE`) em sessões de caixa e produtos, além de chaves de idempotência (`clientRequestId`, `gatewaySubscriptionId`, `wamid`).
4. **Base de Testes Rígida:** Presença de 538 testes de integração executados diretamente contra uma instância real do PostgreSQL.

### Bloqueadores Críticos para Venda Comercial
* **Falta de Deploy e Pipeline de Entrega Contínua (CD):** O arquivo `cd.yml` é um *placeholder*. Não há infraestrutura de produção provisionada.
* **Ausência de Rotina Automática de Backup e Restore:** A pasta `backup/` contém apenas um `README.md`. Qualquer falha no banco de dados em produção acarretaria perda irrecuperável de dados de clientes pagantes.
* **Validação Real do Gateway de Pagamentos:** O SDK do Mercado Pago está integrado via *sandbox*, com testes cobrindo mocks, sem uma transação E2E real aprovada em produção.
* **Conformidade Legal (LGPD):** Não há fluxo implementado para o direito ao esquecimento e anonimização de dados de clientes (PII).

---

## 2. Plano de Melhorias Dividido por Áreas

---

### 2.1. Infraestrutura, Arquitetura e Segurança (Backend & DevSecOps)

#### A. Isolamento em Camada de Banco de Dados (Row-Level Security)
* **Diagnóstico:** O isolamento multi-tenant depende exclusivamente das cláusulas `where: { companyId }` aplicadas pelo ORM/Aplicação NestJS.
* **Melhoria:** Implementar **Row-Level Security (RLS)** nativo no PostgreSQL. A cada requisição, a sessão do Postgres deve definir o parâmetro de contexto `SET LOCAL app.current_company_id = 'cuid_da_empresa'`, bloqueando acessos indevidos direto na camada do banco de dados (defesa em profundidade).

#### B. Infraestrutura Elástica, Fila e Cache Distribuído
* **Rate Limit Distribuído:** Substituir o controle de taxa de requisições *in-memory* por um repositório baseado em **Redis**. O modelo em memória perde eficácia quando a aplicação é escalada para múltiplos contêineres/instâncias.
* **Fila de Mensagens Robusta:** Migrar o modelo atual de mensageria WhatsApp (baseado em polling no PostgreSQL via `apps/worker`) para **Redis + BullMQ**. Isso elimina carga desnecessária de leitura I/O no banco relacional durante o disparo de notificações.

#### C. Proteção e Conformidade Legal (LGPD)
* **Endpoint de Anonimização:** Criar a rota `DELETE /api/clients/:id/anonymize` restrita a administradores. A rota deve substituir campos PII (nome, CPF, e-mail, telefone) por marcadores anônimos (`CLIENTE_REMOVIDO_LGPD`), preservando a integridade fiscal de `Sale`, `CashMovement` e `FinancialEntry`.

#### D. Pipeline CI/CD e Backup Gerenciado
* **Pipeline de CD:** Atualizar `.github/workflows/cd.yml` com rotinas para *build* de imagens Docker, execução de migrations via `prisma migrate deploy` e atualização controlada da infraestrutura em nuvem (ex: AWS ECS, Railway ou Render).
* **Automação de Backup:** Implementar uma tarefa cronizada chamando `pg_dump` com envio de artefatos criptografados para um bucket de armazenamento S3. Adicionar rotina periódica de teste de restauração em ambiente isolado.

---

### 2.2. Interface do Usuário e Design System (Frontend & UX)

#### A. Correção de Débitos Técnicos de Design (Concluídos e Pendentes)
* **Débitos Resolvidos (Commit `5874e89`):** Correção do token `--color-foreground`, vinculação correta da variável da fonte Inter, limpeza de seletores CSS obsoletos, implementação de rotas globais de erro/carregamento (`loading.tsx`, `error.tsx`, `not-found.tsx`) e ajuste de contraste para padrão WCAG AA em textos informativos.
* **Débitos Pendentes:**
  * **Componente de Tabela Padronizado:** Unificar as 32 instâncias de elementos `<table>` inline espalhadas pelo projeto em um componente unificado `<Table />` com suporte a alinhamento numérico, estados vazios e layout responsivo.
  * **Biblioteca de Primitivos UI:** Implementar componentes padronizados para `<Modal />`, `<Select />`, `<Toast />` e `<Tabs />`.

#### B. Componentização e Experiência do Usuário (UX)
* **Feedback Visual em Ações Assíncronas (Toasts):** Integrar notificações do tipo *Toast* para dar retorno imediato ao usuário em ações como cadastro de entidades, liquidação de títulos e mensagens enfileiradas.
* **Visualização de Limites de Plano no Painel:** Atualizar a tela `/faturamento` para consumir os dados já fornecidos pelo `TenantLimitsService`, exibindo barras de progresso do consumo de usuários, clientes e produtos.

---

### 2.3. Documentação e Qualidade de Código (DX & Observabilidade)

#### A. Especificação e Documentação de API
* **Geração Automática via Swagger/OpenAPI:** Integrar o módulo `@nestjs/swagger` na API NestJS para gerar documentação interativa baseada nos decorators do framework, garantindo que os contratos de endpoints permaneçam atualizados.

#### B. Monitoramento e Telemetria em Produção
* **Rastreamento de Erros:** Integrar o Sentry (ou solução open-source equivalente) no `AllExceptionsFilter` do NestJS e na aplicação Next.js para captura e notificação automática de exceções não tratadas (HTTP 500).
* **Métricas de Infraestrutura:** Configurar rotas de verificação de integridade avançadas em `/health`, incluindo verificação de latência do banco de dados e disponibilidade da fila de mensagens.

---

### 2.4. Modelo de Negócios e Operação SaaS (Billing & Go-To-Market)

#### A. Ativação E2E do Gateway de Pagamentos
* Validar a integração com a API do Mercado Pago criando assinaturas reais no ambiente Sandbox via cartão de teste.
* Garantir que as notificações de webhook de alteração de status (`preapproval`) processem a transição do estado da `TenantSubscription` para `ACTIVE`, `CANCELLED` ou `EXPIRED` sem intervenção manual.

#### B. Ajuste nos Dados de Demonstração (Seed)
* Atualizar o script de carga inicial (`apps/api/src/cli/seed-demo.ts`) para gerar cenários neutros para múltiplos segmentos do varejo e prestação de serviços, removendo a dependência exclusiva do segmento de pet shops.

---

## 3. Matriz de Priorização de Implementação

| Prioridade | Categoria | Ação | Impacto no Negócio |
|---|---|---|---|
| **P0 (Crítico)** | Infraestrutura | Automação de Backups em Nuvem (`pg_dump` + S3) | Elimina risco de perda irreversível de dados. |
| **P0 (Crítico)** | Conformidade | Implementação de Anonymize/LGPD no Módulo de Clientes | Garante conformidade legal para venda B2B. |
| **P1 (Alto)** | Operação | Finalização da Pipeline de CD (`cd.yml`) e Deploy | Permite a publicação do sistema em ambiente estável. |
| **P1 (Alto)** | SaaS/Billing | Validação E2E do Checkout Mercado Pago em Sandbox | Habilita o recebimento e monetização de assinaturas. |
| **P1 (Alto)** | Qualidade | Integração de Ferramenta de Logs/Sentry | Dá visibilidade de falhas em tempo de execução. |
| **P2 (Médio)** | UI/UX | Criação do Componente Reutilizável de Tabela (`<Table />`) | Melhora a manutenibilidade e padronização das telas. |
| **P2 (Médio)** | Backend | Implementação de RLS (Row-Level Security) no Postgres | Fortalece a segurança multi-tenant no banco de dados. |
| **P3 (Baixo)** | Plataforma | Substituição do Polling por Redis + BullMQ na Fila WhatsApp | Otimiza performance em cenários de alta escala. |

---

## 4. Conclusão e Recomendação Estratégica

O projeto **Akylla Gestão** apresenta um nível de maturidade técnica elevado, com boa separação de responsabilidades e regras de domínio consolidadas por testes automatizados. 

Para efetuar a transição de um repositório em desenvolvimento para um **SaaS comercial**, recomenda-se seguir o roadmap priorizado acima: **resolver os bloqueadores de infraestrutura e conformidade (P0 e P1) antes de abrir o sistema para o primeiro lote de clientes pagantes (piloto fechado).**