/**
 * Indian / Punjabi demo (sample) data for trying the CRM: profiles across faiths, NRIs and second
 * marriages, leads, follow-ups, notes, plans, memberships with receipts and open dues, and proposals at
 * every pipeline stage. Everything is flagged `isDemo` (or attached to a demo profile), so
 * deleteDemoData() removes it all and leaves the bureau's own records untouched.
 *
 * Safety: phone numbers are 00000 0xxxx (no real person can be messaged) and emails use example.com.
 * Plain module (no Next.js imports): used by the app and by prisma/seed-demo.ts.
 */
import type { Gender, LeadSource, LeadStatus, MaritalStatus, NoteKind, PaymentMode, PrismaClient, ProposalStatus } from "@prisma/client";

export const DEMO_TAG = "Demo data";
const DAY = 86400000;

// Small deterministic random generator so every bureau gets the same, repeatable sample
function rng(seed: number) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return {
    rnd,
    pick: <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)],
    between: (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1)),
  };
}

const MALE_SIKH = ["Harjot", "Gurpreet", "Manpreet", "Jaskaran", "Arshdeep", "Navdeep", "Sukhwinder", "Jagjit", "Inderjit", "Paramvir", "Simarjeet", "Lovepreet", "Yuvraj", "Harmanpreet", "Gurkirat"];
const FEMALE_SIKH = ["Simran", "Harleen", "Navneet", "Jasleen", "Kiranjeet", "Ramandeep", "Gurleen", "Manjot", "Sukhmani", "Rupinder", "Amandeep", "Prabhjot", "Harnoor", "Jasmeet", "Navkiran"];
const MALE_HINDU = ["Rohit", "Amit", "Karan", "Rajat", "Vikas", "Tarun", "Ankit", "Sahil", "Nitin", "Varun", "Abhishek", "Deepak"];
const FEMALE_HINDU = ["Priya", "Neha", "Anjali", "Pooja", "Tanvi", "Kavya", "Ishita", "Mehak", "Ritika", "Shivani", "Nidhi", "Sakshi"];
const HINDU_SURNAMES = ["Sharma", "Arora", "Kapoor", "Bansal", "Malhotra", "Verma", "Khanna", "Mehra", "Goyal", "Sood"];
const SIKH_GOTRAS = ["Sandhu", "Sidhu", "Gill", "Dhillon", "Grewal", "Brar", "Virk", "Bajwa", "Randhawa", "Cheema", "Mann", "Sekhon"];
const HINDU_GOTRAS = ["Bhardwaj", "Kashyap", "Vashisht", "Gautam", "Garg", "Goyal", "Bansal", "Mittal"];
const PUNJAB = ["Ludhiana", "Jalandhar", "Amritsar", "Patiala", "Mohali", "Bathinda", "Moga", "Hoshiarpur", "Phagwara", "Kapurthala", "Sangrur", "Ferozepur"];
const OTHER_INDIA: [string, string][] = [["Chandigarh", "Chandigarh"], ["New Delhi", "Delhi"], ["Panchkula", "Haryana"], ["Ambala", "Haryana"], ["Karnal", "Haryana"], ["Jammu", "Jammu & Kashmir"]];
const ABROAD: [string, string, string][] = [
  ["Canada", "Brampton", "PR (permanent resident)"],
  ["Canada", "Surrey", "Work permit"],
  ["Canada", "Winnipeg", "Citizen"],
  ["United Kingdom", "Southall", "Citizen"],
  ["Australia", "Melbourne", "Student visa"],
  ["USA", "Fresno", "Citizen"],
  ["New Zealand", "Auckland", "PR (permanent resident)"],
];
const DISTRICTS = ["Ludhiana", "Jalandhar", "Amritsar", "Moga", "Sangrur", "Patiala", "Gurdaspur", "Nawanshahr", "Tarn Taran", "Barnala"];
const EDU = ["12th", "Graduate", "B.Tech / B.E.", "B.Com", "BCA", "MBA", "M.Tech", "MBBS", "B.Sc Nursing", "LLB", "M.A. (English)"];
const JOBS = ["Private job", "Government job", "Business", "Agriculture / farming", "IT / software", "Nurse", "Teacher", "Bank officer", "Doctor", "Lawyer"];
const INCOME = ["Up to ₹3 lakh", "₹3–5 lakh", "₹5–10 lakh", "₹10–20 lakh"];

