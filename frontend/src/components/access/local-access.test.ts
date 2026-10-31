import { describe, it, expect } from "vitest";
import { validLocalRole, canOpenLocalArea } from "./local-access";
describe("local navigation roles (not API authorization)", () => {
  it.each(["client", "staff", "admin"])("accepts the known %s role", (role) =>
    expect(validLocalRole(role)).toBe(true),
  );
  it.each([null, "superadmin", "owner", {}, "", false])(
    "rejects unknown role %s",
    (role) => expect(validLocalRole(role)).toBe(false),
  );
  it("keeps staff tools and admin tools distinct", () => {
    expect(canOpenLocalArea(null, "client")).toBe(false);
    expect(canOpenLocalArea("client", "staff")).toBe(false);
    expect(canOpenLocalArea("staff", "staff")).toBe(true);
    expect(canOpenLocalArea("staff", "admin")).toBe(false);
    expect(canOpenLocalArea("admin", "staff")).toBe(true);
    expect(canOpenLocalArea("admin", "admin")).toBe(true);
  });
});
