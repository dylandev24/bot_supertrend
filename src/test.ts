import { BingXService } from "./services/bingX.service.js";
import { TelegramService } from "./services/telegram.service.js";
import { calculateSupertrend } from "./services/indicator.js";
import { CONFIG } from "./config/settings.js";

//---------------------------------------
// INIT SERVICE
//---------------------------------------
const bingx = new BingXService();
const telly = new TelegramService();

// Helper: Đợi n ms
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * SUPER TREND TESTER
 * Mục tiêu: Theo dõi trend flip và đối chiếu chính xác với TradingView
 */
async function runSupertrendTest() {
  console.log(`🚀 Supertrend Tester Running`);
  console.log(`📌 Symbol: ${CONFIG.SYMBOL}`);
  console.log(
    `📊 ATR: Period=${CONFIG.ATR_PERIOD}, Mult=${CONFIG.ATR_MULTIPLIER}`
  );
  console.log(`⌛ Interval: 10s (Check liên tục để bắt nến đóng sớm)\n`);

  // Gửi thông báo khởi động qua Telegram
  telly.sendMessage(
    `🚀 <b>Supertrend Tester Started</b>\n` +
      `📌 Symbol: <b>${CONFIG.SYMBOL}</b>\n` +
      `📊 ATR: <b>${CONFIG.ATR_PERIOD} / ${CONFIG.ATR_MULTIPLIER}</b>\n` +
      `📡 System is watching for signals...`,
    "success"
  );

  let lastTrend: number | null = null;
  let lastSignalTime: number | null = null;

  while (true) {
    try {
      // 1. Lấy dữ liệu Klines (nến)
      const candles = await bingx.getKlines(CONFIG.SYMBOL, "1m");

      if (
        !candles ||
        !candles.close ||
        candles.close.length < CONFIG.ATR_PERIOD
      ) {
        console.log("⚠ Dữ liệu nến chưa đủ hoặc lỗi — retry sau 5s...");
        await wait(5000);
        continue;
      }

      // 2. Tính toán Supertrend
      // Lưu ý: Hàm này phải dùng bản RMA ATR để khớp TradingView
      const st = calculateSupertrend(
        candles.high,
        candles.low,
        candles.close,
        CONFIG.ATR_PERIOD,
        CONFIG.ATR_MULTIPLIER
      );

      const currentPrice = candles.close.at(-1);
      const now = Date.now();
      const timeStr = new Date().toLocaleString("vi-VN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      // 3. Log thông tin chi tiết để đối chiếu với TradingView
      // st.value là con số đường Supertrend đang hiển thị trên biểu đồ
      console.log(
        `[${timeStr}] | ${st.trend === 1 ? "🟢 LONG" : "🔴 SHORT"} | ` +
          `Price: ${currentPrice} | ST Line: ${st.value.toFixed(2)}`
      );

      // 4. Xử lý Logic Signal khi đảo chiều (Trend Flip)
      if (lastTrend !== null && st.trend !== lastTrend) {
        let durationStr = "";
        if (lastSignalTime) {
          const diffSec = Math.floor((now - lastSignalTime) / 1000);
          const m = Math.floor(diffSec / 60);
          const s = diffSec % 60;
          durationStr = `⏳ Trend cũ kéo dài: <b>${m}m ${s}s</b>\n`;
        }

        const signalType = st.trend === 1 ? "BUY" : "SELL";
        const emoji = st.trend === 1 ? "🟢" : "🔴";
        const trendText = st.trend === 1 ? "LONG" : "SHORT";

        // Gửi Telegram
        telly.sendMessage(
          `${emoji} <b>${signalType} SIGNAL</b>\n` +
            `📌 Price: <b>${currentPrice}</b>\n` +
            `🕒 Time: <b>${timeStr}</b>\n` +
            `${durationStr}` +
            `📈 Trend hiện tại: <b>${trendText}</b>`,
          st.trend === 1 ? "success" : "error"
        );

        lastSignalTime = now;
      }

      // Lưu lại trend hiện tại cho vòng lặp sau
      lastTrend = st.trend;

      // 5. Nghỉ 10s trước khi check tiếp
      await wait(10000);
    } catch (error: any) {
      console.error("❌ Lỗi hệ thống:", error?.message || error);
      await wait(5000); // Đợi lâu hơn nếu có lỗi kết nối
    }
  }
}

// Chạy chương trình
runSupertrendTest().catch(console.error);
