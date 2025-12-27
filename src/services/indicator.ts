import { ATR } from "technicalindicators";

export interface SupertrendResult {
  trend: number;
  value: number;
  signal: "BUY" | "SELL" | null;
}

export function calculateSupertrend(
  high: number[],
  low: number[],
  close: number[],
  period: number,
  multiplier: number
): SupertrendResult {
  // Validate đầu vào tránh undefined
  if (!high?.length || !low?.length || !close?.length)
    throw new Error("❌ Invalid candle input");

  if (high.length < period || low.length < period || close.length < period)
    throw new Error("❌ Not enough candle data for Supertrend");

  // 🔥 FIX CHUẨN CHO LỖI hl2 = possibly undefined
  const hl2: number[] = high.map((h, i) => {
    const lo = low[i];
    return ((h ?? 0) + (lo ?? 0)) / 2;
  });

  const atr = ATR.calculate({ high, low, close, period });

  const upSeries: number[] = [];
  const dnSeries: number[] = [];
  const trendSeries: number[] = [];

  let signal: "BUY" | "SELL" | null = null;

  for (let i = 0; i < close.length; i++) {
    if (i < period) {
      upSeries.push(hl2[i] as any);
      dnSeries.push(hl2[i] as any);
      trendSeries.push(1);
      continue;
    }

    const prevClose = close[i - 1]!;
    const currAtr = atr[i - period] ?? atr.at(-1)!; // ✔ fallback tránh undefined
    const src = hl2[i]!; // ✔ vì đã map bảo vệ rồi

    let up = src - multiplier * currAtr;
    let dn = src + multiplier * currAtr;

    const prevUp = upSeries[i - 1] ?? up;
    const prevDn = dnSeries[i - 1] ?? dn;

    // update bands
    up = prevClose > prevUp ? Math.max(prevUp, up) : up;
    dn = prevClose < prevDn ? Math.min(prevDn, dn) : dn;

    upSeries.push(up);
    dnSeries.push(dn);

    let trend = trendSeries[i - 1] ?? 1;

    if (trend === -1 && close[i]! > prevDn) {
      trend = 1;
      signal = "BUY";
    } else if (trend === 1 && close[i]! < prevUp) {
      trend = -1;
      signal = "SELL";
    }

    trendSeries.push(trend);
  }

  const lastTrend = trendSeries.at(-1)!;
  const lastValue = lastTrend === 1 ? upSeries.at(-1)! : dnSeries.at(-1)!;

  return { trend: lastTrend, value: lastValue, signal };
}
