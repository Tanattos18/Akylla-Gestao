# Akylla Gestão — Passo a passo de adaptação para o OpenCode

**Documento operacional para execução incremental**  
**Versão:** 1.0  
**Data:** 12/10/2026

## Objetivo

Orientar o OpenCode a adaptar a base existente para o Akylla Gestão com mudanças pequenas, verificáveis e reversíveis. O Akylla Gestão será um SaaS multiempresa de gestão para pequenos negócios brasileiros, começando por um núcleo comum de comércio e gestão.

Este roteiro complementa `AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md`. Se houver divergência, o OpenCode deve parar, apontar a divergência e pedir decisão ao proprietário. O código real deve ser inspecionado antes de presumir que algo existe ou funciona.

---

# Regras que valem em todas as etapas

1. **Uma etapa por vez.** Não execute a etapa seguinte até concluir e relatar a atual.
2. **Diagnostique antes de editar.** Antes de qualquer mudança, informe o que pretende alterar e por quê.
3. **Preserve o trabalho existente.** Não reconstrua o projeto do zero e não apague módulos sem justificativa e aprovação.
4. **Não mexa na pasta legada `automação do whatsapp/`** sem autorização explícita.
5. **Não exponha segredos.** Nunca imprima ou copie valores de `.env`, tokens, senhas ou chaves para relatórios, commits ou respostas.
6. **Não invente sucesso.** Execute os testes disponíveis e registre os resultados reais. Se algo não puder ser executado, declare-o como não verificado.
7. **Não instale dependências nem contrate serviços automaticamente.** Primeiro explique necessidade, custo e alternativa.
8. **Não faça deploy, commits, exclusões irreversíveis ou mudanças destrutivas de banco** sem aprovação.
9. **Não use dados reais de clientes em testes.** Use dados sintéticos em ambientes de desenvolvimento/teste.
10. **Atualize a documentação** quando uma mudança alterar arquitetura, fluxo, schema, configuração ou comportamento.
11. **Não tente fazer o sistema inteiro de uma só vez.** Prefira alterações pequenas e revisáveis.
12. Antes de alterações amplas, verifique o estado do Git e preserve alterações do proprietário. Não descarte mudanças locais existentes.

---

# Etapa 0 — Diagnóstico do repositório (somente leitura)

## Objetivo
Entender o estado real do projeto antes de modificá-lo.

## Instruções ao OpenCode
1. Verifique a raiz do repositório e liste aplicações, pacotes, documentação, testes, migrations e arquivos de configuração relevantes.
2. Inspecione `package.json` raiz e os `package.json` dos workspaces.
3. Identifique as tecnologias realmente utilizadas em frontend, backend, banco, ORM, autenticação, validação e testes.
4. Examine o schema do banco e o histórico de migrations.
5. Mapeie os módulos existentes: autenticação, empresas, usuários, produtos, categorias, fornecedores, estoque, vendas, caixa, financeiro, clientes, pets, serviços, WhatsApp, relatórios, agenda, planos e assinaturas.
6. Para cada módulo, classifique:
   - confirmado no código;
   - descrito na documentação, mas não confirmado;
   - testado com sucesso;
   - não testado ou com falhas.
7. Confira comandos disponíveis para lint, typecheck, testes, build e validação do banco. Não execute comandos potencialmente destrutivos sem entender seus efeitos.
8. Verifique o estado do Git sem descartar nem sobrescrever alterações.
9. Identifique dependências de recursos específicos de pet shop.
10. Não exiba segredos durante a inspeção.

## Entregável
Criar `docs/akylla/DIAGNOSTICO_INICIAL.md` com:
- arquitetura atual;
- módulos e estado de validação;
- funcionalidades reaproveitáveis;
- elementos específicos de pet shop;
- riscos técnicos e de segurança;
- comandos e resultados realmente executados;
- proposta de etapas e arquivos prováveis de alteração.

## Critério de conclusão
Apresentar o diagnóstico ao proprietário e aguardar aprovação antes de editar arquivos.

---

# Etapa 1 — Plano de migração e linha de base

