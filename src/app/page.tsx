import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Day } from "@/components/landing/day";
import { Features } from "@/components/landing/features";
import { Numbers } from "@/components/landing/numbers";
import { How } from "@/components/landing/how";
import { Pricing } from "@/components/landing/pricing";
import { Faq, FAQS } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import "@/components/landing/landing.css";

const TITLE = "Agentipro — Meno giri a vuoto, più strette di mano";
const DESCRIPTION =
  "Il CRM con l'AI per agenti di commercio: trova le attività della tua zona, scopri chi chiamare per primo con il lead score e arriva a ogni visita con un briefing pronto.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "it_IT", siteName: "Agentipro" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default async function Home() {
  // Solo verifica della firma del cookie (nessuna query al DB): la pagina resta veloce.
  const store = await cookies();
  const loggedIn = Boolean(await verifySession(store.get(SESSION_COOKIE)?.value));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Agentipro",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "it",
        description: DESCRIPTION,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <div className="lp lp-grain">
      <a href="#contenuto" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">
        Vai al contenuto
      </a>
      <LandingNav loggedIn={loggedIn} />
      <main id="contenuto">
        <Hero loggedIn={loggedIn} />
        <Day />
        <Features />
        <Numbers />
        <How />
        <Pricing loggedIn={loggedIn} />
        <Faq />
        <FinalCta loggedIn={loggedIn} />
      </main>
      <LandingFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
