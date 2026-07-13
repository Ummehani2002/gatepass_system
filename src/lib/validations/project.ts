import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(2000).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