const NOTES: [NoteKind, string][] = [
  ["VISIT", "Parents visited the office. Looking for a well-settled, educated family; Doaba region preferred."],
  ["CALL", "Mother called: open to an NRI match if the boy is a PR in Canada."],
  ["CALL", "Family wants a vegetarian match from the same community. Height 5'4\" or more."],
  ["WHATSAPP", "Shared 3 biodatas on WhatsApp. They will discuss with relatives this weekend."],
  ["VISIT", "Brother came to update photos and new job details (joined bank last month)."],
  ["CALL", "Asked us to pause new proposals until after the cousin's wedding next month."],
  ["OTHER", "Kundli received. Family says manglik match is a must."],
  ["CALL", "Father prefers a match within Punjab; daughter is a teacher in a government school."],
];

const LEADS: { name: string; forWhom: string; gender: Gender; city: string; source: LeadSource; status: LeadStatus; details: string; followUpDays?: number; lostReason?: string }[] = [
  { name: "Balwinder Singh Gill", forWhom: "Son", gender: "MALE", city: "Moga", source: "WALK_IN", status: "NEW", details: "Son 29, B.Tech, works in Mohali. Wants a working girl.", followUpDays: 0 },
  { name: "Sunita Arora", forWhom: "Daughter", gender: "FEMALE", city: "Ludhiana", source: "PHONE", status: "FOLLOW_UP", details: "Daughter 26, MBA. Asked about Gold plan price.", followUpDays: -1 },
  { name: "Gurmeet Kaur", forWhom: "Daughter", gender: "FEMALE", city: "Jalandhar", source: "WHATSAPP", status: "NEW", details: "Daughter is a nurse, interested in a match settled in Canada.", followUpDays: 1 },
  { name: "Rakesh Sharma", forWhom: "Son", gender: "MALE", city: "Patiala", source: "REFERRAL", status: "FOLLOW_UP", details: "Referred by the Bansal family. Son is a government teacher.", followUpDays: 2 },
  { name: "Harpreet Singh Sandhu", forWhom: "Brother", gender: "MALE", city: "Brampton, Canada", source: "SOCIAL_MEDIA", status: "NEW", details: "Calling for younger brother (PR in Canada), family in Amritsar.", followUpDays: 0 },
  { name: "Neelam Kapoor", forWhom: "Daughter", gender: "FEMALE", city: "Chandigarh", source: "NEWSPAPER", status: "FOLLOW_UP", details: "Saw our ad in the Sunday paper. Second marriage, no children.", followUpDays: 3 },
  { name: "Jaswinder Kaur Brar", forWhom: "Son", gender: "MALE", city: "Bathinda", source: "PHONE", status: "LOST", details: "Wanted only free registration.", lostReason: "Joined another bureau" },
  { name: "Daniel Masih", forWhom: "Self", gender: "MALE", city: "Gurdaspur", source: "WALK_IN", status: "NEW", details: "Christian, 31, works in a private school. Looking within the community.", followUpDays: 1 },
];

export async function demoCounts(db: PrismaClient) {
  const [profiles, leads, plans] = await Promise.all([
    db.profile.count({ where: { isDemo: true } }),
    db.lead.count({ where: { isDemo: true } }),
    db.plan.count({ where: { isDemo: true } }),
  ]);
  return { profiles, leads, plans, any: profiles + leads + plans > 0 };
}

export class DemoDataError extends Error {}

