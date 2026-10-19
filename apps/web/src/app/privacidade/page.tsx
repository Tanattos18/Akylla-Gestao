export const metadata = {
  title: "Política de Privacidade — Akylla Gestão",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Política de Privacidade</h1>
      <p className="mb-8 text-sm text-slate-500">
        Versão 1.0 · Documento de rascunho — sujeito a revisão jurídica antes da
        comercialização. Contato: contato@akyllagestao.com.br (Encarregado de Dados).
      </p>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">1. Dados que tratamos</h2>
        <p className="text-sm text-slate-700">
          Tratamos dados da empresa contratante (nome, razão social, contato) e
          dados de clientes cadastrados pela empresa (nome, telefone, e-mail,
          CPF, endereço). Também coletamos dados de acesso e uso (IP, navegador,
          sessão) para segurança e operação.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">2. Finalidades</h2>
        <p className="text-sm text-slate-700">
          Os dados são usados para operar o serviço de gestão, autenticar
          usuários, gerar relatórios e comprovantes, enviar comunicações
          autorizadas e cumprir obrigações legais. Não usamos dados de clientes
          para fins de publicidade da Akylla sem consentimento.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">3. Bases legais</h2>
        <p className="text-sm text-slate-700">
          O tratamento se baseia na execução do contrato, no legítimo interesse,
          no cumprimento de obrigação legal e, quando aplicável, no
          consentimento registrado.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">4. Direitos do titular</h2>
        <p className="text-sm text-slate-700">
          O titular pode solicitar acesso, correção, portabilidade e
          anonimização/exclusão dos seus dados, observadas as hipóteses legais
          de retenção. Solicitações podem ser feitas pelo canal{" "}
          <span className="font-medium">contato@akyllagestao.com.br</span>.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">5. Retenção</h2>
        <p className="text-sm text-slate-700">
          Dados de negócio necessários para contabilidade e auditoria são
          mantidos pelo prazo legal. Sessões expiradas são removidas
          periodicamente. Backups são retidos por prazo definido e expiram
          naturalmente.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">6. Compartilhamento</h2>
        <p className="text-sm text-slate-700">
          Compartilhamos dados apenas com provedores essenciais à operação
          (hospedagem, banco de dados, gateway de pagamento e provedor de
          WhatsApp), sob contratos adequados, e quando exigido por lei.
        </p>
      </section>

      <p className="text-xs text-slate-500">
        Este é um rascunho técnico para revisão. Não constitui aconselhamento
        jurídico.
      </p>
    </main>
  );
}
