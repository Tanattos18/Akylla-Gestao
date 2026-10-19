/**
 * Dados de demonstração por segmento (Fase 7 · 7.5). O roteiro de criação
 * (vendas, caixa, agenda, assinaturas, WhatsApp) é o mesmo para todos; só os
 * dados mudam. Restrições do roteiro: ≥ 13 produtos, exatamente 8 serviços
 * e 4 planos (os índices são usados nas vendas e agendamentos de exemplo).
 */

export type ProductUnitRow = "UNIDADE" | "KG" | "PACOTE" | "L" | "ML" | "CAIXA";

export interface SeedProduct {
  name: string;
  category: string;
  supplier: string;
  unit: ProductUnitRow;
  cost: number;
  price: number;
  final: number;
  min: number;
  description: string | null;
}

export interface SeedDataset {
  /** Nome comercial usado nos textos (WhatsApp, e-mail do membro) */
  brand: string;
  memberEmail: string;
  segment: "COMERCIO" | "SERVICOS" | "HIBRIDO";
  categories: Array<{ name: string; description: string }>;
  suppliers: Array<{ name: string; document: string; email: string; phone: string }>;
  products: SeedProduct[];
  services: Array<{ name: string; durationMinutes: number; price: number; description: string }>;
  plans: Array<{ name: string; price: number; durationDays: number; description: string }>;
  reminderBody: string;
  promo: { name: string; body: string };
  /** Texto do motivo de cancelamento de assinatura no exemplo */
  subscriptionCancelReason: string;
}

