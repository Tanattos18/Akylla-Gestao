"use client";

/** Paginação simples (auditoria bloco 5): "1–20 de 345" + anterior/próxima. */
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  label = "registros",
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <span>
        {total === 0 ? `Nenhum ${label.replace(/s$/, "")}` : `${from}–${to} de ${total} ${label}`}
      </span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
        >
          Anterior
        </button>
        <span aria-live="polite">
          Página {page} de {pages}
        </span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
        >
          Próxima
        </button>
      </span>
    </nav>
  );
}
