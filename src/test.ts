import { BingXService } from "./services/bingX.service.js";
import { TelegramService } from "./services/telegram.service.js";
import { calculateSupertrend } from "./services/indicator.js";
import { CONFIG } from "./config/settings.js";

const bingx = new BingXService();
const telly = new TelegramService();
const wait = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms));

function getVNTimeString(date: Date = new Date()): string {
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function runSupertrendTest(): Promise<void> {
  let lastTrend: number | null = null;
  let lastSignalTime: number | null = null;

  let triggerUpperBand = 0;
  let triggerLowerBand = 0;

  console.clear();
  console.log("🚀 Bot Supertrend Test (Full Sync CONFIG) is starting...");
  console.log(
    `📊 Cấu hình: ATR ${CONFIG.ATR_PERIOD}, Mult ${CONFIG.ATR_MULTIPLIER}`
  );

  while (true) {
    try {
      const candlesRaw = await bingx.getKlines(CONFIG.SYMBOL, "1m", 500);
      const ticker = await bingx.getTicker(CONFIG.SYMBOL);

      if (!candlesRaw || !ticker || !candlesRaw.close.length) {
        await wait(2000);
        continue;
      }

      // 1. Tính toán Supertrend từ CONFIG
      const st = calculateSupertrend(
        candlesRaw.high.map(Number),
        candlesRaw.low.map(Number),
        candlesRaw.close.map(Number),
        CONFIG.ATR_PERIOD,
        CONFIG.ATR_MULTIPLIER
      );

      const currentPrice = parseFloat(ticker.lastPrice);
      const now = Date.now();

      // Tính thời gian còn lại của nến 1m (giây)
      const secondsPassed = Math.floor((now / 1000) % 60);
      const secondsLeft = 60 - secondsPassed;

      if (lastTrend === null) {
        lastTrend = st.trend;
        triggerUpperBand = st.upperBand;
        triggerLowerBand = st.lowerBand;
        continue;
      }

      // 2. LOG DỮ LIỆU CHI TIẾT
      console.clear();
      console.log(`\n==================================================`);
      console.log(
        `🔍 SYMBOL: ${CONFIG.SYMBOL} | ATR: ${CONFIG.ATR_PERIOD} | Mult: ${CONFIG.ATR_MULTIPLIER}`
      );
      console.log(
        `⏰ Time: ${getVNTimeString()} | ⏳ Nến đóng sau: ${secondsLeft}s`
      );
      console.log(`🚀 TREND: ${lastTrend === 1 ? "LONG 🟢" : "SHORT 🔴"}`);
      console.log(`🎯 GIÁ LIVE: ${currentPrice.toFixed(4)}`);
      console.log(`==================================================`);

      console.table([
        {
          "Trạng thái": "NẾN ĐÃ ĐÓNG (Trigger)",
          "Upper Band": triggerUpperBand.toFixed(4),
          "Lower Band": triggerLowerBand.toFixed(4),
          "Giá Close": candlesRaw.close[candlesRaw.close.length - 2],
        },
        {
          "Trạng thái": "NẾN ĐANG CHẠY (Live)",
          "Upper Band": st.upperBand.toFixed(4),
          "Lower Band": st.lowerBand.toFixed(4),
          "Giá Live": currentPrice.toFixed(4),
        },
      ]);

      const activeBand = lastTrend === 1 ? triggerLowerBand : triggerUpperBand;
      const gap = currentPrice - activeBand;
      console.log(
        `\n📢 Khoảng cách tới cản ST: ${gap.toFixed(4)} ${
          Math.abs(gap) < 0.5 ? "⚠️ SẮP ĐẢO CHIỀU!" : ""
        }`
      );

      // 3. LOGIC TRIGGER
      let instantTrend: number = lastTrend;
      if (lastTrend === -1 && currentPrice > triggerUpperBand) {
        instantTrend = 1;
      } else if (lastTrend === 1 && currentPrice < triggerLowerBand) {
        instantTrend = -1;
      }

      // 4. XỬ LÝ TÍN HIỆU
      if (instantTrend !== lastTrend) {
        const signal = instantTrend === 1 ? "BUY 🟢" : "SELL 🔴";
        await telly.sendMessage(
          `🔔 <b>${signal} SIGNAL</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `📌 Giá khớp: <b>${currentPrice.toFixed(2)}</b>\n` +
            `📊 ST Line: <b>${(instantTrend === 1
              ? st.lowerBand
              : st.upperBand
            ).toFixed(2)}</b>\n` +
            `🕒 Lúc: <b>${getVNTimeString()}</b>\n` +
            `📈 Xu hướng: <b>${instantTrend === 1 ? "LONG" : "SHORT"}</b>`
        );
        lastSignalTime = now;
      }

      // 5. CẬP NHẬT TRẠNG THÁI
      lastTrend = instantTrend;
      triggerUpperBand = st.upperBand;
      triggerLowerBand = st.lowerBand;

      await wait(3000);
    } catch (e: any) {
      console.error("\n❌ Lỗi:", e.message);
      await wait(5000);
    }
  }
}

runSupertrendTest();
