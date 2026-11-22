/**
 * Starting values for the customisable dropdown lists.
 * The owner can add, remove or reorder these under Settings → Dropdown lists.
 * Fields stay free-text, so a value not in the list can still be typed.
 */
export const OPTION_CATEGORIES = {
  religion: "Religion",
  caste: "Caste / community",
  gotra: "Gotra",
  sikhStatus: "Sikh status",
  manglik: "Manglik",
  education: "Education",
  profession: "Profession",
  annualIncome: "Annual income",
  visaStatus: "Visa / residency status",
  country: "Country",
  state: "State / province",
  district: "District (Punjab)",
  complexion: "Complexion",
  bodyType: "Body type",
  diet: "Diet",
  habit: "Smoking / drinking",
  motherTongue: "Mother tongue",
  familyType: "Family type",
  familyValues: "Family values",
  rashi: "Rashi",
} as const;

export type OptionCategory = keyof typeof OPTION_CATEGORIES;

export const DEFAULT_OPTIONS: Record<OptionCategory, string[]> = {
  religion: ["Sikh", "Hindu", "Christian", "Muslim", "Jain", "Buddhist", "Other"],
  caste: [
    "Jatt", "Ramgarhia", "Khatri", "Arora", "Brahmin", "Saini", "Kamboj", "Labana",
    "Ravidasia", "Mazhabi", "Ahluwalia", "Rajput", "Bania / Aggarwal", "Sood",
    "Lubana", "Tarkhan", "Valmiki", "Kumhar / Prajapati", "Gujjar", "Christian", "Other",
  ],
  gotra: [],
  sikhStatus: ["Amritdhari", "Keshdhari", "Sehajdhari", "Clean shaven", "Not applicable"],
  manglik: ["No", "Yes", "Anshik (partial)", "Don't know"],
  education: [
    "Below 10th", "10th", "12th", "Diploma", "ITI", "Graduate", "B.Tech / B.E.",
    "B.Com", "BA", "B.Sc", "BCA", "MBA", "M.Tech", "MA", "M.Sc", "MCA", "M.Com",
    "MBBS", "BDS", "B.Pharm", "Nursing", "LLB", "CA", "PhD", "Other",
  ],
  profession: [
    "Private job", "Government job", "Business", "Self-employed", "Agriculture / farming",
    "Doctor", "Engineer", "Teacher", "Nurse", "Lawyer", "Police / defence", "Banking",
    "IT / software", "Student", "Not working", "Other",
  ],
  annualIncome: [
    "No income", "Up to ₹3 lakh", "₹3–5 lakh", "₹5–10 lakh", "₹10–20 lakh",
    "₹20–50 lakh", "₹50 lakh+", "Abroad: below $50k", "Abroad: $50k–100k", "Abroad: $100k+",
  ],
  visaStatus: [
    "Citizen", "PR (permanent resident)", "Work permit", "Student visa",
    "Spouse / dependent visa", "Visitor visa", "Not applicable (India)",
  ],
  country: [
    "India", "Canada", "United Kingdom", "USA", "Australia", "New Zealand",
    "Italy", "Germany", "UAE", "Other",
  ],
  state: [
    "Punjab", "Haryana", "Himachal Pradesh", "Chandigarh", "Delhi", "Jammu & Kashmir",
    "Rajasthan", "Uttar Pradesh", "Uttarakhand", "Other",
  ],
  district: [
    "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka",
    "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana",
    "Malerkotla", "Mansa", "Moga", "Mohali (SAS Nagar)", "Muktsar", "Nawanshahr (SBS Nagar)",
    "Pathankot", "Patiala", "Rupnagar", "Sangrur", "Tarn Taran",
  ],
  complexion: ["Very fair", "Fair", "Wheatish", "Wheatish brown", "Dark"],
  bodyType: ["Slim", "Average", "Athletic", "Heavy"],
  diet: ["Vegetarian", "Non-vegetarian", "Eggetarian", "Vegan"],
  habit: ["No", "Occasionally", "Yes"],
  motherTongue: ["Punjabi", "Hindi", "English", "Other"],
  familyType: ["Joint", "Nuclear"],
  familyValues: ["Traditional", "Moderate", "Liberal"],
  rashi: [
    "Mesh (Aries)", "Vrishabh (Taurus)", "Mithun (Gemini)", "Kark (Cancer)",
    "Singh (Leo)", "Kanya (Virgo)", "Tula (Libra)", "Vrishchik (Scorpio)",
    "Dhanu (Sagittarius)", "Makar (Capricorn)", "Kumbh (Aquarius)", "Meen (Pisces)",
  ],
};
