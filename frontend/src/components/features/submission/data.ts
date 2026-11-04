import { apiRequest } from "@/lib/api/client";
import { ensureCsrf, currentPolicies } from "@/lib/auth/client";
import type { Taxonomy } from "@/types/filters";
export type EvidenceKind = "ownership_proof" | "authorization_letter";
export type FileKind = "photo" | "video" | EvidenceKind;
export interface DraftReceipt {
  id: string;
  status: "draft";
  upload_token: string;
  upload_token_expires_at: string;
}
export interface SubmissionReceipt {
  id: string;
  status: "submitted";
  reference: string;
}
export interface UploadReceipt {
  file_id: string;
  kind: FileKind;
  size_bytes: number;
  status: "uploaded";
}
export const submissionOptions = async () => {
  const [taxonomy, policies] = await Promise.all([
    apiRequest<Taxonomy>("/taxonomy"),
    currentPolicies(),
  ]);
  return { taxonomy: taxonomy.data, policies };
};
export async function createDraft(body: unknown) {
  await ensureCsrf();
  return (
    await apiRequest<DraftReceipt>("/landlord-submissions", {
      method: "POST",
      body,
      timeoutMs: 20000,
    })
  ).data;
}
export async function uploadFile(
  draft: DraftReceipt,
  file: File,
  kind: FileKind,
) {
  await ensureCsrf();
  const body = new FormData();
  body.set("file", file);
  body.set("kind", kind);
  return (
    await apiRequest<UploadReceipt>(`/landlord-submissions/${draft.id}/files`, {
      method: "POST",
      body,
      headers: { "X-Upload-Token": draft.upload_token },
      timeoutMs: 120000,
    })
  ).data;
}
export async function removeFile(draft: DraftReceipt, id: string) {
  await ensureCsrf();
  await apiRequest(`/landlord-submissions/${draft.id}/files/${id}`, {
    method: "DELETE",
    headers: { "X-Upload-Token": draft.upload_token },
  });
}
export async function submitDraft(draft: DraftReceipt) {
  await ensureCsrf();
  return (
    await apiRequest<SubmissionReceipt>(
      `/landlord-submissions/${draft.id}/submit`,
      {
        method: "POST",
        headers: { "X-Upload-Token": draft.upload_token },
        timeoutMs: 20000,
      },
    )
  ).data;
}
