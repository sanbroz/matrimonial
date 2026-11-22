/**
 * Demo profiles for trying out search and match suggestions.
 *   npm run db:seed-demo
 * All demo profiles have importedFrom = "Demo data". Remove everything with `npx prisma migrate reset`.
 */
import { PrismaClient, type Gender, type MaritalStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Small deterministic random generator so runs are repeatable
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

const MALE = ["Harjot", "Gurpreet", "Manpreet", "Jaskaran", "Arshdeep", "Rohit", "Amit", "Karan", "Navdeep", "Sukhwinder", "Rajat", "Vikas", "Jagjit", "Tarun", "Inderjit", "Paramvir", "Simarjeet", "Ankit", "Lovepreet", "Yuvraj"];
const FEMALE = ["Simran", "Harleen", "Navneet", "Jasleen", "Priya", "Neha", "Kiranjeet", "Ramandeep", "Anjali", "Gurleen", "Manjot", "Pooja", "Sukhmani", "Rupinder", "Tanvi", "Amandeep", "Kavya", "Prabhjot", "Ishita", "Mehak"];
const SIKH_GOTRAS = ["Sandhu", "Sidhu", "Gill", "Dhillon", "Grewal", "Brar", "Virk", "Bajwa", "Randhawa", "Cheema", "Mann", "Sekhon"];
const HINDU_GOTRAS = ["Bhardwaj", "Kashyap", "Vashisht", "Gautam", "Garg", "Goyal", "Bansal", "Mittal"];
const CITIES = ["Ludhiana", "Jalandhar", "Amritsar", "Patiala", "Mohali", "Bathinda", "Moga", "Hoshiarpur"];
const ABROAD = [["Canada", "Brampton", "PR (permanent resident)"], ["Canada", "Surrey", "Work permit"], ["United Kingdom", "Southall", "Citizen"], ["Australia", "Melbourne", "Student visa"], ["USA", "Fresno", "Citizen"]];
const EDU = ["12th", "Graduate", "B.Tech / B.E.", "B.Com", "MBA", "M.Tech", "MBBS", "Nursing"];
const JOBS = ["Private job", "Government job", "Business", "Agriculture / farming", "IT / software", "Nurse", "Teacher"];
const INCOME = ["Up to ₹3 lakh", "₹3–5 lakh", "₹5–10 lakh", "₹10–20 lakh", "Abroad: $50k–100k"];

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER" } });
  const existing = await prisma.profile.count({ where: { importedFrom: "Demo data" } });
  if (existing > 0) {
    console.log(`Demo data already present (${existing} profiles). Nothing added.`);
    return;
  }

  for (let i = 0; i < 40; i++) {
    const gender: Gender = i % 2 === 0 ? "MALE" : "FEMALE";
    const sikh = rnd() < 0.65;
    const religion = sikh ? "Sikh" : "Hindu";
    const caste = sikh ? pick(["Jatt", "Jatt", "Jatt", "Ramgarhia", "Saini", "Kamboj"]) : pick(["Khatri", "Arora", "Brahmin", "Bania / Aggarwal"]);
    const gotras = sikh ? SIKH_GOTRAS : HINDU_GOTRAS;
    const gotraSelf = pick(gotras);
    let gotraMother = pick(gotras);
    while (gotraMother === gotraSelf) gotraMother = pick(gotras);
    const age = gender === "MALE" ? between(25, 36) : between(22, 32);
    const nri = rnd() < 0.3 ? pick(ABROAD) : null;
    const second = rnd() < 0.12;
    const maritalStatus: MaritalStatus = second ? pick(["DIVORCED", "WIDOWED", "AWAITING_DIVORCE"] as MaritalStatus[]) : "NEVER_MARRIED";
    const heightCm = gender === "MALE" ? between(168, 188) : between(152, 170);
    const first = gender === "MALE" ? pick(MALE) : pick(FEMALE);
    const fullName = sikh ? `${first} ${gender === "MALE" ? "Singh" : "Kaur"} ${gotraSelf}` : `${first} ${pick(["Sharma", "Arora", "Kapoor", "Bansal", "Malhotra"])}`;

    const s = await prisma.settings.update({ where: { id: 1 }, data: { nextProfileNumber: { increment: 1 } } });
    const code = `${s.profileCodePrefix}${s.nextProfileNumber - 1}`;

    await prisma.profile.create({
      data: {
        code,
        fullName,
        gender,
        dob: new Date(Date.UTC(2026 - age, between(0, 11), between(1, 28))),
        heightCm,
        maritalStatus,
        childrenCount: second && rnd() < 0.4 ? 1 : 0,
        religion,
        caste,
        gotraSelf,
        gotraMother,
        sikhStatus: sikh ? pick(["Keshdhari", "Amritdhari", "Clean shaven", "Sehajdhari"]) : null,
        manglik: sikh ? null : pick(["No", "No", "Yes", "Anshik (partial)"]),
        education: pick(EDU),
        profession: pick(JOBS),
        annualIncome: nri ? "Abroad: $50k–100k" : pick(INCOME.slice(0, 4)),
        diet: pick(["Vegetarian", "Vegetarian", "Non-vegetarian", "Eggetarian"]),
        city: nri ? nri[1] : pick(CITIES),
        state: nri ? null : "Punjab",
        country: nri ? nri[0] : "India",
        visaStatus: nri ? nri[2] : null,
        nativeDistrict: pick(["Ludhiana", "Jalandhar", "Amritsar", "Moga", "Sangrur", "Patiala"]),
        fatherName: `${pick(MALE)} ${sikh ? "Singh" : "Lal"}`,
        phone: `98${String(10000000 + i * 7919).slice(0, 8)}`,
        consentGiven: true,
        consentAt: new Date(),
        urgent: rnd() < 0.1,
        importedFrom: "Demo data",
        createdById: owner.id,
        preference: {
          create: {
            ageMin: gender === "MALE" ? age - 7 : age,
            ageMax: gender === "MALE" ? age : age + 7,
            religions: rnd() < 0.8 ? [religion] : [],
            castes: rnd() < 0.5 ? [caste] : [],
            casteNoBar: rnd() < 0.2,
            maritalStatuses: second ? [] : ["NEVER_MARRIED"],
            countries: rnd() < 0.25 ? ["Canada"] : [],
            education: rnd() < 0.4 ? "Graduate" : null,
            diet: rnd() < 0.3 ? "Vegetarian" : null,
          },
        },
      },
    });
  }
  console.log("Added 40 demo profiles (importedFrom = 'Demo data').");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
