import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/app/login/actions";
import { NavLinks } from "./nav-links";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { bureauName: true } });

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-zinc-200 bg-white md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-3 md:block md:py-5">
          <div className="truncate text-sm font-semibold text-brand-700">{settings?.bureauName}</div>
          <div className="text-xs text-zinc-500 md:mt-0.5">
            {user.name} · {user.role === "OWNER" ? "Owner" : "Staff"}
          </div>
        </div>
        <NavLinks isOwner={user.role === "OWNER"} />
        <form action={logoutAction} className="hidden px-3 pb-4 md:absolute md:bottom-0 md:block">
          <button className="text-sm text-zinc-500 hover:text-zinc-900">Sign out</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
        <div className="mx-auto max-w-6xl">{children}</div>
        <form action={logoutAction} className="mt-10 text-center md:hidden">
          <button className="text-sm text-zinc-500">Sign out</button>
        </form>
      </main>
    </div>
  );
}
