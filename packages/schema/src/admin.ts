import { z } from "zod";

export const staffRoleSchema = z.enum(["owner", "support", "viewer"]);
export type StaffRole = z.infer<typeof staffRoleSchema>;

export const staffLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totpCode: z.string().regex(/^\d{6}$/),
});

export const staffLoginResponseSchema = z.object({
  ok: z.literal(true),
  role: staffRoleSchema,
  expiresAt: z.string().datetime(),
});

export const inviteStaffRequestSchema = z.object({
  email: z.string().email(),
  role: staffRoleSchema,
  /** Temporary password the invitee will change later. */
  password: z.string().min(10).max(128),
});

export const staffListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: staffRoleSchema,
  createdAt: z.string().datetime(),
  disabledAt: z.string().datetime().nullable(),
});

export const auditActionSchema = z.enum([
  "read_account",
  "search_accounts",
  "read_progress",
  "read_wallet",
  "read_events",
  "ban",
  "unban",
  "reset_progress",
  "staff_create",
  "staff_update",
  "login",
  "logout",
]);

export const auditEntrySchema = z.object({
  id: z.string().uuid(),
  staffId: z.string().uuid(),
  action: auditActionSchema,
  targetType: z.string(),
  targetId: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
});
