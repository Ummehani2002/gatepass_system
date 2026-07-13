import { z } from "zod";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .transform(slugify)
    .refine((v) => v.length > 0, "Slug cannot be empty")
    .optional(),
});

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["admin", "member"]).default("member"),
});

export { slugify };
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
