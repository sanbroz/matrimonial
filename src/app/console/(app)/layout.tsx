import { requireConsoleAdmin } from "@/lib/auth/server";
import { appVersion } from "@/lib/version";
import { UpdateNotice } from "@/components/update-notice";
import { consoleLogout } from "../actions";
import { ConsoleNav } from "./nav";

export const metadata = { title: { default: "Platform", template: "%s · Platform" } };

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireConsoleAdmin();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-zinc-200 bg-zinc-900 text-zinc-100 md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 md:block md:py-5">
          <div className="text-sm font-semibold">Bureau platform</div>
          <div className="text-xs text-zinc-400 md:mt-0.5">{admin.name} · Super admin</div>
        </div>
        <div className="md:flex-1 md:overflow-y-auto">
          <ConsoleNav />
        </div>
        <div className="hidden space-y-2 border-t border-zinc-800 px-4 py-3 md:block [&_a]:text-zinc-300 [&_div]:text-zinc-400">
          <form action={consoleLogout}>
            <button className="text-sm text-zinc-400 hover:text-white">Sign out</button>
          </form>
          <UpdateNotice initial={appVersion} isOwner screen="desktop" />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
        <div className="mx-auto max-w-6xl">{children}</div>
        <div className="mx-auto mt-10 max-w-xs space-y-2 text-center md:hidden">
          <form action={consoleLogout}>
            <button className="text-sm text-zinc-500">Sign out</button>
          </form>
          <UpdateNotice initial={appVersion} isOwner screen="mobile" />
        </div>
      </main>
    </div>
  );
}
