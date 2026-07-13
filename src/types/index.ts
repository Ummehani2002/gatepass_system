export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  projectId: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  createdBy: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
}
