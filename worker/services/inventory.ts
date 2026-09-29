export function selectReservedLines<T>(lines: T[], reservations: ReadonlyArray<{ meta?: { changes?: unknown } }>) {
  return lines.filter((_, index) => Number(reservations[index]?.meta?.changes) === 1);
}
