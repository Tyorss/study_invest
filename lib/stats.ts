export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function sampleStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance =
    values.reduce((acc, x) => acc + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length <= 1) return 0;
  const mx = mean(x);
  const my = mean(y);
  return (
    x.reduce((acc, xi, i) => acc + (xi - mx) * (y[i] - my), 0) /
    (x.length - 1)
  );
}

export function variance(values: number[]): number {
  const s = sampleStdDev(values);
  return s * s;
}

export function olsBeta(portfolioRet: number[], benchmarkRet: number[]) {
  if (
    portfolioRet.length !== benchmarkRet.length ||
    portfolioRet.length <= 1
  ) {
    return null;
  }
  const vb = variance(benchmarkRet);
  if (vb === 0) return null;
  return covariance(portfolioRet, benchmarkRet) / vb;
}

export function rollingWindow<T>(arr: T[], size: number): T[] {
  if (arr.length <= size) return arr;
  return arr.slice(arr.length - size);
}
