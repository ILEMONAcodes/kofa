import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ClientAccountDetails } from "./details";
const state = vi.hoisted(() => ({ resource: vi.fn(), reload: vi.fn(), leave: vi.fn() }));
vi.mock("@/components/features/live-staff/data", () => ({ useStaffResource: state.resource }));
vi.mock("@/components/access/local-access", () => ({ useLocalAccess: () => ({ leave: state.leave }) }));
const user = { id: "client-id", full_name: "Solomon Example", email: "solomon@example.com", phone: "+2348012345678", role: "client", is_email_verified: false, created_at: "2026-11-11T10:00:00Z" };
beforeEach(() => {
  vi.clearAllMocks();
  state.resource.mockReturnValue({ data: user, loading: false, error: null, reload: state.reload });
});
it("shows real identity details from the current-account endpoint and separate inquiry links", () => {
  render(<ClientAccountDetails />);
  expect(state.resource).toHaveBeenCalledWith("/auth/me");
  for (const value of [user.full_name, user.email, user.phone, "Client", "Email not verified"])
    expect(screen.getByText(value, { exact: true })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Your inquiries" })).toHaveAttribute("href", "/account/inquiries");
  expect(screen.getByRole("link", { name: "Verify your email" })).toHaveAttribute("href", "/verify-email?returnTo=%2Faccount%2Foverview");
  expect(screen.queryByText("Open inquiries", { exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh account details" }));
  expect(state.reload).toHaveBeenCalledOnce();
});
it("handles verified email and a missing optional phone without inventing values", () => {
  state.resource.mockReturnValue({ data: { ...user, phone: null, is_email_verified: true }, error: null, loading: false, reload: state.reload });
  render(<ClientAccountDetails />);
  expect(screen.getByText("Not provided", { exact: true })).toBeInTheDocument();
  expect(screen.getByText("Email verified", { exact: true })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Verify your email" })).not.toBeInTheDocument();
});
it("offers retry after failure without presenting cached identity or fake details", () => {
  state.resource.mockReturnValue({ data: null, error: new Error("network"), loading: false, reload: state.reload });
  render(<ClientAccountDetails />);
  expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded");
  expect(screen.queryByText(user.email)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry account details" }));
  expect(state.reload).toHaveBeenCalledOnce();
});
it("shows a loading indicator while account details are loading", () => {
  state.resource.mockReturnValue({ data: null, error: null, loading: true, reload: state.reload });
  render(<ClientAccountDetails />);
  expect(screen.getByRole("status", { name: "Loading Kof’a" })).toBeInTheDocument();
  expect(screen.queryByText(user.email)).not.toBeInTheDocument();
});
