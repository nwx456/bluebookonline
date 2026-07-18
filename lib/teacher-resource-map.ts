export type TeacherResourceRow = {
  id: string;
  title: string;
  description: string | null;
  resource_type: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  external_url: string | null;
  visibility: string;
  moderation_status: string;
  created_at: string;
  archived_at?: string | null;
};

export type TeacherResourceItem = {
  id: string;
  title: string;
  description: string | null;
  resourceType: "file" | "link";
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  externalUrl: string | null;
  visibility: "private" | "public";
  moderationStatus: string;
  createdAt: string;
};

export function mapTeacherResource(row: TeacherResourceRow): TeacherResourceItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    resourceType: row.resource_type === "link" ? "link" : "file",
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    externalUrl: row.external_url,
    visibility: row.visibility === "public" ? "public" : "private",
    moderationStatus: row.moderation_status,
    createdAt: row.created_at,
  };
}