## Objetivo
Definir uma sequência segura de adaptação e saber se o projeto já funciona antes das mudanças.

## Instruções
1. Com base no diagnóstico aprovado, preparar uma lista de alterações por arquivo/módulo.
2. Identificar dependências e impacto em migrations, rotas, imports, testes e dados.
3. Executar, quando seguro e possível, os testes iniciais: lint, typecheck, testes, build e validação do schema.
4. Registrar falhas preexistentes separadamente das falhas introduzidas depois.
5. Confirmar se há alterações locais do proprietário que precisam ser preservadas.
6. Propor um plano de reversão para cada mudança de maior risco.

## Entregável
Criar `docs/akylla/PLANO_DE_ADAPTACAO.md` com etapas, riscos, critérios de aceitação e plano de reversão.

## Critério de conclusão
Plano e linha de base documentados. Aguardar aprovação antes da primeira alteração funcional.

---

# Etapa 2 — Identidade Akylla Gestão

## Objetivo
Adaptar a identidade visível sem quebrar os componentes internos.

## Instruções
1. Alterar nome do produto em títulos, metadados, login, cabeçalhos, navegação, mensagens e documentação visível.
2. Aplicar o nome **Akylla Gestão** e o idioma português brasileiro.
3. Padronizar moeda para BRL e datas visíveis para `DD/MM/AAAA`, mantendo timestamps internos coerentes.
4. Remover textos de produto que apresentem a aplicação como exclusiva para pet shops na navegação genérica.
5. Não apagar módulos específicos de pet shop ainda; apenas identificar e, se aprovado, esconder da navegação geral.
6. Não renomear identificadores internos, tabelas ou migrations em massa. Alterações internas devem ser justificadas e feitas com compatibilidade.
7. Verificar responsividade e navegação básica.

## Testes
- Login e navegação principal.
- Verificação de títulos, links e mensagens.
- Testes existentes de frontend/build.
- Busca por referências visíveis à marca anterior e classificação de cada ocorrência.

## Entregável
Atualizar a interface e criar `docs/akylla/IDENTIDADE_E_NAVEGACAO.md`, listando as referências mantidas por compatibilidade.

## Critério de conclusão
Identidade visual/textual adaptada sem regressões. Relatar ocorrências específicas que permaneceram e por quê.

---

# Etapa 3 — Auditoria do multiempresa e das permissões

## Objetivo
Comprovar o isolamento dos dados entre empresas antes de ampliar funcionalidades.

## Instruções
1. Mapear tabelas de negócio e confirmar como cada registro se associa a uma empresa.
2. Revisar cada endpoint/ação de leitura e escrita para confirmar autorização no servidor.
3. Confirmar que a empresa ativa deriva da sessão e de uma associação autorizada, e não de um `companyId` confiado do navegador.
4. Se houver acesso direto ao banco pelo frontend, verificar RLS em cada tabela acessível. Se o backend for a única porta de acesso, revisar guards, filtros e caminhos alternativos.
5. Revisar ações administrativas e diferenças entre proprietário, administrador e membro.
6. Identificar endpoints que retornem dados agregados, exportações, arquivos ou detalhes sem verificar o tenant.
7. Corrigir somente os problemas confirmados e aprovados.
8. Não declarar segurança com base apenas em revisão visual; criar testes automatizados de acesso cruzado.

## Testes obrigatórios
Criar duas empresas sintéticas, Empresa A e Empresa B, e verificar:
- usuário A não lista registros B;
- usuário A não abre um registro B por ID;
- usuário A não edita nem exclui registros B;
- usuário A não associa produto, cliente, categoria ou fornecedor de B aos registros de A;
- relatórios e exportações não misturam dados;
- usuário sem permissão não executa ações administrativas;
- a alteração do `companyId` enviado pelo navegador não permite acesso indevido.

## Entregável
Criar `docs/akylla/AUDITORIA_MULTIEMPRESA.md` com achados, correções, testes e riscos restantes.

## Critério de conclusão
Testes de isolamento aprovados. Se houver falhas críticas ou testes não executáveis, interromper a expansão do escopo e reportar.

