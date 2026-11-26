import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { LandingNav } from "@/components/landing/nav";
import { LandingFooter } from "@/components/landing/footer";
import "@/components/landing/landing.css";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const loggedIn = Boolean(await verifySession(store.get(SESSION_COOKIE)?.value));
  return (
    <div className="lp lp-grain">
      <LandingNav loggedIn={loggedIn} />
      <main id="contenuto" className="mx-auto w-full max-w-[760px] px-[var(--lp-gutter)] py-20 sm:py-28">{children}</main>
      <LandingFooter />
    </div>
  );
}
