# Nota fiscal por integração — regras do módulo (Fase 3)

> Módulo `FISCAL`. O Akylla **não tem emissor próprio**: as notas são
> emitidas por uma **integradora autorizada** (NFE.io, Focus NFe, Spedy…),
> como prometido no site ("nota fiscal por integração"). Hoje está pronta a
> **emissora simulada** (sem valor fiscal). A integradora real depende de
> contrato, conta e homologação; ver "Para emitir de verdade".

## Referências estudadas

- **FinOpenPOS** (MIT): referência de layout (chave de acesso, séries,
  ambientes). É um **emissor próprio** (fala direto com a SEFAZ), o que o
  roteiro proíbe, então **não foi integrado**. A extração de certificado de
  lá **não foi reaproveitada**: ela executa `openssl` com a senha do PFX na
  linha de comando (`-passin pass:…`, o que permite injeção de comando e
  expõe a senha no processo) e usa um caminho fixo em `/tmp`. Aqui o PFX é
  validado pelo próprio Node (`tls.createSecureContext`), sem processo
  externo.
- SDK oficial da NFE.io (`nfe/client-nodejs`, MIT): candidato para a
  primeira integradora real.

## Configuração (ADMIN, `/fiscal`)

| Campo | Regra |
|---|---|
| Emissora | `mock` (autoriza), `mock-async` (pendente até o webhook), `mock-reject` (rejeita) ou uma integradora real |
| Ambiente | homologação (padrão) ou produção |
| CNPJ do emitente | 14 dígitos (aceita máscara); obrigatório para ativar |
| Séries | NFC-e e NF-e (1–999) |
| Token da API | **cifrado** (AES-256-GCM, `FISCAL_ENCRYPTION_KEY`); a API só informa `hasApiToken` |
| Certificado A1 | `.pfx/.p12` até 64 KB. Senha validada pelo Node; vencido → 400. Arquivo e senha **cifrados** no banco; mostra titular e validade |

Integradora real só ativa com token **e** certificado. Sem
`FISCAL_ENCRYPTION_KEY`, o servidor recusa gravar segredo (503) e nunca
grava em claro. Trocar a chave invalida os segredos já gravados.

## Emissão (`POST /api/fiscal/documents`, ADMIN)

| Origem | Tipos | Regras |
|---|---|---|
| Venda **concluída** | NFC-e (consumidor), NF-e | NF-e exige cliente com CPF |
| OS **concluída** | NFS-e | — |

- Sem configuração ativa → **400** explícito; nunca falha em silêncio.
- Já existe nota em processamento ou autorizada para a mesma origem e tipo
  → 409. Depois de uma **rejeição**, pode tentar de novo (novo número).
- **Numeração** sequencial por empresa/tipo/série, com a configuração
  travada (`FOR UPDATE`).
- A chamada à integradora é feita **fora** da transação; falha de rede →
  documento `REJECTED` com o motivo (nada fica "pendurado").
- **Simulada:** chave de 44 dígitos no layout oficial (cUF 35, AAMM, CNPJ,
  modelo 65/55, série, número, tpEmis, código, **DV módulo 11**) e XML
  marcado "**SEM VALOR FISCAL**". NFS-e simulada não tem chave de 44
  dígitos.

## Cancelamento

- Só nota **autorizada**, com justificativa de **15 a 255** caracteres
  (exigência da SEFAZ). Recusa da integradora → 409 com o motivo.
- **Venda com nota em processamento ou autorizada não pode ser cancelada**
  (409): cancela-se a nota primeiro. Isso evita a venda cancelada com nota
  válida.

## Webhook (`POST /api/webhooks/fiscal`, público)

- Assinatura `x-fiscal-signature: sha256=<hex>` =
  HMAC-SHA256(`FISCAL_WEBHOOK_SECRET`, `<x-fiscal-timestamp>.<corpo cru>`),
  comparada em **tempo constante**.
- `x-fiscal-timestamp` com mais de **5 min** de diferença → 403
  (anti-replay). **Sem segredo configurado → 403** (fail-closed).
- **Idempotente:** só aplica transições válidas (PENDENTE → AUTORIZADA ou
  REJEITADA; AUTORIZADA → CANCELADA). Evento repetido ou documento
  desconhecido → 200 `{applied: false}`.

## Telas

- `/fiscal`: configuração (ADMIN), certificado e lista de notas (tipo,
  situação, origem, chave/motivo, XML, cancelar).
- Botão **Emitir NFC-e / NF-e** no comprovante do PDV e no detalhe da
  venda; **Emitir NFS-e** na OS concluída. Aparece só para ADMIN com a
  emissão ativa, marcado "simulada — sem valor fiscal" quando for o caso.

## Para emitir de verdade (pendências do proprietário)

1. **Escolher e contratar a integradora** (NFE.io, Focus NFe, Spedy…):
   comparar preço por nota, cobertura de NFS-e nos municípios de atuação e
   webhook.
2. **Implementar o adaptador** (`FiscalProvider`) dessa integradora e
   homologar: emitir e cancelar em homologação antes de produção.
3. **Cadastro fiscal dos produtos e da empresa**, com o contador: NCM,
   CFOP, CST/CSOSN, origem, regime tributário e inscrição estadual e
   municipal. **Ainda não existem** no cadastro de produtos; serão
   adicionados junto com a integradora escolhida, porque cada uma exige um
   conjunto.
4. Certificado digital **A1 ICP-Brasil** da empresa e CSC/Token da NFC-e
   na SEFAZ do estado.
5. Configurar `FISCAL_ENCRYPTION_KEY` e `FISCAL_WEBHOOK_SECRET` no
   servidor.

## Fora do escopo desta entrega

- Contingência offline (NFC-e), carta de correção, inutilização de
  numeração e manifestação do destinatário.
- DANFE em PDF próprio: a integradora real fornece o link (`danfeUrl`).
- Clientes pessoa jurídica na NF-e: o cadastro de cliente só tem CPF hoje.
