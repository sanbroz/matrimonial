import { z } from "zod";

/** Owner-customisable biodata look. Stored in Settings.biodataOptions (JSON). */
export const BIODATA_SECTIONS = {
  photo: "Photo",
  basic: "Basic details",
  religion: "Religion & community",
  horoscope: "Horoscope (birth time, manglik, rashi)",
  career: "Education & career",
  location: "Location & NRI status",
  family: "Family",
  property: "Property / land",
  preference: "Partner preferences",
  about: "About / remarks",
} as const;

export type BiodataSection = keyof typeof BIODATA_SECTIONS;

export const biodataOptionsSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).catch("#a8233f"),
  headerText: z.string().max(120).catch(""),
  footerText: z.string().max(300).catch(""),
  defaultLanguage: z.enum(["en", "pa"]).catch("en"),
  sections: z.array(z.enum(Object.keys(BIODATA_SECTIONS) as [BiodataSection, ...BiodataSection[]])).catch(Object.keys(BIODATA_SECTIONS) as BiodataSection[]),
  showBureauContact: z.boolean().catch(true),
});

export type BiodataOptions = z.infer<typeof biodataOptionsSchema>;

export function readBiodataOptions(json: unknown): BiodataOptions {
  return biodataOptionsSchema.parse(json ?? {});
}
