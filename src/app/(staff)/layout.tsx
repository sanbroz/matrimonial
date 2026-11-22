import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { appVersion } from "@/lib/version";
import { logoutAction } from "@/app/login/actions";
import { NavLinks } from "./nav-links";
import { UpdateNotice } from "./update-notice";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { bureauName: true } });
  const isOwner = user.role === "OWNER";

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-zinc-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-3 md:block md:py-5">
          <div className="truncate text-sm font-semibold text-brand-700">{settings?.bureauName}</div>
          <div className="text-xs text-zinc-500 md:mt-0.5">
            {user.name} · {isOwner ? "Owner" : "Staff"}
          </div>
        </div>
        <div className="md:flex-1 md:overflow-y-auto">
          <NavLinks isOwner={isOwner} />
        </div>
        <div className="hidden space-y-2 border-t border-zinc-100 px-4 py-3 md:block">
          <form action={logoutAction}>
            <button className="text-sm text-zinc-500 hover:text-zinc-900">Sign out</button>
          </form>
          <UpdateNotice initial={appVersion} isOwner={isOwner} />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
        <div className="mx-auto max-w-6xl">{children}</div>
        <div className="mx-auto mt-10 max-w-xs space-y-2 text-center md:hidden">
          <form action={logoutAction}>
            <button className="text-sm text-zinc-500">Sign out</button>
          </form>
          <UpdateNotice initial={appVersion} isOwner={isOwner} />
        </div>
      </main>
    </div>
  );
}
