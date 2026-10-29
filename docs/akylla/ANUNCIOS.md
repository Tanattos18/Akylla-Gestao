# Anúncios — gestão de anúncios dos clientes

Como controlar no Akylla os anúncios que você gerencia para os clientes
(fases A1 e A2 do `upgrade/PLANO_ANUNCIOS.md`, 2026-10-29).

## Regras de ouro

- **A verba é do cliente.** Ele paga direto à Meta, ao Google ou ao
  TikTok, com o cartão dele. O Akylla nunca recebe nem guarda esse
  dinheiro: os valores de verba e investimento são só referência.
- **O que você cobra é a gestão**, por contrato (mensalidade e
  implantação), com a cobrança, os lembretes e a pausa que já existem.
- **Os números são calculados no servidor** (CTR, CPC, custo por
  resultado); ninguém digita um indicador pronto.

## Onde fica

- Menu **Administração › Anúncios** (só ADMIN; módulo `ADS`): Visão
  geral, Campanhas e Contas de anúncio.
- **Ficha do cliente › aba Anúncios**: campanhas, contas e o total
  investido daquele cliente.
- Módulo vendável: `ADS` aparece no "Monte seu plano" como avulso
  (R$ 49,90 sugerido, editável no painel do dono). A empresa da
  plataforma (`akylla-gestao`) já vem com o módulo ativo; o
  `npm run db:seed:akylla` também garante isso.

## Passo a passo

1. **Pacote de gestão no catálogo** — Catálogo digital › novo produto do
   tipo **Gestão de anúncios** (o seed cria "Gestão de anúncios" com
   preço 0,00 para você ajustar). Sugestão de pacotes:

   | Pacote | Inclui | Faixa |
   |---|---|---|
   | Básico | 1 plataforma, até 2 campanhas, relatório mensal | R$ 400–700/mês |
   | Crescimento | Meta + Google, landing page, relatório semanal, rastreamento | R$ 900–1.500/mês |
   | Premium | tudo + artes/vídeos curtos + reunião mensal | a partir de R$ 2.000/mês |
   | Implantação | contas, pixel, rastreador, primeira campanha | R$ 300–800 (único) |

2. **Contrato** — crie a entrega "Gestão de anúncios" do cliente e o
   contrato ligado a ela (Contratos). A mensalidade entra na cobrança
   automática e na "Receita de gestão por mês" da visão geral.
3. **Conta de anúncio** — Anúncios › Contas: cliente, plataforma, nome e
   o id da conta (ex.: `act_123` na Meta, `123-456-7890` no Google). Só
   referência; a conexão pela API é a fase A5.
4. **Campanha** — Anúncios › Campanhas › Nova campanha: cliente → o que
   promover (uma entrega, ou texto livre) → plataforma e objetivo → verba
   de referência e datas. O código UTM é gerado pelo sistema (único na
   sua empresa) e não muda.
5. **Link do anúncio** — na página da campanha, "Gerar link": o endereço
   do site com `utm_source`, `utm_medium=cpc` e `utm_campaign`. Use esse
   link no anúncio (ele prepara o rastreamento da fase A3).
6. **Status** — Rascunho → Aguardando aprovação do cliente → Ativa ⇄
   Pausada → Finalizada. Pausar e finalizar pedem motivo; tudo vai para o
   histórico. Finalizada não volta.
7. **Resultados do dia** — duas formas:
   - **Lançar à mão**: dia, impressões, alcance, cliques, investimento e
     resultados. Lançar o mesmo dia de novo **corrige** (o antes e o
     depois ficam no histórico).
   - **Importar a planilha (CSV)**: veja abaixo.

## Importar a planilha (CSV)

- **Meta**: Gerenciador de Anúncios › Relatórios › Exportar dados da
  tabela › `.csv`, com **Detalhamento › Por tempo › Dia** (uma linha por
  dia). Colunas reconhecidas: Dia / Início dos relatórios, Nome da
  campanha, Impressões, Alcance, Cliques no link (ou Cliques (todos)),
  Valor usado (BRL), Resultados — e os nomes em inglês.
- **Google Ads**: Campanhas › Download › CSV, com a coluna **Dia**.
  Colunas: Dia, Campanha, Impr., Cliques, Custo, Conversões (ou Day,
  Campaign, Impressions, Clicks, Cost, Conversions). As linhas de título
  no começo e as de "Total" no fim são ignoradas; "CSV para Excel"
  (UTF-16, tabulação) também é aceito.
- Números no formato brasileiro (`1.234,56`) ou internacional
  (`1,234.56`); `--` vale zero; conversões fracionadas são arredondadas.
- **Sempre há prévia**: o sistema mostra as colunas usadas, os dias, os
  totais e as linhas com problema, sem gravar nada. Só ao clicar em
  "Importar" os dias são gravados.
- Planilha com várias campanhas: escolha qual importar (se houver uma com
  o mesmo nome da campanha do Akylla, ela já vem escolhida).
- Reimportar o mesmo dia substitui o que veio da planilha antes (não
  duplica).
- Linha que soma vários dias (exportação sem detalhamento por dia) é
  recusada com aviso.

## Qual número vale no dia

Cada dia pode ter até três origens: **API** (fase A5), **planilha** e
**manual**. Vale a de maior prioridade — **API > planilha > manual** — e
as outras ficam guardadas ("substitui" na tabela de métricas). Fórmulas
em `docs/akylla/DICIONARIO_INDICADORES.md` §8.

## Visão geral

Período (padrão: mês atual), campanhas ativas, investimento dos
clientes, resultados, custo médio por resultado, receita de gestão por
mês (contratos de gestão ativos), tabela por cliente e o alerta
**campanhas ativas sem métrica há 3 dias ou mais**.

## Ainda não existe (próximas fases, aguardam autorização)

- A3 — rastreamento nos sites (contatos pelo site, custo por contato).
- A4 — relatórios para o cliente (mensagem pronta, envio semanal,
  página pública).
- A5/A6 — integração com as APIs da Meta e do Google.
- A7 — pedido de anúncio pelo cliente e rede de banners.
