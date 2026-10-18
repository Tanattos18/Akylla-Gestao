"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { fetchSession, type Session } from "../../../lib/session";
import {
  petSexLabels,
  petSpeciesLabels,
  whatsappConsentSourceLabels,
  whatsappConsentStatusLabels,
  type ClientDto,
  type PetDto,
  type PetSex,
  type PetSpecies,
  type WhatsAppConsentDto,
} from "../../../lib/types";
import { useDialog } from "../../../components/ui/Dialog";
import { DataTable } from "../../../components/ui/DataTable";

const emptyPetForm = {
  name: "",
  species: "DOG" as PetSpecies,
  breed: "",
  sex: "UNKNOWN" as PetSex,
  birthDate: "",
  weight: "",
  color: "",
  notes: "",
};

export default function ClienteDetalhePage() {
  const dialog = useDialog();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientDto | null>(null);
  const [pets, setPets] = useState<PetDto[]>([]);
  const [consent, setConsent] = useState<WhatsAppConsentDto | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [petForm, setPetForm] = useState(emptyPetForm);
  const [petErrors, setPetErrors] = useState<Record<string, string>>({});
  const [petError, setPetError] = useState<string | null>(null);
  const [savingPet, setSavingPet] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadClient = useCallback(async () => {
    try {
      const [clientData, petsData, consentData] = await Promise.all([
        api<ClientDto>(`/api/clients/${clientId}`),
        api<{ items: PetDto[]; total: number }>(`/api/clients/${clientId}/pets`),
        api<WhatsAppConsentDto | Record<string, never>>(
          `/api/whatsapp/consents/${clientId}`,
          { redirectOnUnauthorized: false },
        ).catch(() => null),
      ]);
      setClient(clientData);
      setPets(petsData.items);
      setConsent(
        consentData && typeof consentData === "object" && "id" in consentData
          ? (consentData as WhatsAppConsentDto)
          : null,
      );
      setNotFound(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setActionError(err instanceof ApiError ? err.message : "Falha ao carregar cliente.");
      }
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchSession().then((value) => {
      if (!value) {
        router.replace("/login");
        return;
      }
      setSession(value);
    });
  }, [router]);

  useEffect(() => {
    if (session) void loadClient();
  }, [session, loadClient]);

  function startEditPet(pet: PetDto) {
    setEditingPetId(pet.id);
    setPetForm({
      name: pet.name,
      species: pet.species,
      breed: pet.breed ?? "",
      sex: pet.sex,
      birthDate: pet.birthDate ?? "",
      weight: pet.weight ?? "",
      color: pet.color ?? "",
      notes: pet.notes ?? "",
    });
    setPetErrors({});
    setPetError(null);
  }

  function resetPetForm() {
    setEditingPetId(null);
    setPetForm(emptyPetForm);
    setPetErrors({});
    setPetError(null);
  }

  async function handlePetSubmit(event: FormEvent) {
    event.preventDefault();
    setPetError(null);
    setPetErrors({});

    if (petForm.name.trim().length < 2) {
      setPetErrors({ name: "Nome deve ter ao menos 2 caracteres" });
      return;
    }

    setSavingPet(true);
    try {
      const payload = {
        clientId,
        name: petForm.name.trim(),
        species: petForm.species,
        breed: petForm.breed.trim() || null,
        sex: petForm.sex,
        birthDate: petForm.birthDate || null,
        weight: petForm.weight.trim() || null,
        color: petForm.color.trim() || null,
        notes: petForm.notes.trim() || null,
      };
      if (editingPetId) {
        await api(`/api/pets/${editingPetId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("Pet atualizado.");
      } else {
        await api("/api/pets", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Pet cadastrado.");
      }
      resetPetForm();
      await loadClient();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues?.length) {
          const mapped: Record<string, string> = {};
          for (const issue of err.issues) mapped[issue.path] = issue.message;
          setPetErrors(mapped);
        }
        setPetError(err.message);
      } else {
        setPetError("Não foi possível salvar o pet.");
      }
    } finally {
      setSavingPet(false);
    }
  }

  async function handlePetStatus(pet: PetDto, status: "ACTIVE" | "INACTIVE") {
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!await dialog.confirm(`Deseja ${label} o pet "${pet.name}"?`)) return;
    setActionError(null);
    try {
      await api(`/api/pets/${pet.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(`Pet ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await loadClient();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Falha ao atualizar status.");
    }
  }

  async function handleClientStatus(status: "ACTIVE" | "INACTIVE") {
    if (!client) return;
    const label = status === "INACTIVE" ? "inativar" : "reativar";
    if (!await dialog.confirm(`Deseja ${label} o cliente "${client.name}"?`)) return;
    setActionError(null);
    try {
      await api(`/api/clients/${client.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(`Cliente ${status === "INACTIVE" ? "inativado" : "reativado"}.`);
      await loadClient();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Falha ao atualizar status.");
    }
  }

  async function handleConsent(status: "OPTED_IN" | "OPTED_OUT") {
    if (!client) return;
    if (status === "OPTED_OUT") {
      const confirmed = await dialog.confirm(
        `Registrar o descadastro de ${client.name} no WhatsApp? Novos envios ficam bloqueados.`,
      );
      if (!confirmed) return;
    }
    setActionError(null);
    try {
      await api(`/api/whatsapp/consents/${client.id}`, {
        method: "PUT",
        body: JSON.stringify({ status, source: "MANUAL" }),
      });
      setNotice(
        status === "OPTED_IN"
          ? "Consentimento registrado."
          : "Descadastro registrado — envios bloqueados.",
      );
      await loadClient();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Falha ao atualizar o consentimento.",
      );
    }
  }

  if (loading || !session) {
    return <p className="py-16 text-center text-sm text-slate-500">Carregando...</p>;
  }

  if (notFound || !client) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-slate-500">Cliente não encontrado.</p>
        <Link
          href="/clientes"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar aos clientes
        </Link>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";

  const address = [
    [client.street, client.number].filter(Boolean).join(", "),
    client.complement,
    client.district,
    [client.city, client.state].filter(Boolean).join("/"),
    client.zip,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{client.name}</h2>
          <p className="text-sm text-slate-500">Ficha do cliente</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/clientes"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Voltar aos clientes
          </Link>
          <Link
            href={`/crediario?cliente=${client.id}`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Crediário
          </Link>
          <Link
            href="/pets"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Todos os pets
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          {notice}
        </div>
      )}
      {actionError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Dados do cliente
          </h3>
          <div className="flex items-center gap-3">
            <span
              className={
                client.status === "ACTIVE"
                  ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                  : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
              }
            >
              {client.status === "ACTIVE" ? "Ativo" : "Inativo"}
            </span>
            {client.status === "ACTIVE" ? (
              <button
                type="button"
                onClick={() => void handleClientStatus("INACTIVE")}
                className="text-xs font-medium text-red-700 hover:underline"
              >
                Inativar cliente
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleClientStatus("ACTIVE")}
                className="text-xs font-medium text-primary-700 hover:underline"
              >
                Reativar cliente
              </button>
            )}
          </div>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-slate-500">Contato</dt>
            <dd className="text-slate-700">
              {[client.mobile, client.phone, client.email].filter(Boolean).join(" · ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">CPF</dt>
            <dd className="text-slate-700">{client.cpf || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Endereço</dt>
            <dd className="text-slate-700">{address || "—"}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs uppercase text-slate-500">Observações</dt>
            <dd className="text-slate-700">{client.notes || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Pets</dt>
            <dd className="text-slate-700">{client._count?.pets ?? pets.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Vendas</dt>
            <dd className="text-slate-700">{client._count?.sales ?? 0}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Consentimento WhatsApp
          </h3>
          <span
            className={
              consent?.status === "OPTED_IN"
                ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                : consent?.status === "OPTED_OUT"
                  ? "rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                  : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
            }
          >
            {consent
              ? whatsappConsentStatusLabels[consent.status]
              : "Sem registro de consentimento"}
          </span>
        </div>
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase text-slate-500">Origem</dt>
            <dd className="text-slate-700">
              {consent ? whatsappConsentSourceLabels[consent.source] : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Telefone (E.164)</dt>
            <dd className="text-slate-700">{consent?.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Última alteração</dt>
            <dd className="text-slate-700">
              {consent?.changedAt ? new Date(consent.changedAt).toLocaleString("pt-BR") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Envios</dt>
            <dd className="text-slate-700">
              {consent?.status === "OPTED_IN"
                ? "Permitidos"
                : consent?.status === "OPTED_OUT"
                  ? "Bloqueados"
                  : "Sem consentimento — bloqueados"}
            </dd>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => void handleConsent("OPTED_IN")}
            disabled={consent?.status === "OPTED_IN"}
            className="rounded-md border border-primary-600 px-3 py-2 text-xs font-medium text-primary-800 hover:bg-primary-100 disabled:opacity-50"
          >
            Registrar consentimento
          </button>
          <button
            type="button"
            onClick={() => void handleConsent("OPTED_OUT")}
            disabled={consent?.status === "OPTED_OUT"}
            className="rounded-md border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Registrar descadastro
          </button>
          <Link
            href="/whatsapp"
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver integração
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {editingPetId ? "Editar pet" : "Cadastrar pet"}
        </h3>
        <form onSubmit={handlePetSubmit} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="pet-name" className="mb-1 block text-sm text-slate-700">
              Nome do pet *
            </label>
            <input
              id="pet-name"
              value={petForm.name}
              onChange={(event) => setPetForm({ ...petForm, name: event.target.value })}
              className={inputClass}
            />
            {petErrors.name && <p className="mt-1 text-xs text-red-700">{petErrors.name}</p>}
          </div>
          <div>
            <label htmlFor="pet-species" className="mb-1 block text-sm text-slate-700">
              Espécie *
            </label>
            <select
              id="pet-species"
              value={petForm.species}
              onChange={(event) =>
                setPetForm({ ...petForm, species: event.target.value as PetSpecies })
              }
              className={inputClass}
            >
              {(Object.keys(petSpeciesLabels) as PetSpecies[]).map((species) => (
                <option key={species} value={species}>
                  {petSpeciesLabels[species]}
                </option>
              ))}
            </select>
            {petErrors.species && (
              <p className="mt-1 text-xs text-red-700">{petErrors.species}</p>
            )}
          </div>
          <div>
            <label htmlFor="pet-breed" className="mb-1 block text-sm text-slate-700">
              Raça
            </label>
            <input
              id="pet-breed"
              value={petForm.breed}
              onChange={(event) => setPetForm({ ...petForm, breed: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pet-sex" className="mb-1 block text-sm text-slate-700">
              Sexo
            </label>
            <select
              id="pet-sex"
              value={petForm.sex}
              onChange={(event) => setPetForm({ ...petForm, sex: event.target.value as PetSex })}
              className={inputClass}
            >
              {(Object.keys(petSexLabels) as PetSex[]).map((sex) => (
                <option key={sex} value={sex}>
                  {petSexLabels[sex]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pet-birth" className="mb-1 block text-sm text-slate-700">
              Data de nascimento
            </label>
            <input
              id="pet-birth"
              type="date"
              value={petForm.birthDate}
              onChange={(event) => setPetForm({ ...petForm, birthDate: event.target.value })}
              className={inputClass}
            />
            {petErrors.birthDate && (
              <p className="mt-1 text-xs text-red-700">{petErrors.birthDate}</p>
            )}
          </div>
          <div>
            <label htmlFor="pet-weight" className="mb-1 block text-sm text-slate-700">
              Peso (kg)
            </label>
            <input
              id="pet-weight"
              inputMode="decimal"
              value={petForm.weight}
              onChange={(event) => setPetForm({ ...petForm, weight: event.target.value })}
              placeholder="12.5"
              className={inputClass}
            />
            {petErrors.weight && (
              <p className="mt-1 text-xs text-red-700">{petErrors.weight}</p>
            )}
          </div>
          <div>
            <label htmlFor="pet-color" className="mb-1 block text-sm text-slate-700">
              Cor
            </label>
            <input
              id="pet-color"
              value={petForm.color}
              onChange={(event) => setPetForm({ ...petForm, color: event.target.value })}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="pet-notes" className="mb-1 block text-sm text-slate-700">
              Observações
            </label>
            <textarea
              id="pet-notes"
              value={petForm.notes}
              onChange={(event) => setPetForm({ ...petForm, notes: event.target.value })}
              rows={2}
              className={inputClass}
            />
          </div>
          {petError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2 lg:col-span-4">
              {petError}
            </div>
          )}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={savingPet}
              className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
            >
              {savingPet ? "Salvando..." : editingPetId ? "Salvar pet" : "Cadastrar pet"}
            </button>
            {editingPetId && (
              <button
                type="button"
                onClick={resetPetForm}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <DataTable
        rows={pets}
        rowKey={(pet) => pet.id}
        empty={<>Nenhum pet cadastrado para este cliente.</>}
        columns={[
          { key: "c0", header: "Pet", cell: (pet) => pet.name, className: "font-medium" },
          { key: "c1", header: "Espécie", cell: (pet) => petSpeciesLabels[pet.species] },
          { key: "c2", header: "Raça", cell: (pet) => pet.breed || "—" },
          { key: "c3", header: "Nascimento", cell: (pet) => pet.birthDate || "—" },
          { key: "c4", header: "Peso", cell: (pet) => <>{pet.weight ? `${pet.weight} kg` : "—"}</> },
          { key: "c5", header: "Status", cell: (pet) => <><span
                    className={
                      pet.status === "ACTIVE"
                        ? "rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    }
                  >
                    {pet.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </span></> },
          { key: "c6", header: "Ações", cell: (pet) => <><div className="flex gap-3 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => startEditPet(pet)}
                      className="text-primary-700 hover:underline"
                    >
                      Editar
                    </button>
                    {pet.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => void handlePetStatus(pet, "INACTIVE")}
                        className="text-red-700 hover:underline"
                      >
                        Inativar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handlePetStatus(pet, "ACTIVE")}
                        className="text-primary-700 hover:underline"
                      >
                        Reativar
                      </button>
                    )}
                  </div></> },
        ]}
      />
    </div>
  );
}
