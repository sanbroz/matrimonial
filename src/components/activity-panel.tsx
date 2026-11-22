import type { FollowUp, Note, User } from "@prisma/client";
import { addFollowUp, addNote, deleteNote } from "@/lib/actions/activity";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, Field, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";
import { FollowUpDoneButton } from "./follow-up-done";

const KIND_LABEL = { CALL: "Call", VISIT: "Visit", WHATSAPP: "WhatsApp", OTHER: "Note" } as const;

type Target = { leadId?: string; profileId?: string };

function TargetInputs({ t }: { t: Target }) {
  return (
    <>
      {t.leadId && <input type="hidden" name="leadId" value={t.leadId} />}
      {t.profileId && <input type="hidden" name="profileId" value={t.profileId} />}
    </>
  );
}

export function NotesPanel({
  target,
  notes,
  currentUserId,
  isOwner,
}: {
  target: Target;
  notes: (Note & { author: Pick<User, "name"> })[];
  currentUserId: string;
  isOwner: boolean;
}) {
  return (
    <Card title="Call & visit notes">
      <form action={addNote} className="mb-4 space-y-3">
        <TargetInputs t={target} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_1fr]">
          <select name="kind" className={inputClass + " self-start"} defaultValue="CALL">
            {Object.entries(KIND_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <textarea name="body" required rows={2} placeholder="What was discussed?" className={inputClass} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Follow-up (optional)" className="w-56">
            <input type="datetime-local" name="followUpAt" className={inputClass} />
          </Field>
          <Field label="Follow-up title" className="min-w-40 flex-1">
            <input name="followUpTitle" placeholder="Call back" className={inputClass} />
          </Field>
          <SubmitButton>Add note</SubmitButton>
        </div>
      </form>
      {notes.length === 0 ? (
        <p className="text-sm text-zinc-400">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md bg-zinc-50 px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                <span>
                  <Badge>{KIND_LABEL[n.kind]}</Badge> {formatDateTime(n.createdAt)} · {n.author.name}
                </span>
                {(n.authorId === currentUserId || isOwner) && (
                  <form action={deleteNote}>
                    <input type="hidden" name="id" value={n.id} />
                    <SubmitButton variant="ghost" pendingText="…" confirm="Delete this note?">Delete</SubmitButton>
                  </form>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function FollowUpsPanel({ target, followUps }: { target: Target; followUps: FollowUp[] }) {
  const open = followUps.filter((f) => !f.done);
  const done = followUps.filter((f) => f.done).slice(0, 5);
  return (
    <Card title="Follow-ups">
      <form action={addFollowUp} className="mb-4 flex flex-wrap items-end gap-2">
        <TargetInputs t={target} />
        <Field label="When" className="w-56">
          <input type="datetime-local" name="dueAt" required className={inputClass} />
        </Field>
        <Field label="What" className="min-w-40 flex-1">
          <input name="title" placeholder="Call back" className={inputClass} />
        </Field>
        <SubmitButton>Add</SubmitButton>
      </form>
      {open.length === 0 && <p className="text-sm text-zinc-400">No open follow-ups.</p>}
      <ul className="divide-y divide-zinc-100">
        {open.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 py-2">
            <div className="text-sm">
              <div className="font-medium">{f.title}</div>
              <div className={f.dueAt < new Date() ? "text-xs text-red-600" : "text-xs text-zinc-500"}>{formatDateTime(f.dueAt)}</div>
            </div>
            <FollowUpDoneButton id={f.id} />
          </li>
        ))}
        {done.map((f) => (
          <li key={f.id} className="py-2 text-sm text-zinc-400 line-through">
            {f.title} · {formatDateTime(f.dueAt)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
