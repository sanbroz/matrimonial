import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Forgot password</h1>
        <p className="mb-5 text-sm text-zinc-500">We&apos;ll email you a link to choose a new password.</p>
        <ForgotForm />
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-brand-700 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
