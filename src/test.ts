import { BingXService } from "./services/bingX.service.js";
import { TelegramService } from "./services/telegram.service.js";
import { calculateSupertrend } from "./services/indicator.js";
import { CONFIG } from "./config/settings.js";

//---------------------------------------
// INIT SERVICE
//---------------------------------------
const bingx = new BingXService();
const telly = new TelegramService();

//---------------------------------------
// SUPER TREND TEST
//---------------------------------------
async function runSupertrendTest() {
  console.log(`🚀 Supertrend Tester Running`);
  console.log(`📌 Symbol: ${CONFIG.SYMBOL}`);
  console.log(
    `📊 ATR: Period=${CONFIG.ATR_PERIOD}, Mult=${CONFIG.ATR_MULTIPLIER}`
  );
  console.log(`⌛ Interval: 10s (TF 1m)\n`);

  let lastTrend: number | null = null;
  let lastSignalTime: number | null = null;

  while (true) {
    try {
      const candles = await bingx.getKlines(CONFIG.SYMBOL, "1m");

      if (!candles || candles.close.length === 0) {
        console.log("⚠ Không lấy được nến — retry...");
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

      const price = candles.close.at(-1);
      const now = Date.now();

      // 📌 Format giờ Việt Nam
      const time = new Date().toLocaleString("vi-VN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
      });

      //---------------------------------------
      // GỬI SIGNAL KHI ĐẢO TREND
      //---------------------------------------
      if (lastTrend !== null && st.trend !== lastTrend) {
        let duration = "";
        if (lastSignalTime) {
          const diff = Math.floor((now - lastSignalTime) / 1000);
          const m = Math.floor(diff / 60);
          const s = diff % 60;
          duration = `⏳ Trend Time: <b>${m}m ${s}s</b>\n`;
        }

        if (st.trend === 1) {
          telly.sendMessage(
            `🟢 <b>BUY SIGNAL</b>\n📌 Price: <b>${price}</b>\n🕒 Time: <b>${time}</b>\n${duration}📈 Trend → LONG`,
            "success"
          );
        }

        if (st.trend === -1) {
          telly.sendMessage(
            `🔴 <b>SELL SIGNAL</b>\n📌 Price: <b>${price}</b>\n🕒 Time: <b>${time}</b>\n${duration}📉 Trend → SHORT`,
            "error"
          );
        }

        lastSignalTime = now;
      }

      console.log(
        `${time} | ${st.trend === 1 ? "🟢 LONG" : "🔴 SHORT"} | Price: ${price}`
      );

      lastTrend = st.trend;
      await wait(10000); // ⏱ 10s/lần → phù hợp test TF 1m
    } catch (e) {
      console.log("❌ ERROR:", e);
      await wait(5000);
    }
  }
}

//---------------------------------------
function wait(ms: any) {
  return new Promise((res) => setTimeout(res, ms));
}

runSupertrendTest();
