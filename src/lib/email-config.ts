import { z } from "zod";

/** Stored in Settings.emailConfig. `passwordSealed` is encrypted (see secret-box.ts). */
export const emailConfigSchema = z.object({
  enabled: z.boolean().catch(false),
  /** Gmail by default; any SMTP server works (advanced). */
  host: z.string().catch("smtp.gmail.com"),
  port: z.number().int().catch(465),
  secure: z.boolean().catch(true),
  user: z.string().catch(""),
  passwordSealed: z.string().nullable().catch(null),
  fromName: z.string().catch(""),
});

export type EmailConfig = z.infer<typeof emailConfigSchema>;

export const readEmailConfig = (json: unknown): EmailConfig => emailConfigSchema.parse(json ?? {});

export const summaryOptionsSchema = z.object({
  enabled: z.boolean().catch(false),
  /** HH:MM, India time */
  time: z.string().regex(/^\d{2}:\d{2}$/).catch("08:00"),
  /** Extra recipients; owners always get it. */
  extraRecipients: z.array(z.string().email()).catch([]),
});
export type SummaryOptions = z.infer<typeof summaryOptionsSchema>;
export const readSummaryOptions = (json: unknown): SummaryOptions => summaryOptionsSchema.parse(json ?? {});