export const COMERCIO: SeedDataset = {
  brand: "Empório Central",
  memberEmail: "atendente@emporiocentral.test",
  segment: "COMERCIO",
  categories: [
    { name: "Mercearia", description: "Grãos, massas, enlatados e temperos" },
    { name: "Bebidas", description: "Sucos, refrigerantes, águas e cafés" },
    { name: "Limpeza", description: "Produtos de limpeza da casa" },
    { name: "Higiene Pessoal", description: "Sabonetes, cremes e cuidados" },
    { name: "Utilidades", description: "Utensílios e itens para casa" },
    { name: "Papelaria", description: "Cadernos, canetas e material escolar" },
  ],
  suppliers: [
    { name: "Atacadão Paulista", document: "12.345.678/0001-90", email: "vendas@atacadaopaulista.com.br", phone: "(11) 3456-7890" },
    { name: "Distribuidora Bom Gosto", document: "98.765.432/0001-11", email: "comercial@bomgosto.com.br", phone: "(11) 3555-1234" },
    { name: "Limpa Bem Distribuição", document: "45.678.912/0001-05", email: "pedidos@limpabem.com.br", phone: "(21) 3333-4444" },
    { name: "Casa & Cia Utilidades", document: "32.109.876/0001-77", email: "contato@casaecia.com.br", phone: "(31) 3222-8899" },
    { name: "Papelaria Atlas", document: "77.888.999/0001-30", email: "atlas@papelariaatlas.com.br", phone: "(41) 3111-7788" },
  ],
  products: [
    { name: "Arroz Tipo 1 5kg", category: "Mercearia", supplier: "Atacadão Paulista", unit: "PACOTE", cost: 21.9, price: 29.9, final: 30, min: 10, description: "Arroz agulhinha tipo 1" },
    { name: "Feijão Carioca 1kg", category: "Mercearia", supplier: "Atacadão Paulista", unit: "PACOTE", cost: 6.2, price: 8.99, final: 40, min: 15, description: null },
    { name: "Café Torrado 500g", category: "Bebidas", supplier: "Distribuidora Bom Gosto", unit: "PACOTE", cost: 13.5, price: 19.9, final: 25, min: 10, description: "Café tradicional moído" },
    { name: "Azeite Extra Virgem 500ml", category: "Mercearia", supplier: "Distribuidora Bom Gosto", unit: "UNIDADE", cost: 26, price: 39.9, final: 12, min: 5, description: null },
    { name: "Macarrão Espaguete 500g", category: "Mercearia", supplier: "Atacadão Paulista", unit: "PACOTE", cost: 3.1, price: 4.99, final: 50, min: 15, description: null },
    { name: "Molho de Tomate 340g", category: "Mercearia", supplier: "Atacadão Paulista", unit: "UNIDADE", cost: 2.2, price: 3.79, final: 45, min: 15, description: null },
    { name: "Suco de Uva Integral 1L", category: "Bebidas", supplier: "Distribuidora Bom Gosto", unit: "UNIDADE", cost: 9.9, price: 15.9, final: 20, min: 8, description: null },
    { name: "Água Mineral 1,5L", category: "Bebidas", supplier: "Distribuidora Bom Gosto", unit: "UNIDADE", cost: 1.6, price: 3.49, final: 60, min: 24, description: null },
    { name: "Refrigerante Cola 2L", category: "Bebidas", supplier: "Distribuidora Bom Gosto", unit: "UNIDADE", cost: 6.5, price: 10.9, final: 30, min: 12, description: null },
    { name: "Detergente 500ml", category: "Limpeza", supplier: "Limpa Bem Distribuição", unit: "UNIDADE", cost: 1.5, price: 2.99, final: 48, min: 20, description: null },
    { name: "Sabão em Pó 1,6kg", category: "Limpeza", supplier: "Limpa Bem Distribuição", unit: "CAIXA", cost: 14.9, price: 22.9, final: 18, min: 6, description: null },
    { name: "Água Sanitária 2L", category: "Limpeza", supplier: "Limpa Bem Distribuição", unit: "UNIDADE", cost: 4.2, price: 6.99, final: 25, min: 10, description: null },
    { name: "Esponja Multiuso (3 un)", category: "Limpeza", supplier: "Limpa Bem Distribuição", unit: "PACOTE", cost: 2.9, price: 5.49, final: 35, min: 12, description: null },
    { name: "Sabonete Hidratante 90g", category: "Higiene Pessoal", supplier: "Limpa Bem Distribuição", unit: "UNIDADE", cost: 1.4, price: 2.79, final: 60, min: 20, description: null },
    { name: "Creme Dental 90g", category: "Higiene Pessoal", supplier: "Limpa Bem Distribuição", unit: "UNIDADE", cost: 3.2, price: 5.99, final: 40, min: 15, description: null },
    { name: "Papel Higiênico (12 rolos)", category: "Higiene Pessoal", supplier: "Atacadão Paulista", unit: "PACOTE", cost: 14, price: 21.9, final: 22, min: 8, description: null },
    { name: "Garrafa Térmica 1L", category: "Utilidades", supplier: "Casa & Cia Utilidades", unit: "UNIDADE", cost: 29, price: 49.9, final: 8, min: 3, description: null },
    { name: "Pote Hermético 1,2L", category: "Utilidades", supplier: "Casa & Cia Utilidades", unit: "UNIDADE", cost: 9.5, price: 17.9, final: 15, min: 5, description: null },
    { name: "Pilha AA (4 un)", category: "Utilidades", supplier: "Casa & Cia Utilidades", unit: "PACOTE", cost: 8.9, price: 15.9, final: 2, min: 6, description: "Pilha alcalina" },
    { name: "Caderno 10 Matérias", category: "Papelaria", supplier: "Papelaria Atlas", unit: "UNIDADE", cost: 14, price: 24.9, final: 16, min: 6, description: null },
    { name: "Caneta Esferográfica Azul", category: "Papelaria", supplier: "Papelaria Atlas", unit: "UNIDADE", cost: 0.9, price: 2.5, final: 80, min: 30, description: null },
    { name: "Fita Adesiva 45mm", category: "Papelaria", supplier: "Papelaria Atlas", unit: "UNIDADE", cost: 3.5, price: 6.9, final: 1, min: 5, description: null },
  ],
  services: [
    { name: "Entrega em domicílio", durationMinutes: 30, price: 8, description: "Até 5 km da loja" },
    { name: "Montagem de cesta básica", durationMinutes: 45, price: 15, description: "Montagem e embalagem" },
    { name: "Embrulho para presente", durationMinutes: 15, price: 5, description: "Papel e laço" },
    { name: "Cópia e impressão (lote)", durationMinutes: 20, price: 10, description: "Até 50 páginas" },
    { name: "Plastificação", durationMinutes: 15, price: 6, description: "Documento até A4" },
    { name: "Recarga de celular", durationMinutes: 10, price: 2, description: "Taxa de serviço" },
    { name: "Encomenda especial", durationMinutes: 30, price: 0, description: "Produto sob encomenda" },
    { name: "Retirada agendada", durationMinutes: 15, price: 0, description: "Pedido separado para retirada" },
  ],
  plans: [
    { name: "Cesta Mensal Essencial", price: 189.9, durationDays: 30, description: "Cesta de mercearia entregue todo mês" },
    { name: "Clube do Café", price: 79.9, durationDays: 30, description: "2 pacotes de café por mês" },
    { name: "Kit Limpeza Mensal", price: 99.9, durationDays: 30, description: "Itens de limpeza para a casa" },
    { name: "Material Escolar Mensal", price: 59.9, durationDays: 30, description: "Reposição de papelaria" },
  ],
  reminderBody: "Olá {{1}}! Lembramos do seu horário de {{2}} amanhã. Até lá! — Empório Central",
  promo: {
    name: "promocao_semana",
    body: "Olá {{1}}! Ofertas da semana no Empório Central com até 15% de desconto. Responda SAIR para não receber mais promoções.",
  },
  subscriptionCancelReason: "Cliente mudou de bairro",
};