---

# Etapa 4 — Definição do núcleo genérico

## Objetivo
Separar os recursos comuns de gestão dos recursos exclusivos de pet shop.

## Instruções
1. Classificar cada módulo em:
   - núcleo comum do Akylla;
   - módulo opcional futuro;
   - específico de pet shop;
   - obsoleto ou duplicado (não excluir sem aprovação).
2. Núcleo inicial recomendado:
   - empresas e usuários;
   - clientes;
   - fornecedores;
   - produtos e categorias;
   - estoque;
   - vendas;
   - financeiro básico;
   - dashboard e relatórios;
   - configurações.
3. Classificar pets, agenda para pets, serviços específicos, templates/lembretes específicos e assinaturas dos clientes do pet shop como específicos ou opcionais.
4. Separar claramente o faturamento da Akylla (assinatura SaaS) do financeiro da empresa cliente.
5. Não criar abstrações genéricas complexas sem necessidade comprovada.
6. Apresentar ao proprietário a matriz de classificação antes de remover, migrar ou ocultar funcionalidades.

## Entregável
Criar `docs/akylla/MAPA_DE_MODULOS.md` com classificação, dependências e decisão recomendada.

## Critério de conclusão
Matriz revisada e aprovada pelo proprietário.

---

# Etapa 5 — Adaptação do cadastro, clientes e fornecedores

## Objetivo
Preparar cadastros que sirvam para pequenos negócios de segmentos variados.

## Instruções
1. Confirmar se os cadastros atuais são reutilizáveis e estão protegidos por tenant.
2. Tornar os textos e formulários genéricos para empresas comerciais, sem campos obrigatórios exclusivos de pet shop.
3. Preservar campos comuns úteis, como nome, telefone, e-mail, documento quando necessário, endereço, notas e status, respeitando o schema real.
4. Não exigir CPF/CNPJ se não houver justificativa de negócio; se o campo existir, validar e proteger adequadamente.
5. Revisar regras de duplicidade para não bloquear homônimos ou contatos compartilhados legitimamente.
6. Garantir que inativar um cliente ou fornecedor não destrua o histórico de vendas ou financeiro.
7. Garantir filtros, paginação e mensagens de erro compreensíveis.

## Testes
- Criar, consultar, editar e inativar registros.
- Verificar acesso cruzado entre empresas.
- Verificar associações e histórico após inativação.
- Verificar validações de campos.

## Entregável
Relatório de alterações e testes nos cadastros genéricos.

## Critério de conclusão
Cadastros funcionais e isolados por empresa.

---

# Etapa 6 — Produtos, categorias e estoque

## Objetivo
Consolidar o controle de mercadorias para comércios variados.

## Instruções
1. Confirmar o modelo atual de produtos, categorias, fornecedores, preços e quantidades.
2. Tornar rótulos e fluxos independentes de pet shop.
3. Garantir SKU/código de barras único por empresa quando preenchido.
4. Garantir que categorias e fornecedores associados pertençam à mesma empresa.
5. Recalcular e validar no servidor entradas, saídas, ajustes e saldo.
6. Manter histórico de movimentações auditável.
7. Bloquear estoque negativo por padrão.
8. Garantir transações e proteção contra operações simultâneas.
9. Preservar precisão decimal para quantidades fracionárias, quando necessárias.
10. Implementar ou manter alerta de estoque mínimo baseado em dados reais.

## Testes
- Entrada, saída e ajuste.
- Bloqueio de saldo negativo.
- Movimentações concorrentes.
- Requisição repetida.
- Associação de produto/categoria/fornecedor entre empresas.
- Histórico e saldo final consistentes.

## Entregável
Relatório de testes de estoque e atualização da documentação de negócio.

## Critério de conclusão
Saldo consistente com o histórico e testes aprovados.

---

# Etapa 7 — Vendas e recebimentos

## Objetivo
Oferecer um fluxo de venda simples para o MVP.

