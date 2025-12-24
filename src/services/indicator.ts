import { ATR } from "technicalindicators";

export interface SupertrendResult {
  trend: number; // 1: Bull, -1: Bear
  value: number; // Giá trị của dải Supertrend
}

export function calculateSupertrend(
  high: number[],
  low: number[],
  close: number[],
  period: number,
  multiplier: number
): SupertrendResult {
  // 1. Tính ATR
  const atrValues = ATR.calculate({ high, low, close, period });

  // Khởi tạo các mảng để lưu lịch sử (giống series trong Pine Script)
  const hl2 = high.map((h, i) => (h + low[i]!) / 2);
  const upSeries = new Array(close.length).fill(0);
  const dnSeries = new Array(close.length).fill(0);
  const trendSeries = new Array(close.length).fill(1);

  // Bắt đầu tính từ khi đủ dữ liệu ATR
  const startIdx = period;

  for (let i = startIdx; i < close.length; i++) {
    const atr = atrValues[i - period]!;
    const src = hl2[i]!;
    const currClose = close[i]!;
    const prevClose = close[i - 1]!;

    // Tính Basic Bands
    let up = src - multiplier * atr;
    let dn = src + multiplier * atr;

    // Logic dải Up (vùng Long)
    const prevUp = upSeries[i - 1] || up;
    up = prevClose > prevUp ? Math.max(up, prevUp) : up;
    upSeries[i] = up;

    // Logic dải Dn (vùng Short)
    const prevDn = dnSeries[i - 1] || dn;
    dn = prevClose < prevDn ? Math.min(dn, prevDn) : dn;
    dnSeries[i] = dn;

    // Xác định Trend (giống biến trend trong Pine Script)
    let trend = trendSeries[i - 1] || 1;
    if (trend === -1 && currClose > prevDn) {
      trend = 1;
    } else if (trend === 1 && currClose < prevUp) {
      trend = -1;
    }
    trendSeries[i] = trend;
  }

  return {
    trend: trendSeries[trendSeries.length - 1],
    value:
      trendSeries[trendSeries.length - 1] === 1
        ? upSeries[upSeries.length - 1]
        : dnSeries[dnSeries.length - 1],
  };
}
