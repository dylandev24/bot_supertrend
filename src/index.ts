import { CONFIG } from "./config/settings.js";
import { BingXService } from "./services/bingX.service.js";
import { calculateSupertrend } from "./services/indicator.js";
import { TelegramService } from "./services/telegram.service.js";
import { registerCommands, APP_STATE } from "./handlers/commands.js";

const bingx = new BingXService();
const telly = new TelegramService();

let isCampaignRunning = false;

registerCommands(telly, bingx);

/**
 * Helper to get the timestamp of the last completed candle (n-2)
 */
function getClosedCandleTime(candles: any): number {
  return candles.time ? candles.time[candles.time.length - 2] : 0;
}

async function runCampaign(resumeFromExisting = false, startLevel = 0) {
  if (isCampaignRunning && !resumeFromExisting) return;
  isCampaignRunning = true;
  APP_STATE.needRestart = false;

  let currentDcaLevel = startLevel;
  let lastSignalTrend: number | null = null;
  let lastProcessedCandleTime: number | null = null;

  try {
    // --- 1. INITIALIZATION OR RESUME ---
    if (!resumeFromExisting) {
      console.log(`\n🚀 --- [STARTING NEW CYCLE: ${CONFIG.SYMBOL}] ---`);

      // Use a safe leverage (e.g., 20x) to avoid exchange rejections during DCA
      const safeLev = 75;
      await Promise.all([
        bingx.setLeverage(CONFIG.SYMBOL, safeLev, "LONG"),
        bingx.setLeverage(CONFIG.SYMBOL, safeLev, "SHORT"),
      ]);

      const initialQty = await bingx.amountToQty(
        CONFIG.INITIAL_SIZE_USDT,
        CONFIG.SYMBOL
      );

      // Open Hedge
      await Promise.all([
        bingx.openLong(initialQty),
        bingx.openShort(initialQty),
      ]);

      await telly.sendMessage(
        `🚀 <b>INITIAL HEDGE OPENED</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `💎 Symbol: <code>${CONFIG.SYMBOL}</code>\n` +
          `💰 Base Vol: <b>$${CONFIG.INITIAL_SIZE_USDT}</b>\n` +
          `⚖️ Leverage: <b>x${safeLev}</b>\n` +
          `🎯 Target: <b>${CONFIG.TARGET_PNL_PERCENT}%</b>`
      );
    }

    // --- 2. MAIN LOOP ---
    while (isCampaignRunning) {
      if (APP_STATE.needRestart) break;

      const candlesRaw = await bingx.getKlines(CONFIG.SYMBOL, "1m", 500);
      if (!candlesRaw || !candlesRaw.close) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      const closedTime = getClosedCandleTime(candlesRaw);
      const positions = await bingx.getPositionDetails(CONFIG.SYMBOL);
      const netPnL = await bingx.getNetPnL(CONFIG.SYMBOL);

      const totalVolume = positions.reduce(
        (sum: number, p: any) => sum + Math.abs(Number(p.notional)),
        0
      );
      const targetProfitUSD = totalVolume * (CONFIG.TARGET_PNL_PERCENT / 100);

      // --- 3. PROFIT TAKING (Check every 10s) ---
      if (totalVolume > 0 && netPnL >= targetProfitUSD && targetProfitUSD > 0) {
        console.log(`\n💰 TARGET REACHED! Closing all positions...`);

        await bingx.closeAll(CONFIG.SYMBOL);

        await telly.sendMessage(
          `✅ <b>PROFIT TARGET REACHED</b>\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `💰 Net PnL: <b>+$${netPnL.toFixed(3)}</b>\n` +
            `📊 Total Volume: $${totalVolume.toFixed(2)}\n` +
            `⏱ <i>Cooldown 30s before next cycle...</i>`
        );

        // RESET STATE & COOLDOWN
        isCampaignRunning = false;
        setTimeout(() => runCampaign(false), 30000); // Wait 30s to let exchange settle
        return;
      }

      // --- 4. ARITHMETIC DCA (Check on Candle Close) ---
      if (
        lastProcessedCandleTime !== null &&
        closedTime !== lastProcessedCandleTime
      ) {
        const st = calculateSupertrend(
          candlesRaw.high.map(Number),
          candlesRaw.low.map(Number),
          candlesRaw.close.map(Number),
          CONFIG.ATR_PERIOD,
          CONFIG.ATR_MULTIPLIER
        );

        // Init trend on first closed candle
        if (lastSignalTrend === null) lastSignalTrend = st.trend;

        if (st.trend !== lastSignalTrend) {
          currentDcaLevel++;

          // Formula: Initial + (Level * Step) -> 10, 20, 30...
          const dcaAmount =
            CONFIG.INITIAL_SIZE_USDT +
            currentDcaLevel * CONFIG.DCA_STEP_VALUE_USDT;
          const dcaQty = await bingx.amountToQty(dcaAmount, CONFIG.SYMBOL);

          const side = st.trend === 1 ? "LONG" : "SHORT";
          const icon = st.trend === 1 ? "🟢" : "🔴";

          // Execute Order
          if (st.trend === 1) await bingx.openLong(dcaQty);
          else await bingx.openShort(dcaQty);

          // Detailed Telegram Notification
          await telly.sendMessage(
            `🔄 <b>DCA ORDER EXECUTED (Lv.${currentDcaLevel})</b>\n` +
              `━━━━━━━━━━━━━━━━━━\n` +
              `Direction: ${icon} <b>${side}</b>\n` +
              `Added Size: <b>$${dcaAmount}</b>\n` +
              `New Total Vol: $${(totalVolume + dcaAmount).toFixed(2)}\n` +
              `Last Price: ${candlesRaw.close[candlesRaw.close.length - 1]}`
          );

          lastSignalTrend = st.trend;
        }
        lastProcessedCandleTime = closedTime;
      } else if (lastProcessedCandleTime === null) {
        lastProcessedCandleTime = closedTime;
      }

      await new Promise((res) => setTimeout(res, 10000));
    }
  } catch (error: any) {
    console.error("\n❌ Campaign Error:", error);
    await telly.sendMessage(
      `⚠️ <b>Critical Error:</b> ${error.message || "Check logs"}`
    );
    isCampaignRunning = false;
    setTimeout(() => runCampaign(false), 30000);
  }
}

async function bootstrap() {
  console.log("🔍 Scanning for active positions...");
  try {
    const positions = await bingx.getPositionDetails();

    if (positions.length > 0) {
      CONFIG.SYMBOL = positions[0].symbol;
      console.log(`✅ Recovering active trade: ${CONFIG.SYMBOL}`);

      const initialQty = await bingx.amountToQty(
        CONFIG.INITIAL_SIZE_USDT,
        CONFIG.SYMBOL
      );
      const recoveredLevel = await bingx.getCurrentDcaLevel(
        CONFIG.SYMBOL,
        initialQty
      );

      console.log(`📈 Recovered DCA Level: ${recoveredLevel}`);
      runCampaign(true, recoveredLevel);
    } else {
      console.log("💤 Idle. Waiting for /set command via Telegram.");
    }
  } catch (e) {
    console.error("Bootstrap failed. Check API Keys and Network.");
  }
}

bootstrap();
export { runCampaign };