## Instruções
1. Mapear o fluxo atual do PDV, caixa e venda.
2. Definir com o proprietário se o MVP exige abertura/fechamento de caixa ou se começa com registro simplificado de vendas e recebimentos. Não alterar essa regra silenciosamente.
3. Recalcular preços, descontos e totais no servidor.
4. Validar estoque e cliente, quando selecionado.
5. Gravar venda, itens, movimentações de estoque e registros financeiros relacionados em transações consistentes.
6. Registrar snapshots dos itens vendidos para preservar o histórico.
7. Implementar idempotência para evitar venda duplicada por repetição de requisição.
8. Tornar cancelamentos/estornos auditáveis e consistentes entre venda, estoque e financeiro.
9. Não anunciar emissão fiscal, integração com adquirentes ou conciliação bancária se não estiverem implementadas.

## Testes
- Venda válida.
- Estoque insuficiente.
- Desconto inválido.
- Dupla submissão.
- Falha durante transação.
- Cancelamento e estorno.
- Consistência entre venda, estoque e financeiro.

## Entregável
Fluxo de venda validado e lista explícita de limitações.

## Critério de conclusão
Venda ponta a ponta testada sem inconsistências financeiras ou de estoque.

---

# Etapa 8 — Financeiro básico

## Objetivo
Organizar a situação financeira do pequeno negócio sem confundir previsões e valores realizados.

## Instruções
1. Inspecionar o modelo atual de caixa e financeiro antes de alterar.
2. Definir conceitos separados para contas a pagar, contas a receber, pagamentos/recebimentos realizados, caixa e fluxo de caixa.
3. Registrar vencimento, situação, valor, categoria, contraparte e vínculo de origem quando aplicável.
4. Recalcular valores e validar transições no servidor.
5. Usar Decimal ou tipo equivalente adequado para valores monetários.
6. Evitar que uma venda seja considerada recebida sem um registro correspondente.
7. Implementar filtros por período e status.
8. Preservar histórico de ajustes, cancelamentos e estornos.
9. Diferenciar financeiro do negócio do billing da Akylla.

## Testes
- Criar conta a pagar e receber.
- Marcar pagamento/recebimento e validar saldos.
- Cancelamento/estorno auditável.
- Relatórios por período.
- Isolamento por empresa.
- Arredondamento e valores decimais.

## Entregável
Documento com definições financeiras e evidência de testes.

## Critério de conclusão
Indicadores financeiros coerentes com os lançamentos e testados.

---

# Etapa 9 — Dashboard e relatórios

## Objetivo
Mostrar informações úteis e confiáveis.

## Instruções
1. Calcular agregações no backend ou em consultas devidamente autorizadas.
2. Aplicar tenant e permissões em todas as consultas.
3. Definir significado de cada indicador, especialmente faturamento, receita recebida, contas vencidas e saldo de caixa.
4. Exibir estado vazio quando não houver dados suficientes; não inventar números.
5. Validar filtros de data, paginação e limites de exportação.
6. Proteger CSV contra injeção de fórmulas.
7. Garantir que gráficos não misturem períodos ou status diferentes.

## Testes
- Empresa vazia.
- Empresa com dados.
- Filtros por data.
- Empresa A versus Empresa B.
- Exportação com caracteres especiais e fórmulas.
- Coerência entre indicadores e dados de origem.

## Entregável
Dicionário dos indicadores e testes de relatórios.

## Critério de conclusão
Indicadores rastreáveis a dados reais e isolados por empresa.

---

# Etapa 10 — Módulos específicos de pet shop

## Objetivo
Decidir o destino dos recursos que não pertencem ao núcleo genérico.

## Instruções
1. Não excluir pets, agenda, serviços e automações WhatsApp automaticamente.
2. Mapear dependências, rotas, tabelas, testes e relatórios que dependem desses módulos.
3. Recomendar para cada um: manter fora da navegação inicial, transformar em módulo opcional, reutilizar de forma genérica ou retirar após aprovação.
4. Se houver uma arquitetura de módulos, confirmar que o backend também bloqueia o acesso aos módulos desabilitados.
5. Não apagar a pasta legada `automação do whatsapp/`.

## Entregável
Plano de modularização com impacto e reversão.

