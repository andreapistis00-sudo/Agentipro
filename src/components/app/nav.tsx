"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Search, Users, KanbanSquare, Sparkles, Settings, LogOut } from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/app", label: "Oggi", icon: LayoutDashboard, exact: true },
  { href: "/app/search", label: "Trova clienti", icon: Search },
  { href: "/app/leads", label: "Clienti", icon: Users },
  { href: "/app/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/app/assistant", label: "Assistente", icon: Sparkles },
  { href: "/app/settings", label: "Profilo", icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ user, aiDemo }: { user: { name: string; email: string }; aiDemo: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-bg px-3 py-5 lg:flex">
      <Link href="/app" className="mb-8 px-2"><Logo /></Link>
      <nav className="flex flex-col gap-0.5" aria-label="Navigazione principale">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <Link key={href} href={href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition",
                active ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}>
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-accent" : "text-ink-3 group-hover:text-ink-2")} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3">
        {aiDemo && (
          <div className="rounded-xl border border-dashed border-line-strong p-3 text-[12px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">Modalità demo AI.</span> Aggiungi <code className="font-mono">ANTHROPIC_API_KEY</code> per risposte reali.
          </div>
        )}
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-ink-3">{user.email}</div>
          </div>
          <button onClick={logout} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Esci" title="Esci">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/** Barra inferiore per mobile. */
export function MobileNav() {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.href !== "/app/settings");
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
        <Link href="/app"><Logo /></Link>
        <Link href="/app/settings" className="rounded-full p-2 text-ink-2 hover:bg-surface-2" aria-label="Profilo"><Settings className="h-5 w-5" /></Link>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navigazione mobile">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium", active ? "text-ink" : "text-ink-3")}>
              <Icon className={cn("h-5 w-5", active && "text-accent")} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
