"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CampaignForm } from "../../../../components/ads/CampaignForm";

function NovaCampanha() {
  const router = useRouter();
  const params = useSearchParams();
  const clientId = params.get("cliente") ?? undefined;
  const clientName = params.get("nome") ?? undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Nova campanha</h2>
          <p className="text-sm text-slate-500">O link com UTM é gerado ao criar, na página da campanha.</p>
        </div>
        <Link href={clientId ? `/clientes/${clientId}` : "/anuncios/campanhas"} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Voltar
        </Link>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <CampaignForm
          clientId={clientId}
          clientName={clientName}
          onSaved={(saved) => router.push(`/anuncios/campanhas/${saved.id}`)}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}

export default function NovaCampanhaPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">Carregando...</p>}>
      <NovaCampanha />
    </Suspense>
  );
}
