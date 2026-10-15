# Matriz de go/no-go para venda — Akylla Gestão

> Documento de decisão (N1 · 9.7). A venda deve ser **bloqueada** se
> qualquer item crítico de dados, isolamento, cobrança ou recuperação
> estiver em **NO-GO**. Preencha cada área com evidência antes de liberar
> o primeiro cliente pagante. Base: `COMPILADO_MELHORIAS.md` e
> `CHECKLIST_PRE_PRODUCAO.md` §3/§7.

| Área | GO quando… | NO-GO se… | Status |
|---|---|---|---|
| **Dados** | Backup automático e restauração testada | Backup não existe ou restore falha | ⬜ |
| **Segurança** | Vulnerabilidades graves tratadas/mitigadas; configuração revisada | Vulnerabilidade grave conhecida sem decisão ou segredo exposto | ⬜ |
| **Autenticação** | HTTPS, cookies seguros e recuperação de senha adequada | Reset inseguro ou sessão sem proteção adequada | ⬜ |
| **Multiempresa** | Testes de isolamento e autorização cobrem fluxos críticos | Há acesso cruzado ou risco não avaliado em fluxo crítico | ⬜ |
| **Operação** | Deploy reproduzível, monitoramento e runbooks | Deploy manual desconhecido ou sem recuperação | ⬜ |
| **Privacidade** | Inventário, canal e processos mínimos definidos | Não há processo para solicitação/incidente de dados | ⬜ |
| **Cobrança** | E2E sandbox, idempotência e reconciliação validadas | Pagamento pode ativar plano incorretamente | ⬜ |
| **Produto** | Limitações, plano, cancelamento e suporte claros | Promessa comercial excede o que o sistema entrega | ⬜ |
| **Custos** | Custo observado e limites monitorados | Não há controle de gasto ou risco de cobrança inesperada | ⬜ |

## Critério de aceite final (checklist de evidências)

Todos obrigatórios para marcar **GO**:

- [ ] `https://<dominio>/health` retorna 200 e deploy automático funcionando
- [ ] Existe dump com data e restore concluído registrado
- [ ] Alerta de uptime e de erro 500 recebidos pelo menos uma vez
- [ ] `npm audit --omit=dev` = 0 vulnerabilidades
- [ ] Endpoint LGPD (`DELETE /api/lgpd/clients/:id/anonymize`) testado ponta a ponta
- [ ] Evidência de assinatura `ACTIVE` via pagamento real do sandbox (Mercado Pago)
- [ ] Termos + privacidade publicados e aceite registrado no cadastro
- [ ] `npm run validate` verde no commit de produção
- [ ] Demo ensaiado 2 vezes, começando pela importação de planilha

## Decisões do proprietário (a preencher)

1. Qual provedor de hospedagem e região usar.
2. Qual domínio será usado e quem administrará o DNS.
3. Qual orçamento mensal máximo (hospedagem, banco, backup, e-mail, monitoramento, integrações).
4. Piloto por convite ou cadastro público.
5. Qual segmento validará o produto primeiro.
6. Quais planos, preços, limites e periodicidade de cobrança.
7. Política de inadimplência, tolerância, cancelamento e exportação.
8. RPO/RTO e retenção de backups aceitáveis.
9. Como será feito suporte e resposta a incidentes.
10. Quem revisa os documentos jurídicos e o enquadramento LGPD.
11. Se RLS será adotada antes de produção e qual desenho técnico.
12. Quais funcionalidades ficam **fora** da promessa comercial inicial.

> Regra: nenhuma alteração de escopo, migração ou deploy sem autorização
> explícita do proprietário (AGENTS.md).
