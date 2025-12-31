import { CONFIG } from "./config/settings.js";
import { BingXService } from "./services/bingX.service.js";
import { calculateSupertrend } from "./services/indicator.js";
import { TelegramService } from "./services/telegram.service.js";
import { registerCommands, APP_STATE } from "./handlers/commands.js";

const bingx = new BingXService();
const telly = new TelegramService();

let isCampaignRunning = false;

registerCommands(telly, bingx);

async function runCampaign(resumeFromExisting = false, startLevel = 0) {
  if (isCampaignRunning && !resumeFromExisting) return;
  isCampaignRunning = true;
  APP_STATE.needRestart = false;

  let currentDcaLevel = startLevel;
  let lastSignalTrend: number | null = null;

  try {
    if (!resumeFromExisting) {
      console.log(`\n🚀 --- [STARTING NEW CYCLE: ${CONFIG.SYMBOL}] ---`);
      const maxLev = await bingx.getMaxLeverage(CONFIG.SYMBOL);
      await Promise.all([
        bingx.setLeverage(CONFIG.SYMBOL, maxLev, "LONG"),
        bingx.setLeverage(CONFIG.SYMBOL, maxLev, "SHORT"),
      ]);

      const initialQty = await bingx.amountToQty(
        CONFIG.INITIAL_SIZE_USDT,
        CONFIG.SYMBOL
      );

      // Mở lệnh Hedge ban đầu
      await Promise.all([
        bingx.openLong(initialQty),
        bingx.openShort(initialQty),
      ]);

      await telly.sendMessage(
        `🆕 <b>NEW CYCLE STARTED</b>\nSymbol: ${CONFIG.SYMBOL}\nInitial Vol: $${CONFIG.INITIAL_SIZE_USDT}`
      );
    }

    while (isCampaignRunning) {
      if (APP_STATE.needRestart) break;

      const candles = await bingx.getKlines(CONFIG.SYMBOL, "1m");

      console.log(candles);
      if (!candles) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      const st = calculateSupertrend(
        candles.high,
        candles.low,
        candles.close,
        CONFIG.ATR_PERIOD,
        CONFIG.ATR_MULTIPLIER
      );
      const positions = await bingx.getPositionDetails(CONFIG.SYMBOL);
      const netPnL = await bingx.getNetPnL(CONFIG.SYMBOL);

      // Tính toán Target dựa trên Volume thực tế
      const totalVolume = positions.reduce(
        (sum: any, p: any) => sum + Math.abs(p.notional),
        0
      );
      const targetProfitUSD = totalVolume * (CONFIG.TARGET_PNL_PERCENT / 100);

      if (totalVolume > 0) {
        console.log(
          `[${new Date().toLocaleTimeString()}] PnL: ${netPnL.toFixed(
            3
          )}$ / Target: ${targetProfitUSD.toFixed(3)}$`
        );

        // KIỂM TRA CHỐT LỜI
        if (netPnL >= targetProfitUSD) {
          await telly.sendMessage(
            `💰 <b>TARGET REACHED!</b>\nProfit: +${netPnL.toFixed(
              3
            )}$\nPreparing next cycle...`
          );

          await bingx.closeAll(CONFIG.SYMBOL);

          // Đợi 5 giây để sàn cập nhật số dư và lệnh đóng hoàn tất
          await new Promise((r) => setTimeout(r, 5000));

          isCampaignRunning = false; // Reset trạng thái để gọi vòng mới
          return runCampaign(false); // <--- ĐÂY LÀ CHÌA KHÓA: Mở vòng mới ngay lập tức
        }
      }

      // Trong vòng lặp runCampaign, đoạn check st.trend !== lastSignalTrend:

      if (st.trend !== lastSignalTrend) {
        currentDcaLevel++; // Tăng level (1, 2, 3...)

        // Công thức cấp số cộng:
        // Level 1: 10 + (1 * 10) = 20U
        // Level 2: 10 + (2 * 10) = 30U
        const dcaAmount =
          CONFIG.INITIAL_SIZE_USDT +
          currentDcaLevel * CONFIG.DCA_STEP_VALUE_USDT;

        const dcaQty = await bingx.amountToQty(dcaAmount, CONFIG.SYMBOL);

        if (st.trend === 1) await bingx.openLong(dcaQty);
        else await bingx.openShort(dcaQty);

        await telly.sendMessage(
          `🔄 <b>DCA ARITHMETIC SKEW (Lv.${currentDcaLevel})</b>\n` +
            `Direction: ${st.trend === 1 ? "LONG 🟢" : "SHORT 🔴"}\n` +
            `Added: <b>$${dcaAmount}</b>\n` +
            `Next Target Vol: <b>$${(totalVolume + dcaAmount).toFixed(2)}</b>`
        );

        lastSignalTrend = st.trend;
      }

      lastSignalTrend = st.trend;
      await new Promise((res) => setTimeout(res, 10000)); // Check mỗi 10 giây cho chart 1m
    }
  } catch (error: any) {
    console.error("Campaign Error:", error);
    isCampaignRunning = false;
    // Nếu lỗi, đợi 30s rồi thử khởi động lại vòng mới
    setTimeout(() => runCampaign(false), 30000);
  }
}

async function bootstrap() {
  console.log("🔍 Scanning for active positions...");
  const positions = await bingx.getPositionDetails();

  if (positions.length > 0) {
    CONFIG.SYMBOL = positions[0].symbol;
    console.log(`✅ Found active trade for ${CONFIG.SYMBOL}.`);

    // Tính toán lại khối lượng ban đầu để suy ra Level
    const initialQty = await bingx.amountToQty(
      CONFIG.INITIAL_SIZE_USDT,
      CONFIG.SYMBOL
    );
    const recoveredLevel = await bingx.getCurrentDcaLevel(
      CONFIG.SYMBOL,
      initialQty
    );

    console.log(`📈 Recovered DCA Level: ${recoveredLevel}`);

    // Chạy campaign với level đã khôi phục
    runCampaign(true, recoveredLevel);
  } else {
    console.log("💤 Idle. Waiting for /set command.");
  }
}

bootstrap();
export { runCampaign };
