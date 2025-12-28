import { BingXService } from "./services/bingX.service.js";
import { TelegramService } from "./services/telegram.service.js";
import { calculateSupertrend } from "./services/indicator.js";
import { CONFIG } from "./config/settings.js";

const bingx = new BingXService();
const telly = new TelegramService();
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Hàm hỗ trợ lấy thời gian Việt Nam định dạng chuỗi
 */
function getVNTimeString(date: Date = new Date()): string {
  return date.toLocaleString("vi-VN", {
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

async function runSupertrendTest() {
  console.log(
    `🚀 Supertrend Real-time Tester Started (Múi giờ: Asia/Ho_Chi_Minh)...`
  );

  let lastTrend: number | null = null;
  let lastSignalTime: number | null = null;

  while (true) {
    try {
      const candles = await bingx.getKlines(CONFIG.SYMBOL, "1m");
      if (!candles?.close?.length) {
        await wait(5000);
        continue;
      }

      const st = calculateSupertrend(
        candles.high,
        candles.low,
        candles.close,
        CONFIG.ATR_PERIOD,
        CONFIG.ATR_MULTIPLIER
      );

      const currentPrice = candles.close.at(-1) ?? 0;
      const now = Date.now();
      const timeStr = getVNTimeString(new Date(now));

      // Logic nhạy: So sánh tức thời
      const instantTrend = currentPrice > st.value ? 1 : -1;

      if (lastTrend !== null && instantTrend !== lastTrend) {
        let durationStr = "";
        if (lastSignalTime) {
          const diff = Math.floor((now - lastSignalTime) / 1000);
          const mins = Math.floor(diff / 60);
          const secs = diff % 60;
          durationStr = `⏳ Trend cũ kéo dài: <b>${mins}m ${secs}s</b>\n`;
        }

        const signal = instantTrend === 1 ? "BUY" : "SELL";
        const emoji = instantTrend === 1 ? "🟢" : "🔴";

        telly.sendMessage(
          `${emoji} <b>${signal} SIGNAL (FAST)</b>\n` +
            `📌 Price: <b>${currentPrice}</b>\n` +
            `🕒 Time: <b>${timeStr}</b>\n` +
            `${durationStr}📈 Trend mới: <b>${
              instantTrend === 1 ? "LONG" : "SHORT"
            }</b>`,
          instantTrend === 1 ? "success" : "error"
        );

        lastSignalTime = now;
      }

      // Log console với múi giờ VN
      console.log(
        `[${timeStr}] Price: ${currentPrice.toFixed(
          2
        )} | ST Line: ${st.value.toFixed(2)} | Trend: ${
          instantTrend === 1 ? "LONG" : "SHORT"
        }`
      );

      lastTrend = instantTrend;
      await wait(5000);
    } catch (e) {
      console.error("❌ Error:", e);
      await wait(5000);
    }
  }
}

runSupertrendTest();
