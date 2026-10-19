import type { WhatsAppTemplateCategory } from "./types";

/**
 * Modelos prontos de WhatsApp para a empresa adicionar e editar. Seguem as
 * regras da Meta: variáveis {{1}}, {{2}}... em sequência, sem variável no
 * início/fim colada a pontuação; promoções (Marketing) oferecem "SAIR".
 * Depois de adicionados, precisam ser aprovados na Meta com o MESMO nome e
 * texto antes de enviar.
 */
export interface WhatsAppTemplatePreset {
  name: string;
  title: string;
  category: WhatsAppTemplateCategory;
  body: string;
  /** O que cada variável recebe, na ordem. */
  variables: string[];
}

export const WHATSAPP_TEMPLATE_PRESETS: WhatsAppTemplatePreset[] = [
  {
    name: "lembrete_agendamento",
    title: "Lembrete de agendamento",
    category: "UTILITY",
    body: "Olá, {{1}}! Passando para lembrar do seu horário de {{2}} em {{3}}. Se precisar remarcar, é só responder esta mensagem.",
    variables: ["nome do cliente", "serviço", "data e hora"],
  },
  {
    name: "confirmacao_pedido",
    title: "Confirmação de pedido",
    category: "UTILITY",
    body: "Olá, {{1}}! Recebemos o seu pedido {{2}} no valor de {{3}}. Obrigado pela preferência!",
    variables: ["nome do cliente", "número do pedido", "valor"],
  },
  {
    name: "ordem_servico_pronta",
    title: "Ordem de serviço pronta",
    category: "UTILITY",
    body: "Olá, {{1}}! A sua ordem de serviço {{2}} está pronta para retirada. Valor total: {{3}}.",
    variables: ["nome do cliente", "número da OS", "valor"],
  },
  {
    name: "orcamento_disponivel",
    title: "Orçamento disponível",
    category: "UTILITY",
    body: "Olá, {{1}}! O orçamento {{2}} ficou em {{3}}. Responda esta mensagem para aprovar ou tirar dúvidas.",
    variables: ["nome do cliente", "número do orçamento", "valor"],
  },
  {
    name: "parcela_a_vencer",
    title: "Parcela a vencer (crediário)",
    category: "UTILITY",
    body: "Olá, {{1}}! A sua parcela de {{2}} vence em {{3}}. Qualquer dúvida, estamos à disposição.",
    variables: ["nome do cliente", "valor da parcela", "data de vencimento"],
  },
  {
    name: "parcela_em_atraso",
    title: "Parcela em atraso (crediário)",
    category: "UTILITY",
    body: "Olá, {{1}}. Consta em aberto a parcela de {{2}} vencida em {{3}}. Se já pagou, por favor desconsidere esta mensagem.",
    variables: ["nome do cliente", "valor da parcela", "data de vencimento"],
  },
  {
    name: "assinatura_renovacao",
    title: "Renovação de assinatura",
    category: "UTILITY",
    body: "Olá, {{1}}! A sua assinatura do plano {{2}} vence em {{3}}. Fale com a gente para renovar.",
    variables: ["nome do cliente", "plano", "data de vencimento"],
  },
  {
    name: "pos_venda",
    title: "Agradecimento pós-venda",
    category: "MARKETING",
    body: "Olá, {{1}}! Obrigado por comprar na {{2}}. Conte pra gente como foi a sua experiência. Para não receber mais mensagens, responda SAIR.",
    variables: ["nome do cliente", "nome da empresa"],
  },
  {
    name: "aniversario_cliente",
    title: "Feliz aniversário",
    category: "MARKETING",
    body: "Feliz aniversário, {{1}}! Para comemorar, você tem {{2}} de desconto na próxima compra até {{3}}. Para não receber promoções, responda SAIR.",
    variables: ["nome do cliente", "desconto", "data limite"],
  },
  {
    name: "promocao_semana",
    title: "Promoção da semana",
    category: "MARKETING",
    body: "Olá, {{1}}! Nesta semana: {{2}}. Válido até {{3}}. Para não receber promoções, responda SAIR.",
    variables: ["nome do cliente", "oferta", "data limite"],
  },
];
