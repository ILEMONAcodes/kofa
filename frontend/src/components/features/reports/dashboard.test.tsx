import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OperationalDashboard } from "./dashboard";
const state = vi.hoisted(() => ({ resource: vi.fn(), reload: vi.fn() }));
vi.mock("@/components/features/live-staff/data", () => ({ useStaffResource: state.resource }));
vi.mock("@/components/access/local-access", () => ({ useLocalAccess: () => ({ user: { full_name: "Ada Obi" }, role: "admin" }) }));
const data = {
  as_of: "2030-05-10T12:00:00Z",
  period: { from_date: null, to_date: null, timezone: "Africa/Lagos" },
  counts: { listings_awaiting_review: 2, open_inquiries: 5, upcoming_inspections: 3, active_complaints: 1 },
};
beforeEach(() => {
  vi.clearAllMocks();
  state.resource.mockReturnValue({ data, error: null, loading: false, reload: state.reload });
});
describe("operational dashboard", () => {
  it("shows server counts and definitions with functional workspace links", () => {
    render(<OperationalDashboard />);
    expect(screen.getByRole("heading", { name: "Welcome, Ada." })).toBeInTheDocument();
    expect(screen.getByLabelText("Listings awaiting review: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Open inquiries: 5")).toBeInTheDocument();
    expect(screen.getByText(/historical snapshot/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open complaints" })).toHaveAttribute("href", "/staff/complaints");
    expect(screen.queryByText("Completed transactions")).not.toBeInTheDocument();
  });
  it("requires paired ordered dates and applies or clears the selected cohort", () => {
    render(<OperationalDashboard />);
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2030-05-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose both dates");
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2030-05-09" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2030-05-11" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
    expect(state.resource).toHaveBeenLastCalledWith("/admin/reports/kpis", "from=2030-05-10&to=2030-05-11");
    fireEvent.click(screen.getByRole("button", { name: "All dates" }));
    expect(screen.getByLabelText("From date")).toHaveValue("");
    expect(state.resource).toHaveBeenLastCalledWith("/admin/reports/kpis", "");
  });
  it("distinguishes true empty totals from a failed request", () => {
    state.resource.mockReturnValue({ data: { ...data, counts: { listings_awaiting_review: 0, open_inquiries: 0, upcoming_inspections: 0, active_complaints: 0 } }, error: null, loading: false, reload: state.reload });
    const view = render(<OperationalDashboard />);
    expect(screen.getByRole("status")).toHaveTextContent("No matching work");
    view.unmount();
    state.resource.mockReturnValue({ data: null, error: new Error("network"), loading: false, reload: state.reload });
    render(<OperationalDashboard />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByLabelText("Open inquiries: 0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.reload).toHaveBeenCalledOnce();
  });
});
