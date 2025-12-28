export interface SupertrendResult {
  trend: number;
  value: number;
  signal: "BUY" | "SELL" | null;
}

export function calculateSupertrend(
  high: number[],
  low: number[],
  close: number[],
  period: number = 10,
  multiplier: number = 3
): SupertrendResult {
  const size = close.length;
  if (size < period) throw new Error("❌ Không đủ dữ liệu nến");

  const hl2 = high.map((h, i) => (h + (low[i] ?? 0)) / 2);

  // 1. Tính True Range (TR)
  const tr: number[] = new Array(size).fill(0);
  for (let i = 1; i < size; i++) {
    const h = high[i] ?? 0;
    const l = low[i] ?? 0;
    const pc = close[i - 1] ?? 0;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }

  // 2. Tính ATR theo RMA (Running Moving Average) - Chuẩn TradingView
  const atr: number[] = new Array(size).fill(0);
  let sumTR = 0;
  for (let i = 0; i < size; i++) {
    const currentTR = tr[i] ?? 0;
    if (i < period) {
      sumTR += currentTR;
      atr[i] = sumTR / (i + 1);
    } else {
      atr[i] = ((atr[i - 1] ?? 0) * (period - 1) + currentTR) / period;
    }
  }

  const lowerBand: number[] = new Array(size).fill(0);
  const upperBand: number[] = new Array(size).fill(0);
  const trend: number[] = new Array(size).fill(1);

  // 3. Tính toán Bands
  for (let i = 0; i < size; i++) {
    const curHL2 = hl2[i] ?? 0;
    const curATR = atr[i] ?? 0;
    if (i === 0) {
      lowerBand[i] = curHL2 - multiplier * curATR;
      upperBand[i] = curHL2 + multiplier * curATR;
      continue;
    }

    const basicLower = curHL2 - multiplier * curATR;
    const basicUpper = curHL2 + multiplier * curATR;
    const prevLower = lowerBand[i - 1] ?? 0;
    const prevUpper = upperBand[i - 1] ?? 0;
    const prevClose = close[i - 1] ?? 0;

    lowerBand[i] =
      prevClose > prevLower ? Math.max(basicLower, prevLower) : basicLower;
    upperBand[i] =
      prevClose < prevUpper ? Math.min(basicUpper, prevUpper) : basicUpper;

    let curTrend = trend[i - 1] ?? 1;
    if (curTrend === -1 && (close[i] ?? 0) > prevUpper) curTrend = 1;
    else if (curTrend === 1 && (close[i] ?? 0) < prevLower) curTrend = -1;
    trend[i] = curTrend;
  }

  const last = size - 1;
  return {
    trend: trend[last] ?? 1,
    value: trend[last] === 1 ? lowerBand[last] ?? 0 : upperBand[last] ?? 0,
    signal:
      trend[last] !== trend[last - 1]
        ? trend[last] === 1
          ? "BUY"
          : "SELL"
        : null,
  };
}
