export type AdminPostStatus = "all" | "active" | "archived" | "deleted";
export interface AdminPostPM {
  id: string;
  body: string | null;
  authorId: string;
  authorName: string;
  username: string | null;
  createdAt: string;
  visibility: "public" | "friends";
  archivedAt: string | null;
  deletedAt: string | null;
  repostOfId: string | null;
  media: { id: string; kind: "image" | "video"; url: string; thumbUrl: string }[];
}
export interface AdminPostsPM {
  items: AdminPostPM[];
  total: number;
  page: number;
  limit: number;
}
export interface AdminPostRowVM extends AdminPostPM {
  status: string;
  createdLabel: string;
  canDelete: boolean;
  canArchive: boolean;
}
export function toAdminPostsVM(pm: AdminPostsPM) {
  return {
    ...pm,
    pages: Math.max(1, Math.ceil(pm.total / pm.limit)),
    rows: pm.items.map((p): AdminPostRowVM => ({
      ...p,
      status: p.deletedAt ? "Deleted" : p.archivedAt ? "Archived" : "Active",
      createdLabel: new Date(p.createdAt).toLocaleString("en-GB"),
      canDelete: !p.deletedAt,
      canArchive: !p.deletedAt,
    })),
  };
}
