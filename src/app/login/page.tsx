import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { Alert } from "@/components/ui";
import { LoginForm } from "./login-form";
import { requireTenant } from "@/lib/tenant/context";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const tenant = await requireTenant(); // 404 on unknown hosts
  if (tenant.status === "SUSPENDED") redirect("/suspended");
  if (await getCurrentUser()) redirect("/");
  const { reset } = await searchParams;
  const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { bureauName: true } });
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">{settings?.bureauName ?? "Bureau CRM"}</h1>
        <p className="mb-5 text-sm text-zinc-500">Staff sign in</p>
        {reset && <div className="mb-4"><Alert tone="green">Password changed. Sign in with your new password.</Alert></div>}
        <LoginForm />
        <p className="mt-4 text-center text-sm">
          <Link href="/forgot" className="text-zinc-500 hover:text-brand-700 hover:underline">Forgot password?</Link>
        </p>
      </div>
    </main>
  );
}
