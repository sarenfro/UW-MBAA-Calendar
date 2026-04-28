/** Returns the academic year string (e.g. "2025-2026") for a given date.
 * Academic year runs July 1 through June 30. */
export function academicYearFor(date: Date): string {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  return month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

/** Returns the academic year immediately prior to the given one. */
export function priorAcademicYear(current: string): string {
  const [startStr, endStr] = current.split("-");
  return `${parseInt(startStr) - 1}-${parseInt(endStr) - 1}`;
}

/** Returns July 1 of the year the academic year ends (exclusive upper bound). */
export function academicYearEnd(current: string): Date {
  const endYear = parseInt(current.split("-")[1]);
  return new Date(Date.UTC(endYear, 6, 1)); // July 1
}
