# Pausa dos sites vendidos aos clientes

Como o Akylla pausa (de verdade) o site de um cliente que não pagou — e
como **nunca** pausa os seus próprios sites.

## Regra de ouro

- Entregas marcadas **"nunca pausar"** (os seus produtos: Akylla Gestão,
  site, Akylla Shop, Akylla Studio…) **não podem** ser pausadas nem
  inativadas: o servidor recusa (409), a pausa automática ignora e o
  endpoint público sempre responde `ativo`.
- **Não instale o código de status nos seus próprios sites.** Ele é só
  para os sites que você vende.
- A pausa automática vem **desligada**. Por padrão o sistema só marca o
  contrato como "em débito" e você decide.

## Situações de cobrança

| Situação | Quando |
|---|---|
| Em dia | sem título vencendo nos próximos 7 dias |
| Vence em breve | vence em até 7 dias (ou hoje) |
| Vencido | 1 dia ou mais de atraso (aviso de atraso no dia configurado, padrão 1) |
| Em débito | atraso ≥ "em débito a partir do dia" (padrão 10) **ou** prazo combinado que venceu sem pagamento |
| Em acordo | você deu prazo e a data ainda não passou |
| Pausado / Inativo | você pausou (até pagar) ou inativou (cliente desistiu) |

O Início mostra os **clientes com pagamento pendente**; Clientes e
Entregas têm filtro por situação.

## O que você pode fazer

Na **entrega** (Clientes › Entregas › abrir) ou no **contrato**:

- **Pausar até pagar** — o site mostra a página de "site temporariamente
  suspenso". Quando o pagamento é registrado no Financeiro (ou a
  renovação pelo caixa), ele **volta ao ar sozinho**.
- **Ativar** — volta ao ar na hora.
- **Inativar (cliente desistiu)** — fica suspenso; não volta com
  pagamento. **Reativar** desfaz.
- **Dar prazo** (no contrato) — data limite + o que foi combinado.
  Durante o prazo nada é pausado e os avisos de atraso esperam. Se a data
  passar sem pagamento, o contrato volta a "em débito (acordo
  descumprido)" e aparece no Início.

Tudo pede motivo e fica no **histórico de decisões** (entrega e ficha do
cliente), com quem fez e quando.

## Alertas para o cliente

- Automáticos pelo WhatsApp (worker): 1 a 3 dias antes, no dia e no
  aviso de atraso, com valor, vencimento e chave Pix. Só com
  consentimento; nunca para clientes "nunca pausar". Enquanto o token da
  Meta não estiver configurado, ficam em **simulação** (registra, não
  envia).
- Para mandar à mão: no contrato, **"Copiar aviso: vence em N dias"**,
  **"Copiar aviso: vencido, renove"** e **"Copiar mensagem do prazo
  combinado"**. Os textos são editáveis em Configurações › Contratos.

## Instalar o código no site do cliente (uma vez por site)

1. Abra a entrega do cliente e clique em **"Copiar código de
   instalação"**. Vem algo assim:

   ```html
   <script src="https://app.akyllagestao.com.br/akylla-status.js" data-site="CHAVE-DA-ENTREGA" defer></script>
   ```

2. Cole antes de `</body>` em todas as páginas do site do cliente
   (no WordPress: tema › rodapé, ou um plugin de "inserir código no
   rodapé"; em site estático: no HTML de cada página ou no layout comum).
3. Publique o site. Pronto: a partir daí "pausar", "inativar" e a faixa de
   pendência valem nesse site.

Para testar: pause a entrega, abra o site do cliente (pode levar até 1
minuto por causa do cache) e veja a página de suspenso; depois clique em
**Ativar**.

### Faixa de pendência (opcional)

Na edição da entrega, marque **"Faixa de pendência no site"**. Com o
contrato vencido ou em débito (fora de prazo combinado), o site mostra uma
faixa discreta no rodapé, com o texto de Configurações › Contratos.

### Segurança e falha aberta

- O endpoint `GET /api/public/site-status/<chave>` é **somente leitura**,
  sem login e **sem dados pessoais** (só `status` e a mensagem). A chave é
  aleatória por entrega.
- Se o Akylla estiver fora do ar, demorar mais de 4 segundos ou a chave
  não existir, **o site do cliente continua normal** (falha aberta).
- O script não lê nem envia cookies, formulários ou dados do visitante.

Para remover: apague a linha do `<script>` do site do cliente.
