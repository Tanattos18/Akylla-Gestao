import Link from "next/link";

export const metadata = {
  title: "Termos de Uso — Akylla Gestão",
};

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Termos de Uso</h1>
      <p className="mb-8 text-sm text-slate-500">
        Versão 1.0 · Documento de rascunho — sujeito a revisão jurídica antes da
        comercialização.
      </p>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">1. Sobre o serviço</h2>
        <p className="text-sm text-slate-700">
          O Akylla Gestão é um software de gestão para pequenos negócios
          (cadastro de clientes, produtos, estoque, vendas, caixa, contas a
          pagar e a receber, agendamentos e comunicação via WhatsApp). O
          serviço é prestado por assinatura, conforme o plano contratado pela
          empresa.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">2. Conta e responsabilidade</h2>
        <p className="text-sm text-slate-700">
          Você é responsável por manter as credenciais de acesso em sigilo, pelo
          uso do sistema dentro da sua empresa e pelos dados cadastrados. O
          administrador responde pelas ações dos usuários vinculados à sua
          conta.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">3. Limitações do serviço</h2>
        <p className="text-sm text-slate-700">
          O Akylla Gestão não é um ERP completo e não substitui obrigações
          fiscais, contábeis ou legais. O comprovante de venda não é documento
          fiscal. Funcionalidades fora do escopo contratado podem ser
          indisponibilizadas.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">4. Dados e privacidade</h2>
        <p className="text-sm text-slate-700">
          O tratamento de dados pessoais é regido pela nossa Política de
          Privacidade ({" "}
          <Link href="/privacidade" className="text-primary-700 hover:underline">
            ver política
          </Link>
          ). A empresa contratante é responsável pelos dados que cadastra de
          seus clientes.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">5. Cancelamento</h2>
        <p className="text-sm text-slate-700">
          A assinatura pode ser cancelada a qualquer momento, com efeito no fim
          do período vigente. Os dados podem ser exportados antes do
          encerramento; após o prazo de retenção, são eliminados conforme a
          política de privacidade.
        </p>
      </section>

      <p className="text-xs text-slate-500">
        Este é um rascunho técnico para revisão. Não constitui aconselhamento
        jurídico.
      </p>
    </main>
  );
}
