/** All marketplace timestamps are presented in Nigeria's time zone. */
export function formatStaffDate(
  value: string,
  style: "date" | "time" | "dateTime" = "dateTime",
) {
  const options: Intl.DateTimeFormatOptions = { timeZone: "Africa/Lagos" };
  if (style !== "time") options.dateStyle = "medium";
  if (style !== "date") options.timeStyle = "short";
  return new Intl.DateTimeFormat("en-NG", options).format(new Date(value));
}
