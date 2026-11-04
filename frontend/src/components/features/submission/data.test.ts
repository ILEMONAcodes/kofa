import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({
  ensureCsrf: vi.fn().mockResolvedValue(undefined),
  currentPolicies: vi.fn().mockResolvedValue({ policies: [] }),
}));
import { apiRequest } from "@/lib/api/client";
import { ensureCsrf } from "@/lib/auth/client";
import {
  createDraft,
  uploadFile,
  removeFile,
  submitDraft,
  type DraftReceipt,
} from "./data";
const api = vi.mocked(apiRequest);
const draft: DraftReceipt = {
  id: "draft-id",
  status: "draft",
  upload_token: "fictional-token",
  upload_token_expires_at: "2026-12-01T00:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  api.mockResolvedValue({ data: draft });
});
describe("anonymous scoped submission transport", () => {
  it("creates a draft after CSRF bootstrap without granting a landlord account", async () => {
    const body = { landlord: { full_name: "Fictional owner" } };
    await createDraft(body);
    expect(ensureCsrf).toHaveBeenCalled();
    expect(api).toHaveBeenCalledWith(
      "/landlord-submissions",
      expect.objectContaining({ method: "POST", body }),
    );
  });
  it("uploads original bytes as multipart with the private capability only in its header", async () => {
    const file = new File(["test"], "proof.pdf", { type: "application/pdf" });
    await uploadFile(draft, file, "authorization_letter");
    const [path, options] = api.mock.calls[0];
    expect(path).toBe("/landlord-submissions/draft-id/files");
    expect(options?.headers).toEqual({ "X-Upload-Token": "fictional-token" });
    const body = options?.body as FormData;
    expect(body.get("file")).toBe(file);
    expect(body.get("kind")).toBe("authorization_letter");
    expect(path).not.toContain("fictional-token");
    expect(options?.headers).not.toHaveProperty("Content-Type");
  });
  it("removes only the scoped file ID and submits using the same draft capability", async () => {
    await removeFile(draft, "uploaded-id");
    await submitDraft(draft);
    expect(api).toHaveBeenNthCalledWith(
      1,
      "/landlord-submissions/draft-id/files/uploaded-id",
      expect.objectContaining({
        method: "DELETE",
        headers: { "X-Upload-Token": "fictional-token" },
      }),
    );
    expect(api).toHaveBeenNthCalledWith(
      2,
      "/landlord-submissions/draft-id/submit",
      expect.objectContaining({
        method: "POST",
        headers: { "X-Upload-Token": "fictional-token" },
      }),
    );
  });
  it("propagates rejected uploads without automatic retry or fake success", async () => {
    api.mockRejectedValueOnce(new Error("service unavailable"));
    await expect(
      uploadFile(draft, new File(["x"], "x.jpg"), "photo"),
    ).rejects.toThrow("unavailable");
    expect(api).toHaveBeenCalledTimes(1);
  });
});
