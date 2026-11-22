import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/storage";
import { ageFrom, formatDateOnly, formatDateTime, formatHeight, maritalLabel } from "@/lib/format";
import { MARITAL_LABELS } from "@/lib/profile-fields";
import { Alert, Badge, ButtonLink, Card, DL, PageHeader, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { FollowUpsPanel, NotesPanel } from "@/components/activity-panel";
import { deleteProfileAction, uploadKundli } from "../actions";
import { PhotoGallery } from "./photo-gallery";
import { ProposalsPanel } from "./proposals-panel";
import { MoneyPanel } from "./money-panel";
import { MessagesLog } from "./messages-log";
import { countMatches } from "@/lib/services/matching";

export const metadata = { title: "Profile" };

const STATUS_TONE = { ACTIVE: "green", ON_HOLD: "amber", MATCHED: "brand", CLOSED: "zinc" } as const;
const STATUS_LABEL = { ACTIVE: "Active", ON_HOLD: "On hold", MATCHED: "Matched", CLOSED: "Closed" } as const;

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; uploadError?: string; deleteError?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const p = await prisma.profile.findUnique({
    where: { id },
    include: {
      preference: true,
      photos: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      followUps: { orderBy: { dueAt: "asc" } },
      lead: { select: { id: true, name: true, createdAt: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!p) notFound();
  const matchCount = (await countMatches([p.id])).get(p.id);
  const pref = p.preference;
  const age = ageFrom(p.dob);
  const isOwner = user.role === "OWNER";
  const yesIf = (b: boolean | null | undefined) => (b ? "Yes" : null);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-brand-700">{p.code}</span> {p.fullName}
            <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
            {p.urgent && <Badge tone="red">Urgent</Badge>}
            {p.vip && <Badge tone="amber">VIP</Badge>}
            {p.specialCase && <Badge tone="blue">Special case</Badge>}
          </span>
        }
        subtitle={[
          p.gender === "MALE" ? "Groom" : "Bride",
          age != null ? `${age} yrs` : null,
          formatHeight(p.heightCm) || null,
          p.religion,
          p.caste,
          [p.city, p.country].filter(Boolean).join(", ") || null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <ButtonLink href={`/profiles/${p.id}/biodata`}>Biodata</ButtonLink>
            <ButtonLink href={`/profiles/${p.id}/matches`}>
              Suggested matches{matchCount !== undefined && <span className="rounded-full bg-brand-50 px-2 text-xs font-semibold text-brand-700">{matchCount}</span>}
            </ButtonLink>
            <ButtonLink href={`/profiles/${p.id}/edit`} variant="primary">Edit profile</ButtonLink>
          </>
        }
      />

      <div className="mb-4 space-y-2">
        {sp.created && <Alert tone="green">Profile created with code {p.code}.</Alert>}
        {sp.saved && <Alert tone="green">Changes saved.</Alert>}
        {sp.uploadError && <Alert>{sp.uploadError}</Alert>}
        {!p.consentGiven && <Alert tone="amber">Client consent is not recorded yet. Tick it under Edit once taken.</Alert>}
      </div>

      <div id="photos" className="mb-5">
        <Card title={`Photos (${p.photos.length})`}>
          <PhotoGallery
            profileId={p.id}
            photos={p.photos.map((ph) => ({ id: ph.id, url: fileUrl(ph.path), isPrimary: ph.isPrimary, onBiodata: ph.onBiodata }))}
          />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Basic details">
            <DL
              items={[
                ["Date of birth", p.dob ? `${formatDateOnly(p.dob)} (${age} yrs)` : null],
                ["Birth time / place", [p.birthTime, p.birthPlace].filter(Boolean).join(", ")],
                ["Height", formatHeight(p.heightCm)],
                ["Weight", p.weightKg ? `${p.weightKg} kg` : null],
                ["Complexion", p.complexion],
                ["Body type", p.bodyType],
                ["Marital status", maritalLabel(p.maritalStatus)],
                ["Children", p.maritalStatus !== "NEVER_MARRIED" ? `${p.childrenCount}${p.childrenLivingWith ? ` (with ${p.childrenLivingWith})` : ""}` : null],
                ["Disability / health", p.disability],
                ["Diet", p.diet],
                ["Smoking / drinking", [p.smoking, p.drinking].some(Boolean) ? `${p.smoking ?? "?"} / ${p.drinking ?? "?"}` : null],
                ["Mother tongue", p.motherTongue],
              ]}
            />
            {p.about && <p className="mt-3 whitespace-pre-wrap border-t border-zinc-100 pt-3 text-sm">{p.about}</p>}
          </Card>

          <Card title="Religion, community & horoscope">
            <DL
              items={[
                ["Religion", p.religion],
                ["Caste", [p.caste, p.subCaste].filter(Boolean).join(" / ")],
                ["Gotra (self)", p.gotraSelf],
                ["Gotra (mother)", p.gotraMother],
                ["Gotra (dadi)", p.gotraGrandmother],
                ["Sikh status", p.sikhStatus],
                ["Manglik", p.manglik],
                ["Rashi / nakshatra", [p.rashi, p.nakshatra].filter(Boolean).join(" / ")],
              ]}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
              <span className="text-sm text-zinc-500">Kundli:</span>
              {p.kundliPath ? (
                <>
                  <a href={fileUrl(p.kundliPath)} target="_blank" className="text-sm text-brand-700 underline">View file</a>
                  <form action={uploadKundli}>
                    <input type="hidden" name="profileId" value={p.id} />
                    <input type="hidden" name="op" value="delete" />
                    <SubmitButton variant="ghost" pendingText="…" confirm="Remove the kundli file?">Remove</SubmitButton>
                  </form>
                </>
              ) : (
                <form action={uploadKundli} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="profileId" value={p.id} />
                  <input type="file" name="kundli" required aria-label="Kundli file (PDF or image)" accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm" />
                  <SubmitButton variant="secondary" pendingText="Uploading…">Upload</SubmitButton>
                </form>
              )}
            </div>
          </Card>

          <Card title="Education, career & location">
            <DL
              items={[
                ["Education", [p.education, p.educationDetail].filter(Boolean).join(" — ")],
                ["Profession", p.profession],
                ["Employer / business", p.employer],
                ["Annual income", p.annualIncome],
                ["Lives in", [p.city, p.state, p.country].filter(Boolean).join(", ")],
                ["Native", [p.nativePlace, p.nativeDistrict].filter(Boolean).join(", ")],
                ["Visa / residency", p.visaStatus],
                ["Willing to settle abroad", p.willingAbroad],
              ]}
            />
          </Card>

          <Card title="Family">
            <DL
              items={[
                ["Father", [p.fatherName, p.fatherOccupation].filter(Boolean).join(" — ")],
                ["Mother", [p.motherName, p.motherOccupation].filter(Boolean).join(" — ")],
                ["Brothers", p.brothers != null ? `${p.brothers}${p.brothersMarried ? ` (${p.brothersMarried} married)` : ""}` : null],
                ["Sisters", p.sisters != null ? `${p.sisters}${p.sistersMarried ? ` (${p.sistersMarried} married)` : ""}` : null],
                ["Family type", p.familyType],
                ["Family values", p.familyValues],
                ["Property / land", p.property],
              ]}
            />
          </Card>

          <Card title="Partner preferences">
            <DL
              items={[
                ["Age", pref?.ageMin || pref?.ageMax ? `${pref?.ageMin ?? "?"} – ${pref?.ageMax ?? "?"} yrs` : null],
                ["Height", pref?.heightMinCm || pref?.heightMaxCm ? `${formatHeight(pref?.heightMinCm) || "?"} – ${formatHeight(pref?.heightMaxCm) || "?"}` : null],
                ["Religions", pref?.religions.join(", ")],
                ["Castes", pref?.casteNoBar ? "Caste no bar" : pref?.castes.join(", ")],
                ["Exclude castes", pref?.excludeCastes.join(", ")],
                ["Marital status", pref?.maritalStatuses.map((m) => MARITAL_LABELS[m]).join(", ")],
                ["Manglik", pref?.manglik],
                ["Countries", pref?.countries.join(", ")],
                ["Min. education", pref?.education],
                ["Min. income", pref?.minIncome],
                ["Diet", pref?.diet],
                ["Other", pref?.notes],
              ]}
            />
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Contact (internal only)">
            <DL
              items={[
                ["Contact", [p.contactName, p.contactRelation && `(${p.contactRelation})`].filter(Boolean).join(" ")],
                ["Phone", p.phone && <a href={`tel:${p.phone}`} className="text-brand-700">{p.phone}</a>],
                ["Alt. phone", p.altPhone && <a href={`tel:${p.altPhone}`} className="text-brand-700">{p.altPhone}</a>],
                ["WhatsApp", p.phone && <a href={`https://wa.me/${waNumber(p.phone)}`} target="_blank" className="text-brand-700">Open chat</a>],
                ["Email", p.email],
                ["Address", p.address],
              ]}
            />
          </Card>

          <FollowUpsPanel target={{ profileId: p.id }} followUps={p.followUps} />

          <Card title="Record">
            <DL
              items={[
                ["Added", `${formatDateTime(p.createdAt)} by ${p.createdBy.name}`],
                ["Last updated", formatDateTime(p.updatedAt)],
                ["Consent", p.consentGiven ? `Yes (${formatDateTime(p.consentAt)})` : "Not recorded"],
                ["From lead", p.lead && <Link href={`/leads/${p.lead.id}`} className="text-brand-700">{p.lead.name}</Link>],
                ["Imported from", p.importedFrom],
                ["Flags", [yesIf(p.urgent) && "Urgent", yesIf(p.vip) && "VIP", yesIf(p.specialCase) && "Special case"].filter(Boolean).join(", ")],
              ]}
            />
          </Card>
        </div>
      </div>

      <div className="mt-5">
        <ProposalsPanel profileId={p.id} />
      </div>

      {/* id here (not on the card) so the ?ok= / ?error= message is in view after "#money" */}
      <div id="money" className="mt-5 scroll-mt-4">
        {(sp.ok || sp.error) && <div className="mb-2">{sp.error ? <Alert>{sp.error}</Alert> : <Alert tone="green">{sp.ok}</Alert>}</div>}
        <MoneyPanel profileId={p.id} isOwner={isOwner} />
      </div>

      <div className="mt-5">
        <MessagesLog profileId={p.id} />
      </div>

      <div className="mt-5">
        <NotesPanel target={{ profileId: p.id }} notes={p.notes} currentUserId={user.id} isOwner={isOwner} />
      </div>

      {isOwner && (
        <div id="danger" className="mt-5">
          <Card title="Delete profile permanently">
            <p className="mb-3 text-sm text-zinc-600">
              Use this when a client asks for their data to be removed. It deletes the profile, photos, kundli, notes and
              follow-ups and <strong>cannot be undone</strong>. Type the code <span className="font-mono">{p.code}</span> to confirm.
            </p>
            {sp.deleteError && <div className="mb-2"><Alert>The code you typed did not match.</Alert></div>}
            <form action={deleteProfileAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="profileId" value={p.id} />
              <input name="confirmCode" aria-label="Type the profile code to confirm" placeholder={p.code} className={inputClass + " w-40!"} autoComplete="off" />
              <SubmitButton variant="danger" pendingText="Deleting…">Delete permanently</SubmitButton>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

/** wa.me needs country code + number, digits only. Assume India for 10-digit numbers. */
function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}