/** Adds the demo set. Refuses if demo data is already there. */
export async function loadDemoData(db: PrismaClient, now = new Date()) {
  if ((await demoCounts(db)).any) throw new DemoDataError("Demo data is already loaded. Delete it first to load it again.");
  const owner = await db.user.findFirst({ where: { role: "OWNER", active: true }, orderBy: { createdAt: "asc" } });
  if (!owner) throw new DemoDataError("The bureau needs an owner login first.");
  const { rnd, pick, between } = rng(42);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysFrom = (d: number) => new Date(today.getTime() + d * DAY);
  const at = (d: number, h: number) => new Date(today.getTime() + d * DAY + (h - 5.5) * 3600000); // h = India time

  const nextCode = async () => {
    const s = await db.settings.update({ where: { id: 1 }, data: { nextProfileNumber: { increment: 1 } }, select: { profileCodePrefix: true, nextProfileNumber: true } });
    return `${s.profileCodePrefix}${s.nextProfileNumber - 1}`;
  };
  const nextReceipt = async () => {
    const s = await db.settings.update({ where: { id: 1 }, data: { nextReceiptNumber: { increment: 1 } }, select: { receiptPrefix: true, nextReceiptNumber: true } });
    return `${s.receiptPrefix}${s.nextReceiptNumber - 1}`;
  };

  // ── profiles ──
  type P = { id: string; code: string; fullName: string; gender: Gender; fatherName: string | null };
  const profiles: P[] = [];
  for (let i = 0; i < 40; i++) {
    const gender: Gender = i % 2 === 0 ? "MALE" : "FEMALE";
    const r = rnd();
    const religion = i === 37 || i === 38 ? "Christian" : i === 39 || i === 36 ? "Muslim" : r < 0.6 ? "Sikh" : "Hindu";
    const sikh = religion === "Sikh";
    const hindu = religion === "Hindu";
    const caste = sikh ? pick(["Jatt", "Jatt", "Jatt", "Ramgarhia", "Saini", "Kamboj", "Arora", "Khatri"]) : hindu ? pick(["Khatri", "Arora", "Brahmin", "Bania / Aggarwal", "Rajput"]) : null;
    const gotras = sikh ? SIKH_GOTRAS : HINDU_GOTRAS;
    const gotraSelf = sikh || hindu ? pick(gotras) : null;
    let gotraMother = sikh || hindu ? pick(gotras) : null;
    while (gotraMother && gotraMother === gotraSelf) gotraMother = pick(gotras);
    const age = gender === "MALE" ? between(25, 36) : between(22, 32);
    const nri = rnd() < 0.25 ? pick(ABROAD) : null;
    const otherIndia = !nri && rnd() < 0.2 ? pick(OTHER_INDIA) : null;
    const second = rnd() < 0.12;
    const maritalStatus: MaritalStatus = second ? pick(["DIVORCED", "WIDOWED", "AWAITING_DIVORCE"] as const) : "NEVER_MARRIED";
    const heightCm = gender === "MALE" ? between(168, 188) : between(152, 170);
    let fullName: string;
    if (sikh) fullName = `${pick(gender === "MALE" ? MALE_SIKH : FEMALE_SIKH)} ${gender === "MALE" ? "Singh" : "Kaur"} ${gotraSelf}`;
    else if (hindu) fullName = `${pick(gender === "MALE" ? MALE_HINDU : FEMALE_HINDU)} ${pick(HINDU_SURNAMES)}`;
    else if (religion === "Christian") fullName = gender === "MALE" ? "Samuel Masih" : "Sonia Gill Masih";
    else fullName = gender === "MALE" ? "Imran Khan" : "Ayesha Qureshi";
    const fatherName = sikh ? `${pick(MALE_SIKH)} Singh` : hindu ? `${pick(MALE_HINDU)} ${fullName.split(" ").pop()}` : religion === "Christian" ? "Joseph Masih" : "Abdul Rashid";
    const city = nri ? nri[1] : otherIndia ? otherIndia[0] : religion === "Muslim" ? "Malerkotla" : pick(PUNJAB);
    const code = await nextCode();
    const p = await db.profile.create({
      data: {
        code,
        fullName,
        gender,
        dob: new Date(Date.UTC(today.getUTCFullYear() - age, between(0, 11), between(1, 28))),
        heightCm,
        maritalStatus,
        childrenCount: second && rnd() < 0.4 ? 1 : 0,
        religion,
        caste,
        gotraSelf,
        gotraMother,
        sikhStatus: sikh ? pick(["Keshdhari", "Amritdhari", "Clean shaven", "Sehajdhari"]) : null,
        manglik: hindu ? pick(["No", "No", "Yes", "Anshik (partial)"]) : null,
        education: pick(EDU),
        profession: pick(JOBS),
        annualIncome: nri ? "Abroad: $50k–100k" : pick(INCOME),
        diet: pick(["Vegetarian", "Vegetarian", "Non-vegetarian", "Eggetarian"]),
        city,
        state: nri ? null : otherIndia ? otherIndia[1] : "Punjab",
        country: nri ? nri[0] : "India",
        visaStatus: nri ? nri[2] : null,
        nativeDistrict: pick(DISTRICTS),
        fatherName,
        phone: `00000 0${String(1000 + i).padStart(4, "0")}`,
        email: `family.demo${i + 1}@example.com`,
        consentGiven: true,
        consentAt: now,
        urgent: rnd() < 0.1,
        status: i === 33 ? "ON_HOLD" : "ACTIVE",
        importedFrom: DEMO_TAG,
        isDemo: true,
        createdById: owner.id,
        preference: {
          create: {
            ageMin: gender === "MALE" ? age - 7 : age,
            ageMax: gender === "MALE" ? age : age + 7,
            religions: rnd() < 0.85 ? [religion] : [],
            castes: caste && rnd() < 0.5 ? [caste] : [],
            casteNoBar: rnd() < 0.2,
            maritalStatuses: second ? [] : ["NEVER_MARRIED"],
            countries: rnd() < 0.25 ? ["Canada"] : [],
            education: rnd() < 0.4 ? "Graduate" : null,
            diet: rnd() < 0.3 ? "Vegetarian" : null,
          },
        },
      },
      select: { id: true, code: true, fullName: true, gender: true, fatherName: true },
    });
    profiles.push(p);
  }

  // ── notes and follow-ups on profiles ──
  for (let i = 0; i < 12; i++) {
    const [kind, body] = NOTES[i % NOTES.length];
    await db.note.create({ data: { kind, body, profileId: profiles[i * 3].id, authorId: owner.id, createdAt: at(-between(1, 40), 11) } });
  }
  const followUps: [number, string, number][] = [
    [1, "Call family about the Brampton proposal", 0],
    [4, "Collect updated photos", -2],
    [6, "Remind about membership renewal", 1],
    [9, "Fix meeting at the office", 0],
    [12, "Ask for kundli", 3],
    [15, "Share 3 new matches", 2],
  ];
  for (const [idx, title, d] of followUps) {
    await db.followUp.create({ data: { title, dueAt: at(d, 11 + idx % 5), profileId: profiles[idx].id, createdById: owner.id } });
  }

  // ── leads ──
  for (let i = 0; i < LEADS.length; i++) {
    const l = LEADS[i];
    const lead = await db.lead.create({
      data: {
        name: l.name,
        phone: `00000 0${String(2000 + i)}`,
        source: l.source,
        forWhom: l.forWhom,
        gender: l.gender,
        city: l.city,
        details: l.details,
        status: l.status,
        lostReason: l.lostReason ?? null,
        isDemo: true,
        createdById: owner.id,
        createdAt: at(-between(0, 20), 10),
      },
    });
    if (l.followUpDays !== undefined && l.status !== "LOST") {
      await db.followUp.create({ data: { title: `Call ${l.name.split(" ")[0]} back`, dueAt: at(l.followUpDays, 12), leadId: lead.id, createdById: owner.id } });
    }
  }

  // ── plans, memberships, receipts, dues ──
  let plans = await db.plan.findMany({ where: { active: true }, orderBy: { price: "asc" }, take: 2 });
  if (!plans.length) {
    plans = [
      await db.plan.create({ data: { name: "Silver (3 months)", durationDays: 90, price: 5100, introLimit: 15, description: "Sample plan", isDemo: true } }),
      await db.plan.create({ data: { name: "Gold (6 months)", durationDays: 180, price: 11000, introLimit: 30, successFee: 21000, description: "Sample plan", isDemo: true } }),
    ];
  }
  const modes: PaymentMode[] = ["CASH", "UPI", "UPI", "BANK"];
  let receipts = 0;
  for (let i = 0; i < 14; i++) {
    const p = profiles[i * 2 + 1];
    const plan = plans[i % plans.length];
    const start = daysFrom(-between(5, plan.durationDays - 3));
    const m = await db.membership.create({
      data: { profileId: p.id, planId: plan.id, startDate: start, endDate: new Date(start.getTime() + plan.durationDays * DAY), price: plan.price, successFee: plan.successFee },
    });
    // 10 paid in full, 2 part-paid, 2 not paid yet
    const paid = i < 10 ? plan.price : i < 12 ? Math.round(plan.price / 2 / 100) * 100 : 0;
    const due = await db.due.create({
      data: { profileId: p.id, kind: "MEMBERSHIP", label: `${plan.name} membership`, amount: plan.price, membershipId: m.id, status: paid >= plan.price ? "PAID" : "OPEN", createdAt: start },
    });
    if (paid > 0) {
      await db.payment.create({
        data: {
          receiptNo: await nextReceipt(),
          profileId: p.id,
          payerName: p.fatherName ?? p.fullName,
          profileCode: p.code,
          kind: "MEMBERSHIP",
          amount: paid,
          mode: pick(modes),
          paidAt: new Date(start.getTime() + 11 * 3600000),
          membershipId: m.id,
          dueId: due.id,
          description: `${plan.name} membership`,
          createdById: owner.id,
        },
      });
      receipts++;
    }
  }

  // ── proposals at every stage ──
  const males = profiles.filter((p) => p.gender === "MALE");
  const females = profiles.filter((p) => p.gender === "FEMALE");
  const stages: { status: ProposalStatus; meeting?: number; reason?: string }[] = [
    { status: "SHARED" }, { status: "SHARED" }, { status: "SHARED" }, { status: "SHARED" },
    { status: "INTERESTED" }, { status: "INTERESTED" }, { status: "INTERESTED" },
    { status: "MEETING_SCHEDULED", meeting: 2 }, { status: "MEETING_SCHEDULED", meeting: 5 },
    { status: "MET" },
    { status: "DECLINED", reason: "Family wants a match settled abroad" }, { status: "DECLINED", reason: "Height preference" },
  ];
  const ORDER: ProposalStatus[] = ["SHARED", "INTERESTED", "MEETING_SCHEDULED", "MET"];
  for (let i = 0; i < stages.length; i++) {
    const st = stages[i];
    const from = i % 2 === 0 ? males[i] : females[i];
    const to = i % 2 === 0 ? females[(i + 3) % females.length] : males[(i + 5) % males.length];
    const created = at(-between(3, 25), 12);
    const path = st.status === "DECLINED" ? (["SHARED", "DECLINED"] as ProposalStatus[]) : ORDER.slice(0, ORDER.indexOf(st.status) + 1);
    await db.proposal.create({
      data: {
        fromProfileId: from.id,
        toProfileId: to.id,
        status: st.status,
        declineReason: st.reason ?? null,
        meetingAt: st.meeting !== undefined ? at(st.meeting, 16) : st.status === "MET" ? at(-2, 16) : null,
        createdById: owner.id,
        createdAt: created,
        events: {
          create: path.map((status, k) => ({ status, userId: owner.id, createdAt: new Date(created.getTime() + k * 2 * DAY), note: status === "DECLINED" ? st.reason : null })),
        },
      },
    });
  }

  return { profiles: profiles.length, leads: LEADS.length, proposals: stages.length, receipts, plansCreated: plans.filter((p) => p.isDemo).length };
}

