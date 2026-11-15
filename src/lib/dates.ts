const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** "Nov 4, 2026" from an ISO timestamp or a yyyy-mm-dd date, read in UTC. */
export function formatDate(iso: string): string {
  return dayFormat.format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));
}

/** "March 2026" from a yyyy-mm month. */
export function formatMonth(isoMonth: string): string {
  return monthFormat.format(new Date(`${isoMonth}-01T00:00:00Z`));
}

/** True once the UTC calendar day of `now` is after the given yyyy-mm-dd date. */
export function isPast(isoDate: string, now: Date = new Date()): boolean {
  return now.toISOString().slice(0, 10) > isoDate;
}