## Critério de conclusão
Decisão do proprietário registrada antes de qualquer exclusão definitiva.

---

# Etapa 11 — Planos e assinatura SaaS da Akylla

## Objetivo
Preparar a monetização sem simular integrações inexistentes.

## Instruções
1. Separar entidades de assinatura da plataforma das assinaturas de negócio que um cliente possa oferecer aos próprios clientes.
2. Revisar os modelos atuais de plano/assinatura e documentar as diferenças.
3. Definir planos e limites como decisão pendente do proprietário.
4. Aplicar limites no backend, não apenas na interface.
5. Modelar estados, datas de vigência, cancelamento e renovação.
6. Avaliar gateway, webhooks, idempotência, custos e modo de teste antes de integrar.
7. Não ativar cobrança recorrente sem testes end-to-end e aprovação explícita.
8. Não publicar preços, limites ou promessas comerciais sem aprovação.

## Testes
- Empresa sem assinatura.
- Assinatura ativa, vencida e cancelada.
- Limite atingido.
- Tentativa de contornar limite via API.
- Webhook repetido, se gateway for integrado.
- Isolamento de dados entre empresas.

## Entregável
Plano de billing e checklist de decisões comerciais.

## Critério de conclusão
Nenhuma cobrança ou limite anunciado sem implementação comprovada.

---

# Etapa 12 — Qualidade, segurança e preparação para produção

## Objetivo
Verificar o MVP como conjunto antes de qualquer lançamento.

## Instruções
1. Executar lint, typecheck, testes, build e validação do banco conforme os comandos existentes.
2. Corrigir regressões introduzidas pela adaptação.
3. Confirmar que falhas preexistentes estão identificadas separadamente.
4. Revisar segredos, logs, autenticação, autorização, tenant, uploads e exportações.
5. Confirmar backups e realizar um teste de restauração em ambiente apropriado antes da produção.
6. Definir ambientes de desenvolvimento, teste e produção.
7. Documentar configuração e variáveis de ambiente sem valores secretos.
8. Estimar custos de hospedagem e serviços antes de contratar qualquer plano.
9. Não fazer deploy nem alterar serviços externos sem aprovação do proprietário.
10. Produzir uma lista clara de limitações conhecidas e itens obrigatórios antes da comercialização.

## Entregável
Criar `docs/akylla/CHECKLIST_PRE_PRODUCAO.md` e relatório final dos testes.

## Critério de conclusão
O proprietário recebe evidências, riscos remanescentes, custos estimados e decisão recomendada sobre prontidão. O OpenCode não deve declarar “pronto para produção” sem evidências suficientes.

---

# Formato obrigatório de resposta ao final de cada etapa

O OpenCode deve responder usando este formato:

## Etapa N — [nome]
- **Status:** concluída / bloqueada / parcialmente concluída.
- **O que foi feito:** lista objetiva.
- **Arquivos alterados:** lista de caminhos.
- **Banco/migrations:** alterações ou “nenhuma”.
- **Testes executados:** comando e resultado real.
- **Testes não executados:** motivo.
- **Riscos ou pendências:** lista.
- **Decisões necessárias do proprietário:** perguntas diretas.
- **Próxima etapa sugerida:** somente uma.

Nunca iniciar a próxima etapa automaticamente. Parar e aguardar aprovação do proprietário.

---

# Prompt inicial para enviar ao OpenCode

Leia integralmente `AKYLLA_GESTAO_DIRETRIZES_OPENCODE.md` e `PASSO_A_PASSO_OPENCODE_AKYLLA.md`, além da documentação atual do repositório.

Comece somente pela **Etapa 0 — Diagnóstico do repositório**, em modo de leitura. Não edite arquivos, não execute migrations, não instale dependências, não faça commits e não faça deploy nesta etapa.

Inspecione o código real e produza `docs/akylla/DIAGNOSTICO_INICIAL.md`, classificando cada funcionalidade como confirmada no código, documentada mas não confirmada, testada, não testada ou com falhas. Não revele segredos. Ao terminar, apresente o diagnóstico e aguarde minha aprovação antes de prosseguir.
