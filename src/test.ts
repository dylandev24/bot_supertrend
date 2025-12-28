import { BingXService } from "./services/bingX.service.js";
import { TelegramService } from "./services/telegram.service.js";
import { calculateSupertrend } from "./services/indicator.js";
import { CONFIG } from "./config/settings.js";

const bingx = new BingXService();
const telly = new TelegramService();
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function runSupertrendTest() {
  console.log(`🚀 Supertrend Real-time Tester Started...`);

  let lastTrend: number | null = null;
  let lastSignalTime: number | null = null;

  while (true) {
    try {
      // 1. Lấy nến (BingX 1m)
      const candles = await bingx.getKlines(CONFIG.SYMBOL, "1m");
      if (!candles?.close?.length) {
        await wait(5000);
        continue;
      }

      // 2. Tính toán các đường Supertrend
      const st = calculateSupertrend(
        candles.high,
        candles.low,
        candles.close,
        CONFIG.ATR_PERIOD,
        CONFIG.ATR_MULTIPLIER
      );

      const currentPrice = candles.close.at(-1) ?? 0;
      const now = Date.now();

      // LOGIC NHẠY: So sánh giá hiện tại trực tiếp với đường ST
      // Nếu giá vượt lên đường ST -> Trend 1 (Long)
      // Nếu giá sập xuống đường ST -> Trend -1 (Short)
      const instantTrend = currentPrice > st.value ? 1 : -1;

      // 3. Kiểm tra đảo chiều tức thì
      if (lastTrend !== null && instantTrend !== lastTrend) {
        let durationStr = "";
        if (lastSignalTime) {
          const diff = Math.floor((now - lastSignalTime) / 1000);
          durationStr = `⏳ Trend cũ kéo dài: <b>${Math.floor(diff / 60)}m ${
            diff % 60
          }s</b>\n`;
        }

        const signal = instantTrend === 1 ? "BUY" : "SELL";
        const emoji = instantTrend === 1 ? "🟢" : "🔴";

        telly.sendMessage(
          `${emoji} <b>${signal} SIGNAL (FAST)</b>\n` +
            `📌 Price: <b>${currentPrice}</b>\n` +
            `🕒 Time: <b>${new Date().toLocaleTimeString("vi-VN")}</b>\n` +
            `${durationStr}📈 Trend mới: <b>${
              instantTrend === 1 ? "LONG" : "SHORT"
            }</b>`,
          instantTrend === 1 ? "success" : "error"
        );

        lastSignalTime = now;
      }

      // Log để bạn soi với TradingView
      console.log(
        `[${new Date().toLocaleTimeString()}] Price: ${currentPrice.toFixed(
          2
        )} | ST Line: ${st.value.toFixed(2)} | Trend: ${
          instantTrend === 1 ? "LONG" : "SHORT"
        }`
      );

      lastTrend = instantTrend;

      // Quét nhanh mỗi 5 giây để bắt kịp râu nến
      await wait(5000);
    } catch (e) {
      console.error("❌ Error:", e);
      await wait(5000);
    }
  }
}

runSupertrendTest();
