export interface SupertrendResult {
  trend: number;
  value: number;
  signal: "BUY" | "SELL" | null;
}

/**
 * Tính toán Supertrend chuẩn TradingView Pine Script v4
 * Fix triệt để lỗi ép kiểu và undefined trong TypeScript
 */
export function calculateSupertrend(
  high: number[],
  low: number[],
  close: number[],
  period: number = 10,
  multiplier: number = 3
): SupertrendResult {
  const size: number = close.length;

  if (size < period) {
    throw new Error("❌ Không đủ dữ liệu nến");
  }

  // 1. Tính hl2
  const hl2: number[] = high.map((h, i) => (h + (low[i] ?? 0)) / 2);

  // 2. Tính True Range (TR)
  const tr: number[] = new Array(size).fill(0);
  for (let i = 1; i < size; i++) {
    const currentHigh = high[i] ?? 0;
    const currentLow = low[i] ?? 0;
    const prevClose = close[i - 1] ?? 0;

    tr[i] = Math.max(
      currentHigh - currentLow,
      Math.abs(currentHigh - prevClose),
      Math.abs(currentLow - prevClose)
    );
  }

  // 3. Tính ATR theo RMA (Running Moving Average)
  const atr: number[] = new Array(size).fill(0);
  let sumTR: number = 0;
  for (let i = 0; i < size; i++) {
    const currentTR = tr[i] ?? 0;
    if (i < period) {
      sumTR += currentTR;
      atr[i] = sumTR / (i + 1);
    } else {
      const prevATR = atr[i - 1] ?? 0;
      atr[i] = (prevATR * (period - 1) + currentTR) / period;
    }
  }

  // 4. Khởi tạo Bands và Trend
  const lowerBand: number[] = new Array(size).fill(0);
  const upperBand: number[] = new Array(size).fill(0);
  const trend: number[] = new Array(size).fill(1);

  // 5. Tính toán logic chính
  for (let i = 0; i < size; i++) {
    const currentHL2 = hl2[i] ?? 0;
    const currentATR = atr[i] ?? 0;
    const currentClose = close[i] ?? 0;

    if (i === 0) {
      lowerBand[i] = currentHL2 - multiplier * currentATR;
      upperBand[i] = currentHL2 + multiplier * currentATR;
      continue;
    }

    const basicLower: number = currentHL2 - multiplier * currentATR;
    const basicUpper: number = currentHL2 + multiplier * currentATR;

    const prevLower: number = lowerBand[i - 1] ?? 0;
    const prevUpper: number = upperBand[i - 1] ?? 0;
    const prevClose: number = close[i - 1] ?? 0;

    // Logic dải băng dưới (up trong Pine Script)
    lowerBand[i] =
      prevClose > prevLower ? Math.max(basicLower, prevLower) : basicLower;

    // Logic dải băng trên (dn trong Pine Script)
    upperBand[i] =
      prevClose < prevUpper ? Math.min(basicUpper, prevUpper) : basicUpper;

    // 6. Xác định xu hướng
    let currTrend: number = trend[i - 1] ?? 1;
    if (currTrend === -1 && currentClose > prevUpper) {
      currTrend = 1;
    } else if (currTrend === 1 && currentClose < prevLower) {
      currTrend = -1;
    }
    trend[i] = currTrend;
  }

  // 7. Kết quả nến cuối cùng
  const lastIdx = size - 1;
  const finalTrend = trend[lastIdx] ?? 1;
  const finalValue =
    finalTrend === 1 ? lowerBand[lastIdx] ?? 0 : upperBand[lastIdx] ?? 0;

  let signal: "BUY" | "SELL" | null = null;
  if (size > 1) {
    const prevTrend = trend[lastIdx - 1];
    if (finalTrend === 1 && prevTrend === -1) signal = "BUY";
    if (finalTrend === -1 && prevTrend === 1) signal = "SELL";
  }

  return {
    trend: finalTrend,
    value: finalValue,
    signal: signal,
  };
}
