import Link from "next/link";
import { loadProfileMoney } from "@/lib/services/money";
import { KIND_LABELS, MODE_LABELS, daysLeft, dueBalance, paidTotal, rupees, todayIST } from "@/lib/money";
import { formatDateOnly, formatDateTime } from "@/lib/format";
import { Badge, Card, Field, cx, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { addCharge, editDueAmount, payDue, waiveDue } from "@/app/(staff)/payments/actions";
import { MembershipForm } from "./membership-form";
import { prisma } from "@/lib/db";
import { SendMessageButton } from "@/components/send-message";
import { sendReminder } from "@/lib/actions/messaging";
import { addressee, messageContext } from "@/lib/services/message-vars";
import { whatsappConfigured } from "@/lib/services/whatsapp";
import { renderTemplate } from "@/lib/templates";

const modeSelect = (
  <select name="mode" className={inputClass} defaultValue="CASH">
    {Object.entries(MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>
);

export async function MoneyPanel({ profileId, isOwner }: { profileId: string; isOwner: boolean }) {
  const [{ memberships, dues, payments, plans, registrationFee, introsUsed }, person, ctx] = await Promise.all([
    loadProfileMoney(profileId),
    prisma.profile.findUnique({ where: { id: profileId }, select: { code: true, fullName: true, contactName: true, phone: true } }),
    messageContext(),
  ]);
  const baseVars = { ...ctx.base, name: person ? addressee(person) : "", code: person?.code ?? "" };
  const waReason = whatsappConfigured ? (person?.phone ? null : "No phone number on this profile") : "WhatsApp is available on the production server";
  const current = memberships[0];
  const left = current ? daysLeft(current.endDate) : null;
  const openDues = dues.filter((d) => d.status === "OPEN");
  const outstanding = openDues.reduce((s, d) => s + dueBalance(d, d.payments), 0);
  const hasRegistration = dues.some((d) => d.kind === "REGISTRATION") || payments.some((p) => p.kind === "REGISTRATION" && !p.voidedAt);
  const today = todayIST().toISOString().slice(0, 10);

  return (
    <div id="money">
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            Payments &amp; membership
            {outstanding > 0 ? <Badge tone="red">{rupees(outstanding)} due</Badge> : dues.length > 0 && <Badge tone="green">Nothing due</Badge>}
          </span>
        }
      >
        <div className="space-y-5">
          {/* Membership */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Membership</h3>
            {current ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">{current.plan.name}</span>
                <span className="text-zinc-600">{formatDateOnly(current.startDate)} to {formatDateOnly(current.endDate)}</span>
                {left! < 0 ? <Badge tone="red">Expired {-left!} days ago</Badge> : left! <= 14 ? <Badge tone="amber">{left} days left</Badge> : <Badge tone="green">{left} days left</Badge>}
                {left! <= 14 && (
                  <SendMessageButton
                    channel="whatsapp"
                    label="Renewal reminder"
                    title="Membership renewal reminder"
                    action={sendReminder}
                    defaultTo={person?.phone}
                    defaultText={renderTemplate(ctx.templates.renewal, { ...baseVars, plan: current.plan.name, end_date: formatDateOnly(current.endDate) })}
                    fields={{ kind: "renewal", profileId }}
                    variant="ghost"
                    className="text-brand-700"
                    disabledReason={waReason}
                  />
                )}
                <span className="text-zinc-600">
                  Introductions: {introsUsed}
                  {current.plan.introLimit != null && ` of ${current.plan.introLimit}`}
                  {current.plan.introLimit != null && introsUsed >= current.plan.introLimit && <Badge tone="red">limit reached</Badge>}
                </span>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No membership yet.</p>
            )}
            {memberships.length > 1 && (
              <p className="mt-1 text-xs text-zinc-500">
                Earlier: {memberships.slice(1).map((m) => `${m.plan.name} (${formatDateOnly(m.startDate)})`).join(", ")}
              </p>
            )}
            <details className="mt-2" open={!current}>
              <summary className="cursor-pointer text-sm font-medium text-brand-700">{current ? "Renew / start new membership" : "Start membership"}</summary>
              <div className="mt-3">
                <MembershipForm profileId={profileId} plans={plans} defaultStart={current && left! >= 0 ? new Date(current.endDate.getTime() + 86400000).toISOString().slice(0, 10) : today} />
              </div>
            </details>
          </section>

          {/* Dues */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Dues</h3>
            {dues.length === 0 ? (
              <p className="text-sm text-zinc-500">No charges yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
                {dues.map((d) => {
                  const bal = dueBalance(d, d.payments);
                  const paid = paidTotal(d.payments);
                  return (
                    <li key={d.id} className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="min-w-0 flex-1 font-medium">{d.label}</span>
                        <span className="text-zinc-600">{rupees(d.amount)}</span>
                        {paid > 0 && <span className="text-zinc-500">paid {rupees(paid)}</span>}
                        {d.status === "OPEN" && <Badge tone="red">{rupees(bal)} due</Badge>}
                        {d.status === "PAID" && <Badge tone="green">Paid</Badge>}
                        {d.status === "WAIVED" && <Badge>Waived{d.notes && d.notes !== "Waived" ? `: ${d.notes}` : ""}</Badge>}
                      </div>
                      {d.status === "OPEN" && (
                        <div className="mt-2 flex flex-wrap items-start gap-3 text-sm">
                          <SendMessageButton
                            channel="whatsapp"
                            label="Reminder"
                            title={`Payment reminder: ${d.label}`}
                            action={sendReminder}
                            defaultTo={person?.phone}
                            defaultText={renderTemplate(ctx.templates.paymentDue, { ...baseVars, amount: rupees(dueBalance(d, d.payments)), for: d.label })}
                            fields={{ kind: "payment_due", profileId }}
                            variant="ghost"
                            className="-my-1.5 text-brand-700"
                            disabledReason={waReason}
                          />
                          <details>
                            <summary className="cursor-pointer font-medium text-brand-700">Receive payment</summary>
                            <form action={payDue} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                              <input type="hidden" name="dueId" value={d.id} />
                              <Field label="Amount (₹)"><input name="amount" inputMode="numeric" defaultValue={bal} className={inputClass} /></Field>
                              <Field label="Paid by">{modeSelect}</Field>
                              <Field label="Reference"><input name="reference" placeholder="UPI / cheque no." className={inputClass} /></Field>
                              <Field label="Date"><input type="date" name="paidAt" defaultValue={today} max={today} className={inputClass} /></Field>
                              <div className="flex items-end"><SubmitButton>Save &amp; receipt</SubmitButton></div>
                            </form>
                          </details>
                          <details>
                            <summary className="cursor-pointer text-zinc-600">Change amount</summary>
                            <form action={editDueAmount} className="mt-2 flex items-end gap-2">
                              <input type="hidden" name="dueId" value={d.id} />
                              <Field label="New amount (₹)"><input name="amount" inputMode="numeric" defaultValue={d.amount} className={inputClass + " w-32!"} /></Field>
                              <SubmitButton variant="secondary">Save</SubmitButton>
                            </form>
                          </details>
                          {isOwner && (
                            <details>
                              <summary className="cursor-pointer text-zinc-600">Waive</summary>
                              <form action={waiveDue} className="mt-2 flex items-end gap-2">
                                <input type="hidden" name="dueId" value={d.id} />
                                <Field label="Reason"><input name="reason" className={inputClass + " w-56!"} /></Field>
                                <SubmitButton variant="danger" confirm="Waive the remaining amount?">Waive</SubmitButton>
                              </form>
                            </details>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              {!hasRegistration && registrationFee > 0 && (
                <form action={addCharge}>
                  <input type="hidden" name="profileId" value={profileId} />
                  <input type="hidden" name="kind" value="REGISTRATION" />
                  <input type="hidden" name="amount" value={registrationFee} />
                  <SubmitButton variant="secondary">Charge registration fee ({rupees(registrationFee)})</SubmitButton>
                </form>
              )}
              <details>
                <summary className="cursor-pointer text-zinc-600">Add another charge</summary>
                <form action={addCharge} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="profileId" value={profileId} />
                  <input type="hidden" name="kind" value="OTHER" />
                  <Field label="For"><input name="label" required placeholder="e.g. Kundli matching" className={inputClass + " w-56!"} /></Field>
                  <Field label="Amount (₹)"><input name="amount" required inputMode="numeric" className={inputClass + " w-32!"} /></Field>
                  <SubmitButton variant="secondary">Add charge</SubmitButton>
                </form>
              </details>
            </div>
          </section>

          {/* Receipts */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Receipts</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-zinc-500">No payments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-zinc-500">
                    <tr><th className="py-1 pr-3">Receipt</th><th className="py-1 pr-3">Date</th><th className="py-1 pr-3">For</th><th className="py-1 pr-3">Mode</th><th className="py-1 text-right">Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {payments.map((p) => (
                      <tr key={p.id} className={cx(p.voidedAt && "text-zinc-400")}>
                        <td className="py-1.5 pr-3"><Link href={`/payments/${p.id}/receipt`} className="font-mono text-brand-700 hover:underline">{p.receiptNo}</Link></td>
                        <td className="py-1.5 pr-3">{formatDateTime(p.paidAt)}</td>
                        <td className="py-1.5 pr-3">
                          {p.description || KIND_LABELS[p.kind]}
                          {p.voidedAt && <span className="ml-1"><Badge tone="red">Void</Badge></span>}
                        </td>
                        <td className="py-1.5 pr-3">{MODE_LABELS[p.mode]}{p.reference && ` · ${p.reference}`}</td>
                        <td className={cx("py-1.5 text-right font-medium", p.voidedAt && "line-through")}>{rupees(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </Card>
    </div>
  );
}