export const SERVICOS: SeedDataset = {
  brand: "Studio Beleza",
  memberEmail: "atendente@studiobeleza.test",
  segment: "SERVICOS",
  categories: [
    { name: "Cabelo", description: "Shampoos, máscaras e finalizadores" },
    { name: "Unhas", description: "Esmaltes e cuidados" },
    { name: "Pele", description: "Hidratantes e protetores" },
    { name: "Maquiagem", description: "Bases, batons e acessórios" },
    { name: "Acessórios", description: "Escovas, pentes e presilhas" },
    { name: "Kits", description: "Kits de presente" },
  ],
  suppliers: [
    { name: "Distribuidora Belle", document: "12.345.678/0001-90", email: "vendas@belle.com.br", phone: "(11) 3456-7890" },
    { name: "Cosméticos Aurora", document: "98.765.432/0001-11", email: "comercial@aurora.com.br", phone: "(11) 3555-1234" },
    { name: "Nail Pro", document: "45.678.912/0001-05", email: "pedidos@nailpro.com.br", phone: "(21) 3333-4444" },
    { name: "Derma Brasil", document: "32.109.876/0001-77", email: "contato@dermabrasil.com.br", phone: "(31) 3222-8899" },
    { name: "Acessórios Glam", document: "77.888.999/0001-30", email: "glam@glam.com.br", phone: "(41) 3111-7788" },
  ],
  products: [
    { name: "Shampoo Reconstrução 300ml", category: "Cabelo", supplier: "Distribuidora Belle", unit: "UNIDADE", cost: 28, price: 49.9, final: 12, min: 4, description: null },
    { name: "Máscara Hidratação 250g", category: "Cabelo", supplier: "Distribuidora Belle", unit: "UNIDADE", cost: 35, price: 62.9, final: 10, min: 4, description: null },
    { name: "Óleo Finalizador 60ml", category: "Cabelo", supplier: "Cosméticos Aurora", unit: "UNIDADE", cost: 22, price: 39.9, final: 9, min: 3, description: null },
    { name: "Leave-in Termoprotetor 200ml", category: "Cabelo", supplier: "Cosméticos Aurora", unit: "UNIDADE", cost: 24, price: 44.9, final: 8, min: 3, description: null },
    { name: "Esmalte Cremoso", category: "Unhas", supplier: "Nail Pro", unit: "UNIDADE", cost: 3.9, price: 8.9, final: 40, min: 15, description: null },
    { name: "Base Fortalecedora", category: "Unhas", supplier: "Nail Pro", unit: "UNIDADE", cost: 6.5, price: 14.9, final: 18, min: 6, description: null },
    { name: "Óleo de Cutícula 15ml", category: "Unhas", supplier: "Nail Pro", unit: "UNIDADE", cost: 5, price: 12.9, final: 15, min: 5, description: null },
    { name: "Hidratante Facial 50g", category: "Pele", supplier: "Derma Brasil", unit: "UNIDADE", cost: 32, price: 59.9, final: 7, min: 3, description: null },
    { name: "Protetor Solar FPS 50", category: "Pele", supplier: "Derma Brasil", unit: "UNIDADE", cost: 38, price: 69.9, final: 6, min: 3, description: null },
    { name: "Água Micelar 200ml", category: "Pele", supplier: "Derma Brasil", unit: "UNIDADE", cost: 19, price: 34.9, final: 11, min: 4, description: null },
    { name: "Batom Matte", category: "Maquiagem", supplier: "Cosméticos Aurora", unit: "UNIDADE", cost: 14, price: 29.9, final: 14, min: 5, description: null },
    { name: "Base Líquida 30ml", category: "Maquiagem", supplier: "Cosméticos Aurora", unit: "UNIDADE", cost: 29, price: 54.9, final: 2, min: 3, description: null },
    { name: "Escova Raquete", category: "Acessórios", supplier: "Acessórios Glam", unit: "UNIDADE", cost: 18, price: 34.9, final: 8, min: 3, description: null },
    { name: "Kit Presente Spa", category: "Kits", supplier: "Distribuidora Belle", unit: "CAIXA", cost: 65, price: 119.9, final: 5, min: 2, description: "Sais, óleo e hidratante" },
  ],
  services: [
    { name: "Corte feminino", durationMinutes: 60, price: 90, description: "Lavagem, corte e finalização" },
    { name: "Escova", durationMinutes: 45, price: 60, description: "Escova modelada" },
    { name: "Manicure", durationMinutes: 40, price: 35, description: "Cutilagem e esmaltação" },
    { name: "Pedicure", durationMinutes: 45, price: 40, description: "Cutilagem e esmaltação" },
    { name: "Coloração", durationMinutes: 120, price: 180, description: "Raiz ou global" },
    { name: "Design de sobrancelha", durationMinutes: 30, price: 45, description: "Com pinça e linha" },
    { name: "Hidratação capilar", durationMinutes: 50, price: 85, description: "Tratamento com máscara" },
    { name: "Dia da noiva", durationMinutes: 300, price: 650, description: "Cabelo, maquiagem e unhas" },
  ],
  plans: [
    { name: "Pacote Escova Semanal", price: 199.9, durationDays: 30, description: "4 escovas por mês" },
    { name: "Mãos e Pés Mensal", price: 249.9, durationDays: 30, description: "4 sessões de manicure e pedicure" },
    { name: "Clube Hidratação", price: 149.9, durationDays: 30, description: "2 hidratações por mês" },
    { name: "Sobrancelha Sempre Feita", price: 79.9, durationDays: 30, description: "2 designs por mês" },
  ],
  reminderBody: "Olá {{1}}! Lembramos do seu horário de {{2}} amanhã. Até lá! — Studio Beleza",
  promo: {
    name: "promocao_hidratacao",
    body: "Olá {{1}}! Esta semana a hidratação capilar está com 15% de desconto no Studio Beleza. Responda SAIR para não receber mais promoções.",
  },
  subscriptionCancelReason: "Cliente relatou mudança de rotina",
};

