import { expect, test, type Page } from "@playwright/test";

/**
 * Fluxos principais no navegador (Fase 6 · 6.2). Rodam em sequência na
 * empresa criada pelo global-setup.
 */

const email = () => process.env.E2E_EMAIL ?? "";
const password = () => process.env.E2E_PASSWORD ?? "";

async function signIn(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/login", { data: { email: email(), password: password() } });
  expect(response.ok()).toBe(true);
}

test.describe.configure({ mode: "serial" });

test("1. login pelo formulário leva ao painel", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email());
  await page.getByLabel("Senha").fill(password());
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: process.env.E2E_COMPANY })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("2. criar cliente e vê-lo na lista", async ({ page }) => {
  await signIn(page);
  await page.goto("/clientes");
  await page.locator("#client-name").fill("Maria E2E");
  await page.locator("#client-mobile").fill("11987654321");
  await page.getByRole("button", { name: /^(Cadastrar|Criar|Salvar)/ }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Cliente criado." })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Maria E2E" })).toBeVisible();
});

test("3. abrir caixa, vender, emitir NFC-e (simulada) e fechar sem diferença", async ({ page }) => {
  await signIn(page);
  const product = await page.request.post("/api/products", { data: { name: "Produto E2E", salePrice: "25.00" } });
  expect(product.ok()).toBe(true);
  const { id } = (await product.json()) as { id: string };
  expect((await page.request.post("/api/stock/entries", { data: { productId: id, quantity: "10" } })).ok()).toBe(true);
  const fiscal = await page.request.put("/api/fiscal/config", {
    data: { provider: "mock", cnpj: "11.222.333/0001-81", active: true },
  });
  expect(fiscal.ok()).toBe(true);

  // Abrir caixa
  await page.goto("/caixa");
  await page.getByRole("button", { name: "Abrir caixa" }).click();
  await page.locator("#open-amount").fill("100");
  await page.getByRole("button", { name: "Confirmar abertura" }).click();
  await expect(page.getByRole("link", { name: "Fechar caixa" })).toBeVisible();

  // Vender no PDV
  await page.goto("/pdv");
  await page.locator("#pdv-search").fill("Produto E2E");
  await page.getByRole("button", { name: "Adicionar" }).first().click();
  await page.locator("#pdv-payment").selectOption("CASH");
  await page.getByRole("button", { name: "Finalizar venda" }).click();
  await expect(page.getByText("Comprovante de venda")).toBeVisible();

  // Nota fiscal pela emissora simulada
  await page.getByRole("button", { name: "Emitir NFC-e" }).click();
  await expect(page.getByRole("status").filter({ hasText: /NFC-e nº \d+ autorizada/ })).toBeVisible();

  // Fechar caixa: esperado 100 + 25 = 125
  await page.goto("/caixa/fechar");
  await expect(page.getByText("R$ 125.00")).toBeVisible();
  await page.locator("#counted").fill("125");
  await page.getByRole("button", { name: "Confirmar fechamento" }).click();
  await expect(page.getByRole("heading", { name: "Caixa fechado" })).toBeVisible();
  const difference = page.getByText("Diferença").locator("..");
  await expect(difference).toContainText("R$ 0.00");
});

test("4. importar CSV: simular, importar e ver o produto", async ({ page }) => {
  await signIn(page);
  await page.goto("/importacoes");
  await page.getByRole("button", { name: "Produtos", exact: true }).click();
  await page.getByLabel("Arquivo CSV para importar").setInputFiles({
    name: "produtos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("nome;preco_venda\nCaneta E2E;3,50\n", "utf8"),
  });

  await page.getByRole("button", { name: "Simular importação" }).click();
  await expect(page.getByText("Simulação concluída — nada foi gravado.")).toBeVisible();
  await expect(page.getByText("1 criada(s)")).toBeVisible();

  await page.getByLabel("Simular (validar sem gravar nada)").uncheck();
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText("Importação concluída.")).toBeVisible();

  await page.goto("/produtos");
  await expect(page.getByRole("cell", { name: "Caneta E2E" })).toBeVisible();
});

test("5. rotas protegidas sem sessão voltam ao login", async ({ page }) => {
  await page.goto("/vendas");
  await expect(page).toHaveURL(/\/login$/);
});
