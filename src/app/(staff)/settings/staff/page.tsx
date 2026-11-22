import type { User } from "@prisma/client";
import { requireOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { Badge, Card, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveStaff, toggleStaffActive } from "../actions";
import { Flash } from "../flash";

export const metadata = { title: "Staff accounts" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireOwner();
  const sp = await searchParams;
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] });

  return (
    <div className="space-y-5">
      <Flash {...sp} />
      <p className="text-sm text-zinc-600">
        <strong>Owner</strong>: everything, including settings, plans and deleting data. <strong>Staff</strong>: leads, profiles, notes and import.
      </p>
      {users.map((u) => (
        <Card
          key={u.id}
          title={
            <span className="flex items-center gap-2">
              {u.name} {u.id === me.id && <Badge tone="blue">you</Badge>} {!u.active && <Badge tone="red">deactivated</Badge>}
            </span>
          }
          actions={
            u.id !== me.id && (
              <form action={toggleStaffActive}>
                <input type="hidden" name="id" value={u.id} />
                <SubmitButton variant="ghost" pendingText="…" confirm={u.active ? `Deactivate ${u.name}? They will be signed out.` : undefined}>
                  {u.active ? "Deactivate" : "Reactivate"}
                </SubmitButton>
              </form>
            )
          }
        >
          <UserForm user={u} />
        </Card>
      ))}
      <Card title="Add staff account">
        <UserForm />
      </Card>
    </div>
  );
}

function UserForm({ user }: { user?: User }) {
  return (
    <form action={saveStaff} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
      {user && <input type="hidden" name="id" value={user.id} />}
      <Field label="Name"><input name="name" required defaultValue={user?.name} className={inputClass} /></Field>
      <Field label="Email (login)"><input name="email" type="email" required defaultValue={user?.email} className={inputClass} /></Field>
      <Field label={user ? "New password" : "Password"} hint={user ? "Leave blank to keep" : "At least 8 characters"}>
        <input name="password" type="password" autoComplete="new-password" required={!user} minLength={8} className={inputClass} />
      </Field>
      <Field label="Role">
        <select name="role" defaultValue={user?.role ?? "STAFF"} className={inputClass}>
          <option value="STAFF">Staff</option>
          <option value="OWNER">Owner</option>
        </select>
      </Field>
      <div className="flex items-end"><SubmitButton>{user ? "Save" : "Create account"}</SubmitButton></div>
    </form>
  );
}
