import { redirect } from "next/navigation";
import { getConsoleAdmin } from "@/lib/auth/server";
import { ConsoleLoginForm } from "./form";

export const metadata = { title: "Platform sign in" };

export default async function ConsoleLoginPage() {
  if (await getConsoleAdmin()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Bureau platform</h1>
        <p className="mb-5 text-sm text-zinc-500">Super admin sign in</p>
        <ConsoleLoginForm />
      </div>
    </main>
  );
}
