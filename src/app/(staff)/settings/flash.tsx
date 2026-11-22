import { Alert } from "@/components/ui";

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return <div className="mb-4">{error ? <Alert>{error}</Alert> : <Alert tone="green">{ok}</Alert>}</div>;
}
