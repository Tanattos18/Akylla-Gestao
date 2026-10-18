import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        <span className="text-lg font-semibold">404</span>
      </div>

      <h1 className="text-base font-semibold text-slate-900">
        Página não encontrada
      </h1>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        O endereço pode estar errado, o item foi removido ou pertence a
        outra empresa.
      </p>

      <Link
        href="/"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        Voltar para o início
      </Link>
    </div>
  );
}
