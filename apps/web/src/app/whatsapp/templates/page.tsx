"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { templateVariableCount } from "@petflow/shared";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import {
  whatsappTemplateApprovalLabels,
  whatsappTemplateCategoryLabels,
  type Paginated,
  type WhatsAppTemplateApproval,
  type WhatsAppTemplateCategory,
  type WhatsAppTemplateDto,
} from "../../../lib/types";
import { useDialog } from "../../../components/ui/Dialog";
import { WHATSAPP_TEMPLATE_PRESETS, type WhatsAppTemplatePreset } from "../../../lib/whatsapp-presets";

const emptyForm = {
  name: "",
  language: "pt_BR",
  category: "UTILITY" as WhatsAppTemplateCategory,
  body: "",
};

const approvalBadgeClass: Record<WhatsAppTemplateApproval, string> = {
  PENDING_APPROVAL: "rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700",
  APPROVED: "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700",
  REJECTED: "rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700",
};

export default function WhatsAppTemplatesPage() {
  const dialog = useDialog();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<WhatsAppTemplateDto[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  /** Edição de template existente (null = criando um novo) */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingPresets, setAddingPresets] = useState(false);

  const isAdmin = session?.user.role === "ADMIN";

  const loadTemplates = useCallback(async () => {
    try {
      const data = await api<Paginated<WhatsAppTemplateDto>>(
        "/api/whatsapp/templates?pageSize=100",
      );
      setTemplates(data.items);
      setListError(null);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao carregar templates.");
    }
  }, []);

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
    if (session) void loadTemplates();
  }, [session, loadTemplates]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    setSaving(true);
    try {
      const payload = JSON.stringify({
        name: form.name.trim(),
        language: form.language.trim(),
        category: form.category,
        body: form.body.trim(),
      });
      if (editingId) {
        await api(`/api/whatsapp/templates/${editingId}`, { method: "PATCH", body: payload });
        setNotice("Template salvo. Se o texto mudou, ele volta para “aguardando aprovação” — aprove de novo na Meta.");
      } else {
        await api("/api/whatsapp/templates", { method: "POST", body: payload });
        setNotice("Template criado — aguardando aprovação do provedor.");
      }
      setForm(emptyForm);
      setEditingId(null);
      await loadTemplates();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setFieldErrors(mapped);
        }
        setFormError(err.message);
      } else {
        setFormError("Não foi possível criar o template.");
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(template: WhatsAppTemplateDto) {
    setEditingId(template.id);
    setForm({ name: template.name, language: template.language, category: template.category, body: template.body });
    setFieldErrors({});
    setFormError(null);
    document.getElementById("tpl-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyPreset(preset: WhatsAppTemplatePreset) {
    setEditingId(null);
    setForm({ name: preset.name, language: "pt_BR", category: preset.category, body: preset.body });
    setFieldErrors({});
    setFormError(null);
    document.getElementById("tpl-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormError(null);
  }

  const existingNames = new Set(templates.map((template) => template.name));
  const missingPresets = WHATSAPP_TEMPLATE_PRESETS.filter((preset) => !existingNames.has(preset.name));

  async function addAllPresets() {
    if (missingPresets.length === 0) return;
    if (!(await dialog.confirm(`Adicionar ${missingPresets.length} modelo(s) pronto(s) à sua lista? Você pode editar cada um depois.`))) return;
    setAddingPresets(true);
    setNotice(null);
    setListError(null);
    let added = 0;
    try {
      for (const preset of missingPresets) {
        await api("/api/whatsapp/templates", {
          method: "POST",
          body: JSON.stringify({ name: preset.name, language: "pt_BR", category: preset.category, body: preset.body }),
        });
        added += 1;
      }
      setNotice(`${added} modelo(s) adicionado(s). Edite se quiser e cadastre na Meta com o mesmo nome e texto.`);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao adicionar os modelos.");
    } finally {
      setAddingPresets(false);
      await loadTemplates();
    }
  }

  async function handleApproval(
    template: WhatsAppTemplateDto,
    approval: WhatsAppTemplateApproval,
  ) {
    const label = approval === "APPROVED" ? "aprovar" : "reprovar";
    if (!await dialog.confirm(`Deseja ${label} o template "${template.name}"?`)) return;
    setNotice(null);
    setListError(null);
    try {
      await api(`/api/whatsapp/templates/${template.id}`, {
        method: "PATCH",
        body: JSON.stringify({ approval }),
      });
      setNotice(`Template ${approval === "APPROVED" ? "aprovado" : "reprovado"} (registro local).`);
      await loadTemplates();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao atualizar aprovação.");
    }
  }

  async function handleStatus(template: WhatsAppTemplateDto, status: "ACTIVE" | "INACTIVE") {
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!await dialog.confirm(`Deseja ${label} o template "${template.name}"?`)) return;
    setNotice(null);
    setListError(null);
    try {
      await api(`/api/whatsapp/templates/${template.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(`Template ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await loadTemplates();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Falha ao atualizar status.");
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Templates de mensagem</h2>
          <p className="text-sm text-slate-500">
            Modelos aprovados pelo WhatsApp — necessários para enviar mensagens fora da janela de
            24h
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/whatsapp"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Integração
          </Link>
          <Link
            href="/whatsapp/mensagens"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Mensagens
          </Link>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Início
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          {notice}
        </div>
      )}
      {listError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {listError}
        </div>
      )}

      {isAdmin && missingPresets.length > 0 && (
        <section aria-labelledby="tpl-presets" className="rounded-lg border border-primary-200 bg-primary-50/50 p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="tpl-presets" className="text-sm font-semibold uppercase tracking-wide text-primary-800">
                Modelos prontos
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Textos já no padrão da Meta. Clique em “Usar e editar” para ajustar antes de criar, ou adicione todos.
              </p>
            </div>
            <button
              type="button"
              disabled={addingPresets}
              onClick={() => void addAllPresets()}
              className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
            >
              {addingPresets ? "Adicionando..." : `Adicionar todos (${missingPresets.length})`}
            </button>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {missingPresets.map((preset) => (
              <li key={preset.name} className="flex flex-col rounded-md border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{preset.title}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {whatsappTemplateCategoryLabels[preset.category]}
                  </span>
                </div>
                <p className="mt-2 flex-1 text-sm text-slate-600">{preset.body}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {preset.variables.map((variable, index) => `{{${index + 1}}} ${variable}`).join(" · ")}
                </p>
                <button
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="mt-3 self-start text-sm font-medium text-primary-700 hover:underline"
                >
                  Usar e editar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && (
        <div id="tpl-form" className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {editingId ? "Editar template" : "Novo template"}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tpl-name" className="mb-1 block text-sm text-slate-700">
                Nome * (minúsculas, números e _)
              </label>
              <input
                id="tpl-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="lembrete_agendamento"
                className={inputClass}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.name}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="tpl-language" className="mb-1 block text-sm text-slate-700">
                  Idioma *
                </label>
                <input
                  id="tpl-language"
                  value={form.language}
                  onChange={(event) => setForm({ ...form, language: event.target.value })}
                  placeholder="pt_BR"
                  className={inputClass}
                />
                {fieldErrors.language && (
                  <p className="mt-1 text-xs text-red-700">{fieldErrors.language}</p>
                )}
              </div>
              <div>
                <label htmlFor="tpl-category" className="mb-1 block text-sm text-slate-700">
                  Categoria
                </label>
                <select
                  id="tpl-category"
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value as WhatsAppTemplateCategory })
                  }
                  className={inputClass}
                >
                  {(Object.keys(whatsappTemplateCategoryLabels) as WhatsAppTemplateCategory[]).map(
                    (category) => (
                      <option key={category} value={category}>
                        {whatsappTemplateCategoryLabels[category]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="tpl-body" className="mb-1 block text-sm text-slate-700">
                Corpo * (variáveis {"{{1}}"}, {"{{2}}"}... em sequência)
              </label>
              <textarea
                id="tpl-body"
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                rows={3}
                placeholder="Olá {{1}}, seu agendamento de {{2}} está marcado para {{3}}."
                className={inputClass}
              />
              {fieldErrors.body && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.body}</p>
              )}
            </div>
            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
                {formError}
              </div>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
              >
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar template"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="ml-2 rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {templates.map((template) => (
          <div key={template.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium text-slate-800">{template.name}</h4>
                <span className="text-xs text-slate-500">
                  {template.language} · {whatsappTemplateCategoryLabels[template.category]}
                </span>
                <span className={approvalBadgeClass[template.approval]}>
                  {whatsappTemplateApprovalLabels[template.approval]}
                </span>
                <span
                  className={
                    template.status === "ACTIVE"
                      ? "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                      : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 line-through"
                  }
                >
                  {template.status === "ACTIVE" ? "Ativo" : "Inativo"}
                </span>
              </div>
              {isAdmin && (
                <div className="flex gap-3 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => startEdit(template)}
                    className="text-slate-700 hover:underline"
                  >
                    Editar
                  </button>
                  {template.approval !== "APPROVED" && (
                    <button
                      type="button"
                      onClick={() => void handleApproval(template, "APPROVED")}
                      className="text-primary-700 hover:underline"
                    >
                      Marcar aprovado
                    </button>
                  )}
                  {template.approval === "APPROVED" && (
                    <button
                      type="button"
                      onClick={() => void handleApproval(template, "REJECTED")}
                      className="text-red-700 hover:underline"
                    >
                      Marcar reprovado
                    </button>
                  )}
                  {template.status === "ACTIVE" ? (
                    <button
                      type="button"
                      onClick={() => void handleStatus(template, "INACTIVE")}
                      className="text-red-700 hover:underline"
                    >
                      Inativar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleStatus(template, "ACTIVE")}
                      className="text-primary-700 hover:underline"
                    >
                      Reativar
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {template.body}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Variáveis: {templateVariableCount(template.body)} · criado em{" "}
              {new Date(template.createdAt).toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Nenhum template cadastrado. Use os modelos prontos acima para começar.
          </p>
        )}
      </div>
    </div>
  );
}
