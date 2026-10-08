/** Interpolazione lineare su una serie ordinata [progressiva, valore]. */
export function interpolate(series: Array<[number, number]>, x: number): number {
  if (series.length === 0) return 0;
  const first = series[0] as [number, number];
  const last = series[series.length - 1] as [number, number];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  let lo = 0;
  let hi = series.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((series[mid] as [number, number])[0] <= x) lo = mid;
    else hi = mid;
  }
  const a = series[lo] as [number, number];
  const b = series[hi] as [number, number];
  const t = b[0] > a[0] ? (x - a[0]) / (b[0] - a[0]) : 0;
  return a[1] + t * (b[1] - a[1]);
}

/** Minuti nominali per andare dalla progressiva `fromM` a `toM`. */
export function minutesBetween(timeAt: Array<[number, number]>, fromM: number, toM: number): number {
  return Math.max(0, interpolate(timeAt, toM) - interpolate(timeAt, fromM));
}