/**
 * Removes every demo record and everything attached to demo profiles (notes, follow-ups, proposals,
 * memberships, dues, receipts, messages, photos). The bureau's own records are not touched.
 * Returns the upload keys of files that belonged to demo profiles, for the caller to delete.
 */
export async function deleteDemoData(db: PrismaClient) {
  const demo = await db.profile.findMany({ where: { isDemo: true }, select: { id: true, kundliPath: true, photos: { select: { path: true } } } });
  const ids = demo.map((p) => p.id);
  const files = demo.flatMap((p) => [...p.photos.map((ph) => ph.path), ...(p.kundliPath ? [p.kundliPath] : [])]);
  const result = await db.$transaction(
    async (tx) => {
      const payments = await tx.payment.deleteMany({ where: { profileId: { in: ids } } });
      await tx.outboundMessage.deleteMany({ where: { profileId: { in: ids } } });
      const leads = await tx.lead.deleteMany({ where: { OR: [{ isDemo: true }, { profileId: { in: ids } }] } });
      const profiles = await tx.profile.deleteMany({ where: { id: { in: ids } } });
      const plans = await tx.plan.deleteMany({ where: { isDemo: true, memberships: { none: {} } } });
      await tx.plan.updateMany({ where: { isDemo: true }, data: { isDemo: false } }); // still used by real memberships
      // A bureau that only had demo data starts its numbering again from the beginning
      const [profilesLeft, paymentsLeft] = await Promise.all([tx.profile.count(), tx.payment.count()]);
      await tx.settings.update({
        where: { id: 1 },
        data: { ...(profilesLeft === 0 ? { nextProfileNumber: 1001 } : {}), ...(paymentsLeft === 0 ? { nextReceiptNumber: 1 } : {}) },
      });
      return { profiles: profiles.count, leads: leads.count, plans: plans.count, payments: payments.count, numberingReset: profilesLeft === 0 };
    },
    { timeout: 60_000 },
  );
  return { ...result, files };
}
