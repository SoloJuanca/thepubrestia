/** Calendar date in the location timezone, stored as UTC midnight for a DATE column. */
export function locationServiceDate(timeZone: string, now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${day}T00:00:00.000Z`);
}

export function formatServiceDate(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}
