import { z } from "zod";

export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);
export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(5000),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
