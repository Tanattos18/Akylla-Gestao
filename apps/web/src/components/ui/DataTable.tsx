import { Fragment, type KeyboardEvent, type ReactNode } from "react";

export interface Column<T> {
  /** Chave estável da coluna. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Números e moeda: alinhados à direita, com algarismos tabulares. */
  numeric?: boolean;
  /** Rótulo no celular (padrão: o cabeçalho, quando for texto). */
  label?: string;
  /** Some no celular (ex.: colunas secundárias). */
  hideOnMobile?: boolean;
  /** Coluna condicional (ex.: "Ações" só para ADMIN). */
  hidden?: boolean;
  className?: string;
}

/** Linha de totais: valor por chave de coluna (as demais ficam vazias). */
export interface TotalsRow {
  label: string;
  cells: Record<string, ReactNode>;
}

function clickableProps<T>(row: T, onRowClick?: (row: T) => void, rowLabel?: (row: T) => string) {
  if (!onRowClick) return {};
  return {
    tabIndex: 0,
    "aria-label": rowLabel?.(row),
    onClick: () => onRowClick(row),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRowClick(row);
      }
    },
  };
}

/**
 * Tabela padrão (Fase 5 · 5.1, débito D-4): colunas tipadas, moeda à direita,
 * estado vazio, totais, linha expansível e, no celular, cada linha vira um
 * cartão com rótulo + valor. Na impressão sai sempre como tabela.
 */
export function DataTable<T>({
  rows,
  rowKey,
  empty = "Nenhum registro encontrado.",
  title,
  caption,
  totals,
  expanded,
  className = "",
  rowClassName,
  onRowClick,
  rowLabel,
  bare = false,
  columns: allColumns,
}: {
  columns: Column<NoInfer<T>>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  /** Título visível acima da tabela (também serve de legenda). */
  title?: ReactNode;
  /** Legenda só para leitor de tela (quando não há `title`). */
  caption?: string;
  totals?: TotalsRow;
  /** Conteúdo extra abaixo da linha (ex.: itens da comissão); `null` = fechado. */
  expanded?: (row: T) => ReactNode | null;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
  /** Linha clicável (abre o detalhe). Também responde a Enter/Espaço. */
  onRowClick?: (row: T) => void;
  /** Nome acessível da linha clicável (ex.: "Abrir OS 12"). */
  rowLabel?: (row: T) => string;
  /** Sem moldura própria: para tabelas já dentro de um cartão. */
  bare?: boolean;
}) {
  const columns = allColumns.filter((column) => !column.hidden);
  const align = (column: Column<T>) => (column.numeric ? "text-right tabular-nums" : "text-left");
  const mobileLabel = (column: Column<T>) =>
    column.label ?? (typeof column.header === "string" ? column.header : "");
  const accessibleName = caption ?? (typeof title === "string" ? title : undefined);

  return (
    <div className={`${bare ? "" : "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"} ${className}`}>
      {title && (
        <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {title}
        </div>
      )}

      {/* Tela média em diante (e impressão): tabela */}
      <div className="hidden overflow-x-auto md:block print:block">
        <table className="w-full text-sm">
          {accessibleName && <caption className="sr-only">{accessibleName}</caption>}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60 text-xs uppercase text-slate-600">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-4 py-3 font-medium ${align(column)} ${column.className ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const extra = expanded?.(row) ?? null;
              return (
                <Fragment key={rowKey(row)}>
                  <tr
                    className={`border-b border-slate-100 ${onRowClick ? "cursor-pointer hover:bg-slate-50" : ""} ${rowClassName?.(row) ?? ""}`}
                    {...clickableProps(row, onRowClick, rowLabel)}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-3 text-slate-800 ${align(column)} ${column.className ?? ""}`}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                  {extra && (
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <td colSpan={columns.length} className="px-4 py-3">
                        {extra}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-600">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
          {totals && rows.length > 0 && (
            <tfoot>
              <tr className="font-semibold text-slate-900">
                {columns.map((column, index) => (
                  <td key={column.key} className={`px-4 py-3 ${align(column)}`}>
                    {index === 0 ? totals.label : totals.cells[column.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Celular: cartões empilhados */}
      <ul className="divide-y divide-slate-100 md:hidden print:hidden" aria-label={accessibleName}>
        {rows.map((row) => {
          const extra = expanded?.(row) ?? null;
          return (
            <li
              key={rowKey(row)}
              className={`space-y-1.5 p-4 ${onRowClick ? "cursor-pointer hover:bg-slate-50" : ""} ${rowClassName?.(row) ?? ""}`}
              {...clickableProps(row, onRowClick, rowLabel)}
            >
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="flex items-start justify-between gap-3 text-sm">
                    {mobileLabel(column) && (
                      <span className="shrink-0 text-xs font-medium uppercase text-slate-600">
                        {mobileLabel(column)}
                      </span>
                    )}
                    <span className={`text-right text-slate-800 ${column.numeric ? "tabular-nums" : ""}`}>
                      {column.cell(row)}
                    </span>
                  </div>
                ))}
              {extra && <div className="rounded-md bg-slate-50 p-3">{extra}</div>}
            </li>
          );
        })}
        {rows.length === 0 && <li className="p-6 text-center text-sm text-slate-600">{empty}</li>}
        {totals && rows.length > 0 && (
          <li className="space-y-1.5 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-700">{totals.label}</p>
            {columns
              .filter((column) => totals.cells[column.key] !== undefined)
              .map((column) => (
                <div key={column.key} className="flex justify-between gap-3 text-sm font-semibold text-slate-900">
                  <span className="text-xs uppercase text-slate-600">{mobileLabel(column)}</span>
                  <span className="tabular-nums">{totals.cells[column.key]}</span>
                </div>
              ))}
          </li>
        )}
      </ul>
    </div>
  );
}
