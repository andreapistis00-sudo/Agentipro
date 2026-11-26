"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui";
import type { LeadDTO } from "@/lib/crm/types";
import { api } from "./client-api";

/** Stato locale che si riallinea quando cambiano le props dal server (dopo router.refresh()). */
export function useSynced<T>(value: T) {
  const [state, setState] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setState(value);
  }
  return [state, setState] as const;
}

/** PATCH ottimistico di un lead: aggiorna subito lo stato locale, rollback + toast su errore. */
export function useLeadPatch(initial: LeadDTO) {
  const router = useRouter();
  const toast = useToast();
  const [lead, setLead] = useSynced(initial);

  const patch = useCallback(
    async (data: Partial<Record<keyof LeadDTO, unknown>>, opts: { success?: string } = {}) => {
      const before = lead;
      setLead({ ...lead, ...(data as Partial<LeadDTO>) });
      const res = await api<{ lead: LeadDTO }>(`/api/leads/${lead.id}`, "PATCH", data);
      if (!res.ok) {
        setLead(before);
        toast(res.error, "error");
        return false;
      }
      setLead(res.data.lead);
      if (opts.success) toast(opts.success);
      router.refresh();
      return true;
    },
    [lead, setLead, router, toast],
  );
  return { lead, patch };
}
