export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone === "UTC" || timeZone === "Etc/UTC") {
    return true;
  }

  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  if (supportedValuesOf) {
    return supportedValuesOf("timeZone").includes(timeZone);
  }

  // Conservative fallback when Intl.supportedValuesOf is unavailable.
  return timeZone === "UTC" || /^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(timeZone);
}

export function toLocalTime(utcDate: Date, timeZone: string): Date {
  const utcStr = utcDate.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = utcDate.toLocaleString("en-US", { timeZone });
  const offsetMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();
  return new Date(utcDate.getTime() + offsetMs);
}

export function toLocalTimeIgnoringDst(utcDate: Date, timeZone: string): Date {
  // Use January 1st to get the standard (non-DST) offset for this timezone
  const jan = new Date(utcDate.getFullYear(), 0, 1);
  const utcStr = jan.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = jan.toLocaleString("en-US", { timeZone });
  const standardOffsetMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();
  return new Date(utcDate.getTime() + standardOffsetMs);
}
