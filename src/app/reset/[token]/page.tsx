import Link from "next/link";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Choose a new password</h1>
        <p className="mb-5 text-sm text-zinc-500">You&apos;ll be signed out on other devices.</p>
        <ResetForm token={token} />
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-brand-700 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
