import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { AI_UNAVAILABLE, aiErrorMessage, isProviderBillingError } from "../client";

const badRequest = (message: string) =>
  new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message } }, message, new Headers());

describe("messaggi d'errore AI", () => {
  it("il credito API esaurito diventa un generico 'servizio non disponibile', senza dettagli di billing", () => {
    const err = badRequest("Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.");
    expect(isProviderBillingError(err)).toBe(true);
    expect(aiErrorMessage(err)).toBe(AI_UNAVAILABLE);
    expect(aiErrorMessage(err).toLowerCase()).not.toMatch(/credit|billing/);
  });

  it("gli altri 400 restano distinti", () => {
    const err = badRequest("messages: field required");
    expect(isProviderBillingError(err)).toBe(false);
    expect(aiErrorMessage(err)).not.toBe(AI_UNAVAILABLE);
    expect(isProviderBillingError(new Error("credit balance"))).toBe(false);
  });
});