export const ALIMENTACAO: SeedDataset = {
  brand: "Padaria Pão Quente",
  memberEmail: "atendente@paoquente.test",
  segment: "COMERCIO",
  categories: [
    { name: "Pães", description: "Pães de fabricação própria" },
    { name: "Confeitaria", description: "Bolos, tortas e doces" },
    { name: "Salgados", description: "Salgados assados e fritos" },
    { name: "Frios e Laticínios", description: "Queijos, presuntos e iogurtes" },
    { name: "Bebidas", description: "Cafés, sucos e refrigerantes" },
    { name: "Mercearia", description: "Itens de conveniência" },
  ],
  suppliers: [
    { name: "Moinho Bom Trigo", document: "12.345.678/0001-90", email: "vendas@bomtrigo.com.br", phone: "(11) 3456-7890" },
    { name: "Laticínios Serra Azul", document: "98.765.432/0001-11", email: "comercial@serraazul.com.br", phone: "(11) 3555-1234" },
    { name: "Frigorífico Boa Mesa", document: "45.678.912/0001-05", email: "pedidos@boamesa.com.br", phone: "(21) 3333-4444" },
    { name: "Bebidas Rio Claro", document: "32.109.876/0001-77", email: "contato@rioclaro.com.br", phone: "(31) 3222-8899" },
    { name: "Embalagens Pack", document: "77.888.999/0001-30", email: "pack@pack.com.br", phone: "(41) 3111-7788" },
  ],
  products: [
    { name: "Pão Francês (kg)", category: "Pães", supplier: "Moinho Bom Trigo", unit: "KG", cost: 7.5, price: 16.9, final: 40, min: 15, description: "Assado a cada 2 horas" },
    { name: "Pão de Forma Caseiro", category: "Pães", supplier: "Moinho Bom Trigo", unit: "UNIDADE", cost: 4.5, price: 11.9, final: 20, min: 8, description: null },
    { name: "Pão de Queijo (kg)", category: "Salgados", supplier: "Laticínios Serra Azul", unit: "KG", cost: 18, price: 42.9, final: 12, min: 5, description: null },
    { name: "Bolo de Cenoura com Chocolate", category: "Confeitaria", supplier: "Moinho Bom Trigo", unit: "UNIDADE", cost: 14, price: 32.9, final: 8, min: 3, description: null },
    { name: "Sonho de Creme", category: "Confeitaria", supplier: "Moinho Bom Trigo", unit: "UNIDADE", cost: 2.2, price: 6.5, final: 30, min: 10, description: null },
    { name: "Coxinha de Frango", category: "Salgados", supplier: "Frigorífico Boa Mesa", unit: "UNIDADE", cost: 2.5, price: 7.5, final: 40, min: 15, description: null },
    { name: "Esfiha de Carne", category: "Salgados", supplier: "Frigorífico Boa Mesa", unit: "UNIDADE", cost: 2.3, price: 6.9, final: 35, min: 12, description: null },
    { name: "Café Expresso", category: "Bebidas", supplier: "Bebidas Rio Claro", unit: "UNIDADE", cost: 1.2, price: 5.5, final: 100, min: 30, description: null },
    { name: "Suco de Laranja 300ml", category: "Bebidas", supplier: "Bebidas Rio Claro", unit: "UNIDADE", cost: 2.8, price: 8.9, final: 40, min: 15, description: null },
    { name: "Queijo Muçarela (kg)", category: "Frios e Laticínios", supplier: "Laticínios Serra Azul", unit: "KG", cost: 32, price: 54.9, final: 10, min: 4, description: null },
    { name: "Presunto Cozido (kg)", category: "Frios e Laticínios", supplier: "Frigorífico Boa Mesa", unit: "KG", cost: 26, price: 44.9, final: 9, min: 4, description: null },
    { name: "Iogurte Natural 170g", category: "Frios e Laticínios", supplier: "Laticínios Serra Azul", unit: "UNIDADE", cost: 2.1, price: 4.49, final: 30, min: 12, description: null },
    { name: "Leite Integral 1L", category: "Mercearia", supplier: "Laticínios Serra Azul", unit: "UNIDADE", cost: 4.3, price: 6.49, final: 48, min: 18, description: null },
    { name: "Manteiga 200g", category: "Frios e Laticínios", supplier: "Laticínios Serra Azul", unit: "UNIDADE", cost: 8.9, price: 14.9, final: 2, min: 6, description: null },
    { name: "Torta Holandesa (fatia)", category: "Confeitaria", supplier: "Moinho Bom Trigo", unit: "UNIDADE", cost: 5, price: 14.9, final: 16, min: 6, description: null },
  ],
  services: [
    { name: "Encomenda de bolo", durationMinutes: 30, price: 0, description: "Retirada no horário combinado" },
    { name: "Coffee break (até 20 pessoas)", durationMinutes: 120, price: 380, description: "Montagem no local" },
    { name: "Kit festa (salgados e doces)", durationMinutes: 60, price: 250, description: "100 salgados + 50 doces" },
    { name: "Bolo personalizado", durationMinutes: 45, price: 150, description: "Decoração temática" },
    { name: "Cesta de café da manhã", durationMinutes: 40, price: 129, description: "Entrega até 9h" },
    { name: "Entrega em domicílio", durationMinutes: 30, price: 7, description: "Até 3 km" },
    { name: "Fatiamento de frios", durationMinutes: 10, price: 0, description: "Cortesia" },
    { name: "Mesa de doces (evento)", durationMinutes: 180, price: 520, description: "Montagem e recolha" },
  ],
  plans: [
    { name: "Pão Nosso de Cada Dia", price: 129.9, durationDays: 30, description: "Pão francês diário (500 g)" },
    { name: "Café da Manhã Semanal", price: 199.9, durationDays: 30, description: "Cesta toda sexta" },
    { name: "Clube do Bolo", price: 89.9, durationDays: 30, description: "2 bolos por mês" },
    { name: "Lanche da Empresa", price: 349.9, durationDays: 30, description: "Coffee break semanal" },
  ],
  reminderBody: "Olá {{1}}! Lembramos da sua encomenda de {{2}} amanhã. Até lá! — Padaria Pão Quente",
  promo: {
    name: "promocao_fornada",
    body: "Olá {{1}}! Fornada especial hoje na Padaria Pão Quente: pão de queijo com 15% de desconto. Responda SAIR para não receber mais promoções.",
  },
  subscriptionCancelReason: "Cliente viajou por um mês",
};
