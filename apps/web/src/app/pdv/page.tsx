"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { printReceipt } from "../../lib/print";
import { fetchSession, type Session } from "../../lib/session";
import {
  paymentMethodLabels,
  productUnitLabels,
  type CashSessionDto,
  type ClientDto,
  type CompanyModuleDto,
  type Paginated,
  type PaymentMethod,
  type ProductDto,
  type ProfessionalDto,
  type SaleDto,
} from "../../lib/types";
import { Receipt } from "../../components/Receipt";
import { EmitFiscalButton } from "../../components/fiscal/EmitFiscalButton";
import { formatBrl } from "../../lib/format";
import { isFractionalUnit, parseDecimalInput } from "@petflow/shared";
import { SearchSelect } from "../../components/ui/SearchSelect";

interface CartItem {
  productId: string;
  name: string;
  unit: ProductDto["unit"];
  unitPrice: string;
  stock: string;
  quantity: number;
}

function newRequest(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function PdvPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [cashOpen, setCashOpen] = useState<boolean | null>(null);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentNote, setPaymentNote] = useState("");
  const [clientId, setClientId] = useState("");
  // Fase 2 · 2.1: profissional da venda (lista vazia = módulo desativado ou sem cadastro)
  const [professionals, setProfessionals] = useState<ProfessionalDto[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  // Fase 2 · 2.2: crediário (parcelas e 1º vencimento; valores calculados no servidor)
  const [creditEnabled, setCreditEnabled] = useState(true);
  const [installments, setInstallments] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<SaleDto | null>(null);
  const [printNotice, setPrintNotice] = useState<string | null>(null);

  const clientRequestId = useRef<string>(newRequest());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (!session) return;
    api<CashSessionDto>("/api/cash/sessions/current", { redirectOnUnauthorized: false })
      .then(() => setCashOpen(true))
      .catch((err) => setCashOpen(err instanceof ApiError && err.status === 404 ? false : true));
    api<Paginated<ProfessionalDto>>("/api/professionals?status=ACTIVE&pageSize=100", {
      redirectOnUnauthorized: false,
    })
      .then((data) => setProfessionals(data.items))
      .catch(() => setProfessionals([]));
    api<CompanyModuleDto[]>("/api/company-modules", { redirectOnUnauthorized: false })
      .then((mods) => setCreditEnabled(!mods.some((m) => m.module === "CREDIT" && (m.status === "DISABLED" || m.entitled === false))))
      .catch(() => setCreditEnabled(true));
  }, [session]);

  const searchProducts = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const data = await api<Paginated<ProductDto>>(
        `/api/products?status=ACTIVE&pageSize=8&search=${encodeURIComponent(term.trim())}`,
        { redirectOnUnauthorized: false },
      );
      setResults(data.items);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void searchProducts(value);
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  function addToCart(product: ProductDto) {
    setError(null);
    const stock = Number(product.stockQuantity);
    if (stock <= 0) {
      setError(`"${product.name}" sem estoque disponível.`);
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= stock) {
          setError(`Estoque insuficiente para adicionar mais de "${product.name}".`);
          return current;
        }
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          unitPrice: product.salePrice,
          stock: product.stockQuantity,
          quantity: 1,
        },
      ];
    });
  }

  function changeQuantity(productId: string, value: string) {
    const parsed = parseDecimalInput(value);
    setCart((current) =>
      current.map((item) => {
        if (item.productId !== productId) return item;
        // Auditoria (bloco 7): KG/L aceitam fração (até 3 casas); o resto é inteiro
        const fractional = isFractionalUnit(item.unit);
        const minimum = fractional ? 0.001 : 1;
        if (!Number.isFinite(parsed)) return { ...item, quantity: minimum };
        const max = Number(item.stock);
        const rounded = fractional ? Math.round(parsed * 1000) / 1000 : Math.floor(parsed);
        const quantity = Math.min(Math.max(minimum, rounded), Math.max(minimum, max));
        return { ...item, quantity };
      }),
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) => current.filter((item) => item.productId !== productId));
  }

  const subtotal = cart.reduce(
    // Cada linha arredondada ao centavo, igual ao servidor
    (sum, item) => sum + Math.round(Number(item.unitPrice) * item.quantity * 100) / 100,
    0,
  );
  const discountValue = discount.trim() ? parseDecimalInput(discount) : 0;
  const total = Math.max(0, subtotal - (Number.isFinite(discountValue) ? discountValue : 0));

  async function handleFinish(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPrintNotice(null);

    if (cart.length === 0) {
      setError("Adicione ao menos um produto ao carrinho.");
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      setError("Informe um desconto válido.");
      return;
    }
    if (discountValue > subtotal) {
      setError("O desconto não pode ser maior que o subtotal.");
      return;
    }
    if (paymentMethod === "OTHER" && paymentNote.trim().length < 2) {
      setError("Descreva a forma de pagamento usada em \"Outro\".");
      return;
    }
    if (paymentMethod === "CREDIARIO" && !clientId) {
      setError("Venda no crediário exige um cliente com crediário aprovado.");
      return;
    }

    setSaving(true);
    try {
      const sale = await api<SaleDto>("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: isFractionalUnit(item.unit) ? item.quantity.toFixed(3) : String(item.quantity),
          })),
          discount: discountValue > 0 ? discountValue.toFixed(2) : "0",
          paymentMethod,
          paymentNote: paymentMethod === "OTHER" ? paymentNote.trim() : null,
          clientId: clientId || null,
          professionalId: professionalId || null,
          credit: paymentMethod === "CREDIARIO" ? { installments, firstDueDate } : null,
          clientRequestId: clientRequestId.current,
        }),
      });
      setCompletedSale(sale);
      setCart([]);
      setDiscount("");
      setPaymentNote("");
      setClientId("");
      clientRequestId.current = newRequest();
    } catch (err) {
      if (err instanceof ApiError && err.message.includes("Caixa fechado")) {
        setCashOpen(false);
        setError("O caixa está fechado. Abra o caixa para registrar vendas.");
      } else if (err instanceof ApiError && err.status === 409) {
        setError("Esta venda já foi registrada (reenvio detectado). Consulte o histórico de vendas.");
      } else {
        setError(err instanceof ApiError ? err.message : "Falha ao finalizar a venda.");
      }
    } finally {
      setSaving(false);
    }
  }

  function handlePrint(sale: SaleDto) {
    const ok = printReceipt(sale, session?.company.name ?? "Akylla Gestão");
    if (!ok) {
      setPrintNotice("Não foi possível abrir a janela de impressão. Permita pop-ups para este site.");
    } else {
      setPrintNotice(null);
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  if (completedSale) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          Venda registrada com sucesso! Total {formatBrl(completedSale.total)}.
        </div>
        {printNotice && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {printNotice}
          </div>
        )}
        <Receipt sale={completedSale} companyName={session.company.name} company={session.company} />
        <EmitFiscalButton saleId={completedSale.id} types={completedSale.client ? ["NFCE", "NFE"] : ["NFCE"]} isAdmin={session.user.role === "ADMIN"} />
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => handlePrint(completedSale)}
            className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
          >
            Imprimir comprovante
          </button>
          <button
            type="button"
            onClick={() => setCompletedSale(null)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Nova venda
          </button>
          <Link
            href="/vendas"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Ver histórico
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Ponto de venda (PDV)</h2>
          <p className="text-sm text-slate-500">
            Busque por nome, SKU ou código de barras para iniciar a venda.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/vendas"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Histórico de vendas
          </Link>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Início
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {cashOpen === false && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            <strong>Caixa fechado.</strong> Vendas e cancelamentos só podem ser registrados com o
            caixa aberto.
          </span>
          <Link
            href="/caixa"
            className="rounded-md bg-primary-700 px-3 py-1.5 font-medium text-white hover:bg-primary-800"
          >
            Abrir caixa
          </Link>
        </div>
      )}

      <form onSubmit={handleFinish} className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label htmlFor="pdv-search" className="mb-1 block text-sm font-medium text-slate-700">
              Buscar produto
            </label>
            <input
              id="pdv-search"
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Nome, SKU ou código de barras"
              autoFocus
              className={inputClass}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-2 text-xs uppercase text-slate-500">
              {searching ? "Buscando..." : "Resultados"}
            </div>
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {results.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      {product.sku ? `SKU ${product.sku}` : "Sem SKU"} · saldo{" "}
                      {Number(product.stockQuantity)} {productUnitLabels[product.unit]} · {formatBrl(product.salePrice)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={Number(product.stockQuantity) <= 0}
                    className="shrink-0 rounded-md border border-primary-600 px-3 py-1 text-xs font-medium text-primary-800 hover:bg-primary-100 disabled:opacity-40"
                  >
                    {Number(product.stockQuantity) <= 0 ? "Sem saldo" : "Adicionar"}
                  </button>
                </li>
              ))}
              {!results.length && (
                <li className="px-4 py-4 text-center text-sm text-slate-500">
                  {search.trim() ? "Nenhum produto encontrado." : "Digite para buscar produtos."}
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-2 text-xs uppercase text-slate-500">
              Carrinho ({cart.length})
            </div>
            <div className="max-h-72 overflow-y-auto">
              <ul aria-label="Itens no carrinho">
                {cart.map((item) => (
                  <li key={item.productId} className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-600">
                        {formatBrl(item.unitPrice)} × {productUnitLabels[item.unit]}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={isFractionalUnit(item.unit) ? 0.001 : 1}
                      step={isFractionalUnit(item.unit) ? 0.001 : 1}
                      max={Number(item.stock)}
                      value={item.quantity}
                      onChange={(event) => changeQuantity(item.productId, event.target.value)}
                      aria-label={`Quantidade de ${item.name}`}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <span className="w-24 text-right font-medium tabular-nums text-slate-800">
                      {formatBrl(Math.round(Number(item.unitPrice) * item.quantity * 100) / 100)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      aria-label={`Remover ${item.name}`}
                      className="text-xs text-red-700 hover:underline"
                    >
                      Remover
                    </button>
                  </li>
                ))}
                {!cart.length && <li className="px-4 py-6 text-center text-sm text-slate-600">Carrinho vazio.</li>}
              </ul>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="pdv-client" className="mb-1 block text-sm text-slate-700">
                Cliente (opcional)
              </label>
              <SearchSelect<ClientDto>
                id="pdv-client"
                endpoint="/api/clients?status=ACTIVE"
                value={clientId}
                onChange={(id) => setClientId(id)}
                emptyOptionLabel="Venda rápida sem cliente"
                describe={(client) => client.mobile ?? client.phone ?? null}
              />
            </div>
            {professionals.length > 0 && (
              <div className="sm:col-span-2">
                <label htmlFor="pdv-professional" className="mb-1 block text-sm text-slate-700">
                  Profissional / vendedor (comissão)
                </label>
                <select
                  id="pdv-professional"
                  value={professionalId}
                  onChange={(event) => setProfessionalId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Sem comissão</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="pdv-discount" className="mb-1 block text-sm text-slate-700">
                Desconto (R$)
              </label>
              <input
                id="pdv-discount"
                inputMode="decimal"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                placeholder="0,00"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="pdv-payment" className="mb-1 block text-sm text-slate-700">
                Forma de pagamento
              </label>
              <select
                id="pdv-payment"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className={inputClass}
              >
                {(Object.keys(paymentMethodLabels) as PaymentMethod[])
                  .filter((method) => method !== "CREDIARIO" || creditEnabled)
                  .map((method) => (
                    <option key={method} value={method}>
                      {paymentMethodLabels[method]}
                    </option>
                  ))}
              </select>
            </div>
            {paymentMethod === "CREDIARIO" && (
              <>
                <div>
                  <label htmlFor="pdv-installments" className="mb-1 block text-sm text-slate-700">
                    Parcelas
                  </label>
                  <select
                    id="pdv-installments"
                    value={installments}
                    onChange={(event) => setInstallments(Number(event.target.value))}
                    className={inputClass}
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}x de {formatBrl((Math.floor((total / n) * 100) / 100))}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pdv-first-due" className="mb-1 block text-sm text-slate-700">
                    1º vencimento
                  </label>
                  <input
                    id="pdv-first-due"
                    type="date"
                    value={firstDueDate}
                    onChange={(event) => setFirstDueDate(event.target.value)}
                    className={inputClass}
                  />
                </div>
                <p className="text-xs text-slate-600 sm:col-span-2">
                  Parcelas mensais; centavos de diferença vão para a última. O valor não entra no caixa agora:
                  cada parcela entra quando for recebida em Crediário.
                </p>
              </>
            )}
            {paymentMethod === "OTHER" && (
              <div className="sm:col-span-2">
                <label htmlFor="pdv-note" className="mb-1 block text-sm text-slate-700">
                  Descreva a forma de pagamento *
                </label>
                <input
                  id="pdv-note"
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                  placeholder="Ex.: vale, transferência, cheque..."
                  className={inputClass}
                />
              </div>
            )}
          </div>

          <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatBrl(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Desconto</span>
              <span>- {formatBrl((Number.isFinite(discountValue) ? discountValue : 0))}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatBrl(total)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || cart.length === 0 || cashOpen === false}
            className="w-full rounded-md bg-primary-700 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
          >
            {saving ? "Finalizando..." : cashOpen === false ? "Caixa fechado" : "Finalizar venda"}
          </button>
        </div>
      </form>
    </div>
  );
}
