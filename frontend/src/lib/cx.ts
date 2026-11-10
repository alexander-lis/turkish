/** Собрать строку классов из частей, пропуская выключенные. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
