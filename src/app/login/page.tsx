import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { bureauName: true } });
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">{settings?.bureauName ?? "Bureau CRM"}</h1>
        <p className="mb-5 text-sm text-zinc-500">Staff sign in</p>
        <LoginForm />
      </div>
    </main>
  );
}
