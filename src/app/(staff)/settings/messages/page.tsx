import { requireOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS, TEMPLATE_VARS, readTemplates, type TemplateKey } from "@/lib/templates";
import { Card, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveTemplates } from "./actions";
import { Flash } from "../flash";

export const metadata = { title: "Message templates" };

export default async function MessagesSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { messageTemplates: true } });
  const t = readTemplates(s.messageTemplates);

  return (
    <form action={saveTemplates} className="space-y-5">
      <Flash {...sp} />
      <p className="text-sm text-zinc-600">
        These are the starting text for WhatsApp messages and emails. Staff can still edit each message before sending.
        Words in <code className="rounded bg-zinc-100 px-1">{"{braces}"}</code> are filled in automatically. You can write in
        Punjabi too. Empty a box to go back to the default.
      </p>
      {(Object.keys(TEMPLATE_KEYS) as TemplateKey[]).map((k) => (
        <Card key={k} title={TEMPLATE_KEYS[k]}>
          <textarea
            name={k}
            rows={k.endsWith("Subject") ? 1 : 4}
            defaultValue={t[k] === DEFAULT_TEMPLATES[k] ? DEFAULT_TEMPLATES[k] : t[k]}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Can use: {TEMPLATE_VARS[k].map((v) => `{${v}}`).join(" ")}
          </p>
        </Card>
      ))}
      <SubmitButton>Save templates</SubmitButton>
    </form>
  );
}
