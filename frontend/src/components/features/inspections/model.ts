export const liveInspectionClientViews = new Set([
  "inspections",
  "inspection-review",
  "inspection-confirmed",
  "reschedule",
  "reschedule-requested",
  "cancel-visit",
  "visit-cancelled",
]);
export const liveInspectionStaffViews = new Set([
  "inspections",
  "schedule-inspection",
  "inspection-conflict",
  "inspection",
  "inspection-outcome",
  "outcome-recorded",
  "cancel-inspection",
  "calendar",
]);
export const visitLink = (staff: boolean, id: string) =>
  `${staff ? "/staff/inspection" : "/account/inspection-review"}?id=${encodeURIComponent(id)}`;
export function watInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (name: string) => parts.find((p) => p.type === name)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
export function watInstant(date: string, time: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw new Error("Choose a valid date and time in WAT.");
  const value = new Date(`${date}T${time}:00+01:00`);
  if (
    !Number.isFinite(value.getTime()) ||
    watInput(value.toISOString()).date !== date
  )
    throw new Error("Choose a valid date.");
  return value.toISOString();
}
export function nextDate(value: string, days: number) {
  const date = new Date(watInstant(value, "12:00"));
  date.setUTCDate(date.getUTCDate() + days);
  return watInput(date.toISOString()).date;
}
export function dateWindow(start: string, end: string) {
  const date_from = start ? watInstant(start, "00:00") : undefined;
  const date_to = end ? watInstant(nextDate(end, 1), "00:00") : undefined;
  if (date_from && date_to && date_from >= date_to)
    throw new Error("End date must not precede the start date.");
  return { date_from, date_to };
}
export const slotTimes = Array.from(
  { length: 48 },
  (_, i) =>
    `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);
export const durations = [15, 30, 45, 60, 90, 120, 180, 240];
