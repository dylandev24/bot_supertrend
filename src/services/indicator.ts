export interface SupertrendResult {
  trend: number;
  value: number;
  upperBand: number;
  lowerBand: number;
  buySignal: boolean;
  sellSignal: boolean;
}

export function calculateSupertrend(
  high: number[],
  low: number[],
  close: number[],
  period: number = 10, // Pine v4 mặc định là 10
  multiplier: number = 3.0 // Pine v4 mặc định là 3.0
): SupertrendResult {
  const size = close.length;
  if (size <= period) throw new Error("Dữ liệu nến quá ngắn");

  // 1. Source: hl2
  const src = high.map((h, i) => (h + (low[i] ?? h)) / 2);

  // 2. True Range (TR)
  const tr = new Array(size).fill(0);
  for (let i = 1; i < size; i++) {
    const pc = close[i - 1] ?? 0;
    tr[i] = Math.max(
      high[i]! - low[i]!,
      Math.abs(high[i]! - pc),
      Math.abs(low[i]! - pc)
    );
  }

  // 3. ATR (RMA - Running Moving Average chuẩn Pine Script)
  const atr = new Array(size).fill(0);
  const alpha = 1 / period;

  // Khởi tạo giá trị ATR đầu tiên bằng SMA (đúng cách Pine Script vận hành)
  let sumTR = 0;
  for (let i = 0; i < period; i++) sumTR += tr[i] || 0;
  atr[period - 1] = sumTR / period;

  for (let i = period; i < size; i++) {
    atr[i] = (tr[i] || 0) * alpha + (atr[i - 1] || 0) * (1 - alpha);
  }

  // 4. Các dải băng (up, dn) và Xu hướng (trend)
  const up = new Array(size).fill(0);
  const dn = new Array(size).fill(0);
  const trend = new Array(size).fill(1);

  for (let i = 0; i < size; i++) {
    if (i < period - 1) continue;

    const basicUp = src[i]! - multiplier * atr[i]!;
    const basicDn = src[i]! + multiplier * atr[i]!;

    if (i === period - 1) {
      up[i] = basicUp;
      dn[i] = basicDn;
      continue;
    }

    const up_prev = up[i - 1]!;
    const dn_prev = dn[i - 1]!;
    const close_prev = close[i - 1]!;

    // Logic quan trọng nhất: Dải băng không bao giờ đi ngược hướng
    // Pine: up := close[1] > up1 ? max(up, up1) : up
    up[i] = close_prev > up_prev ? Math.max(basicUp, up_prev) : basicUp;
    // Pine: dn := close[1] < dn1 ? min(dn, dn1) : dn
    dn[i] = close_prev < dn_prev ? Math.min(basicDn, dn_prev) : basicDn;

    // Xác định xu hướng (Trend)
    // Pine: trend := trend == -1 and close > dn1 ? 1 : trend == 1 and close < up1 ? -1 : trend
    let curTrend = trend[i - 1]!;
    if (curTrend === -1 && close[i]! > dn_prev) {
      curTrend = 1;
    } else if (curTrend === 1 && close[i]! < up_prev) {
      curTrend = -1;
    }
    trend[i] = curTrend;
  }

  const curr = size - 1;
  const prev = size - 2;

  return {
    trend: trend[curr]!,
    value: trend[curr] === 1 ? up[curr]! : dn[curr]!,
    upperBand: dn[curr]!,
    lowerBand: up[curr]!,
    buySignal: trend[curr] === 1 && trend[prev] === -1,
    sellSignal: trend[curr] === -1 && trend[prev] === 1,
  };
}
