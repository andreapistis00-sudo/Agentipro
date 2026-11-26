import { requireUser } from "@/lib/auth";
import { isAiDemo } from "@/lib/ai";
import { Sidebar, MobileNav } from "@/components/app/nav";
import { ToastProvider } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <ToastProvider>
      <div className="flex min-h-dvh">
        <Sidebar user={{ name: user.name, email: user.email }} aiDemo={isAiDemo()} credits={user.credits} />
        <div className="min-w-0 flex-1">
          <MobileNav credits={user.credits} />
          <main className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
