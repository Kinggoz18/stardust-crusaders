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

export const bootstrapStatusSchema = z.object({
  needsBootstrap: z.boolean(),
});

export const bootstrapMasterRequestSchema = z.object({
  masterKey: z.string().min(1).max(256),
  email: z.string().email(),
  password: z.string().min(10).max(128),
});

export const bootstrapMasterResponseSchema = z.object({
  ok: z.literal(true),
  email: z.string().email(),
  role: z.literal("owner"),
  totpSecret: z.string().min(1),
  otpauthUrl: z.string().min(1),
});

/** Owner creates a pending invite (no password yet). */
export const inviteStaffRequestSchema = z.object({
  email: z.string().email(),
  role: staffRoleSchema,
});

export const inviteStaffResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: staffRoleSchema,
  expiresAt: z.string().datetime(),
  /** One-time token for the invitee — shown once to the owner to share. */
  inviteToken: z.string().min(1),
});

export const acceptInviteRequestSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(10).max(128),
});

export const acceptInviteResponseSchema = z.object({
  ok: z.literal(true),
  email: z.string().email(),
  role: staffRoleSchema,
  totpSecret: z.string().min(1),
  otpauthUrl: z.string().min(1),
});

export const staffListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: staffRoleSchema,
  createdAt: z.string().datetime(),
  disabledAt: z.string().datetime().nullable(),
});

export const staffInviteListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: staffRoleSchema,
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  acceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
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
  "staff_invite",
  "staff_invite_revoke",
  "staff_invite_accept",
  "bootstrap",
  "bootstrap_denied",
  "login",
  "logout",
  "ad_settings_update",
  "house_ads_global_update",
  "house_ad_create",
  "house_ad_update",
  "house_ad_delete",
]);

export const auditEntrySchema = z.object({
  id: z.string().uuid(),
  staffId: z.string().uuid().nullable(),
  action: auditActionSchema,
  targetType: z.string(),
  targetId: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
});
