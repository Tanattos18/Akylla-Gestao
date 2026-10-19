# WhatsApp — como ligar o envio e o recebimento reais

O Akylla Gestão usa a **API oficial do WhatsApp (Cloud API da Meta)**.
Enquanto o servidor estiver com `WHATSAPP_PROVIDER=mock`, tudo funciona em
**modo simulação**: o teste de conexão dá "OK" e os envios aparecem como
enviados, mas **nenhuma mensagem real sai nem chega**. A tela
Relacionamento › WhatsApp mostra um aviso amarelo nesse caso.

## O que o sistema faz com o WhatsApp

- **Envia** mensagens automáticas a partir de **templates aprovados pela
  Meta**: lembrete de agendamento e envios feitos em
  Relacionamento › WhatsApp › Mensagens. Só envia para clientes com
  **consentimento** registrado (LGPD).
- **Recebe** pelo webhook:
  - o status de cada mensagem (enviada, entregue, lida, falhou);
  - o pedido de descadastro: quando o cliente responde SAIR, STOP,
    CANCELAR ou DESCADASTRAR, o consentimento é retirado sozinho.
- **Não é uma caixa de conversa:** as respostas livres dos clientes não
  aparecem no sistema por enquanto.

## Passo a passo (uma vez, na Meta)

1. **Conta e app:**
   - entre em <https://business.facebook.com> com a conta da empresa;
   - em <https://developers.facebook.com> › *Meus apps* › *Criar app*,
     escolha o tipo **Empresa** e adicione o produto **WhatsApp**.
2. **Número:** em *WhatsApp › Configuração da API*, adicione e verifique o
   número da empresa.
   - O número **não pode** estar em uso no app WhatsApp comum ao mesmo
     tempo. A Meta tem o recurso de "coexistência" para alguns números.
   - Anote o **Phone number ID**: um número longo, que **não é o
     telefone**.
   - Anote também o **WhatsApp Business Account ID** (WABA ID).
3. **Token permanente:**
   - em *Configurações do negócio › Usuários do sistema*, crie um usuário
     do sistema **Admin**;
   - atribua a ele o app e a conta do WhatsApp;
   - clique em *Gerar token*, com as permissões `whatsapp_business_messaging`
     e `whatsapp_business_management`;
   - guarde o token: ele é o `WHATSAPP_ACCESS_TOKEN`.
4. **App secret:** em *Configurações do app › Básico › Chave secreta do
   aplicativo* (é o `WHATSAPP_APP_SECRET`).
5. **Webhook:** em *WhatsApp › Configuração › Webhook › Editar*:
   - **URL de callback:** `https://app.akyllagestao.com.br/api/webhooks/whatsapp`;
   - **Token de verificação:** o valor de `WHATSAPP_VERIFY_TOKEN` no
     servidor (veja o passo seguinte);
   - depois de verificar, **assine o campo `messages`**.
6. **Pagamento:** cadastre um cartão em *WhatsApp › Configurações de
   pagamento*. A Meta cobra por conversa iniciada.

## No servidor (VPS)

```bash
sudo nano /etc/akylla/akylla.env
```

Deixe assim (sem aspas, um por linha):

```
WHATSAPP_PROVIDER=meta
WHATSAPP_ACCESS_TOKEN=<token permanente do passo 3>
WHATSAPP_APP_SECRET=<chave secreta do passo 4>
WHATSAPP_VERIFY_TOKEN=<o mesmo texto usado no webhook do passo 5>
```

- Se `WHATSAPP_VERIFY_TOKEN` não existir, invente um texto longo e use o
  mesmo valor na Meta.
- Depois de salvar: `sudo systemctl restart akylla-api akylla-worker`.

**Nunca** coloque esses valores no Git, em print ou em mensagem.

## No sistema (por empresa)

1. **Configurar o número:** em Relacionamento › WhatsApp, preencha o
   **Phone Number ID** e o **WABA ID** (os IDs da Meta, não o telefone) e
   o nome exibido. Salve e clique em **Testar conexão**: deve aparecer o
   nome verificado e o número.
2. **Templates:** em WhatsApp › Templates, use **Modelos prontos**:
   adicione e edite se quiser.
   - Depois **crie cada um na Meta** (*WhatsApp Manager › Modelos de
     mensagem*) com o **mesmo nome, idioma e texto**.
   - Quando a Meta aprovar, clique em **Marcar aprovado** no sistema.
   - Editar um template aprovado volta ele para "aguardando aprovação".
3. **Lembrete automático:** em WhatsApp, escolha o template
   `lembrete_agendamento`, que tem 3 variáveis: cliente, serviço e data/hora.
4. **Consentimento:** registre o consentimento na ficha do cliente. Sem
   ele, nada é enviado para aquele cliente.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Aviso "Modo simulação" na tela | `WHATSAPP_PROVIDER` não é `meta` no servidor, ou o serviço não foi reiniciado |
| Teste de conexão falha com 401/190 | token expirado ou inválido (use token de usuário do sistema, não o temporário de 24 h) |
| Teste falha com "Object … does not exist" | Phone Number ID errado (foi digitado o telefone) |
| Mensagem fica "Falhou" | template não aprovado na Meta, nome/texto diferentes, cliente sem WhatsApp ou fora da regra de 24 h |
| Status nunca muda de "Enviada" | webhook não verificado/assinado ou `WHATSAPP_APP_SECRET` diferente do app |
