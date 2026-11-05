import { describe, it, expect } from "vitest";
import { watInput, watInstant, dateWindow, nextDate, visitLink } from "./model";
describe("inspection date and route presentation", () => {
  it("interprets WAT input independently of device timezone", () =>
    expect(watInstant("2030-01-01", "10:30")).toBe("2030-01-01T09:30:00.000Z"));
  it("renders UTC dates into Nigerian local controls", () =>
    expect(watInput("2030-01-01T23:30:00Z")).toEqual({
      date: "2030-01-02",
      time: "00:30",
    }));
  it("rejects nonexistent dates and invalid clock inputs", () => {
    expect(() => watInstant("2030-02-30", "10:00")).toThrow();
    expect(() => watInstant("2030-01-01", "25:00")).toThrow();
    expect(() => watInstant("", "10:00")).toThrow();
  });
  it("accepts leap day", () =>
    expect(watInstant("2032-02-29", "00:00")).toBe("2032-02-28T23:00:00.000Z"));
  it("makes an inclusive end date into an exclusive next-day instant", () =>
    expect(dateWindow("2030-01-01", "2030-01-01")).toEqual({
      date_from: "2029-12-31T23:00:00.000Z",
      date_to: "2030-01-01T23:00:00.000Z",
    }));
  it("rejects reversed date ranges", () =>
    expect(() => dateWindow("2030-02-01", "2030-01-01")).toThrow());
  it("advances calendar dates through year boundaries", () =>
    expect(nextDate("2030-12-31", 1)).toBe("2031-01-01"));
  it("links actual client/staff records", () => {
    expect(visitLink(false, "abc")).toBe("/account/inspection-review?id=abc");
    expect(visitLink(true, "abc")).toBe("/staff/inspection?id=abc");
  });
});
