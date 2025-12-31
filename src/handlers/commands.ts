import { Context } from "telegraf";
import { CONFIG } from "../config/settings.js";
import { BingXService } from "../services/bingX.service.js";
import { runCampaign } from "../index.js";

export const APP_STATE = { needRestart: false };

export const registerCommands = (telly: any, bingx: BingXService) => {
  // 1. Command /help
  telly.onCommand("help", (ctx: Context) => {
    let msg = `🆘 <b>AVAILABLE COMMANDS</b>\n\n`;
    msg += `🔹 <b>/status</b> - Current positions, PnL & Target progress\n`;
    msg += `🔹 <b>/dca</b> - Arithmetic DCA logic & next step info\n`;
    msg += `🔹 <b>/balance</b> - Check USDT Futures wallet\n`;
    msg += `🔹 <b>/config</b> - View current strategy settings\n`;
    msg += `🔹 <b>/set [SYMBOL] [VOL]</b> - Start new cycle (e.g., /set BTC 10)\n`;
    msg += `🔹 <b>/indicator [P] [M]</b> - Change ST Period & Multiplier\n`;
    msg += `🔹 <b>/stop</b> - Emergency close all & stop bot`;

    ctx.reply(msg, { parse_mode: "HTML" });
  });

  // 2. Command /status: Detailed PnL and Progress
  telly.onCommand("status", async (ctx: Context) => {
    try {
      const pos = await bingx.getPositionDetails(CONFIG.SYMBOL);
      const netPnL = await bingx.getNetPnL(CONFIG.SYMBOL);

      if (pos.length === 0)
        return ctx.reply(`📊 <b>${CONFIG.SYMBOL}</b>: No active positions.`);

      const totalVol = pos.reduce(
        (sum: any, p: any) => sum + Math.abs(p.notional),
        0
      );
      const realTargetUSD = totalVol * (CONFIG.TARGET_PNL_PERCENT / 100);
      const progress = (netPnL / realTargetUSD) * 100;

      let msg = `📊 <b>STATUS: ${CONFIG.SYMBOL}</b>\n\n`;
      pos.forEach((p: any) => {
        const sideIcon = p.side === "LONG" ? "🟢" : "🔴";
        msg += `${sideIcon} <b>${p.side}</b> | x${p.leverage}\n`;
        msg += `   🔹 Size: $${Math.abs(p.notional).toFixed(2)}\n`;
        msg += `   🔹 PnL: <b>${p.unrealizedProfit.toFixed(2)}$</b>\n\n`;
      });

      const pnlIcon = netPnL >= 0 ? "💰" : "📉";
      msg += `------------------------\n`;
      msg += `${pnlIcon} <b>Net PnL: ${netPnL.toFixed(3)}$</b>\n`;
      msg += `🎯 <b>Target: ${realTargetUSD.toFixed(3)}$</b> (${
        CONFIG.TARGET_PNL_PERCENT
      }%)\n`;
      msg += `📈 <b>Progress: ${progress.toFixed(1)}%</b>`;

      ctx.reply(msg, { parse_mode: "HTML" });
    } catch (e) {
      ctx.reply("❌ Error fetching status.");
    }
  });

  // 3. Command /dca: Explaining the Arithmetic Progression
  telly.onCommand("dca", async (ctx: Context) => {
    try {
      const pos = await bingx.getPositionDetails(CONFIG.SYMBOL);
      const longVol = Math.abs(
        pos.find((p: any) => p.side === "LONG")?.notional || 0
      );
      const shortVol = Math.abs(
        pos.find((p: any) => p.side === "SHORT")?.notional || 0
      );

      let msg = `🔄 <b>ARITHMETIC DCA INFO</b>\n\n`;
      msg += `📐 <b>Formula:</b> <code>Initial + (Lv * Step)</code>\n`;
      msg += `💵 Base: $${CONFIG.INITIAL_SIZE_USDT} | Step: +$${CONFIG.DCA_STEP_VALUE_USDT}\n\n`;
      msg += `🟢 Long Vol: $${longVol.toFixed(2)}\n`;
      msg += `🔴 Short Vol: $${shortVol.toFixed(2)}\n`;
      msg += `⚖️ Current Skew: <b>$${Math.abs(longVol - shortVol).toFixed(
        2
      )}</b>\n\n`;
      msg += `⚠️ <i>Bot will add volume on confirmed candle close trend changes.</i>`;

      ctx.reply(msg, { parse_mode: "HTML" });
    } catch (e) {
      ctx.reply("❌ Error calculating DCA analytics.");
    }
  });

  // 4. Command /config
  telly.onCommand("config", (ctx: Context) => {
    let msg = `⚙️ <b>BOT SETTINGS</b>\n\n`;
    msg += `💎 Symbol: <code>${CONFIG.SYMBOL}</code>\n`;
    msg += `📦 Initial Size: $${CONFIG.INITIAL_SIZE_USDT}\n`;
    msg += `➕ DCA Step: $${CONFIG.DCA_STEP_VALUE_USDT}\n`;
    msg += `🎯 Target: ${CONFIG.TARGET_PNL_PERCENT}%\n`;
    msg += `📊 Supertrend: ${CONFIG.ATR_PERIOD} / ${CONFIG.ATR_MULTIPLIER}\n`;
    msg += `🛡 Mode: <b>Confirmed (Candle Close)</b>`;

    ctx.reply(msg, { parse_mode: "HTML" });
  });

  // 5. Command /set [SYMBOL] [VOL]
  telly.onCommand("set", async (ctx: any) => {
    const args = ctx.message.text.split(" ");
    if (args.length === 3) {
      let sym = args[1].toUpperCase();
      if (!sym.includes("-")) sym = sym.replace("USDT", "-USDT");
      if (!sym.endsWith("-USDT")) sym += "-USDT";

      CONFIG.SYMBOL = sym;
      CONFIG.INITIAL_SIZE_USDT = parseFloat(args[2]);
      // Reset step to match initial for pure arithmetic (10, 20, 30...)
      CONFIG.DCA_STEP_VALUE_USDT = CONFIG.INITIAL_SIZE_USDT;

      await ctx.reply(
        `✅ <b>CAMPAIGN UPDATED</b>\nSymbol: <b>${sym}</b>\nBase Vol: <b>$${CONFIG.INITIAL_SIZE_USDT}</b>\n\n<i>Restarting cycle...</i>`,
        { parse_mode: "HTML" }
      );
      APP_STATE.needRestart = true;
      runCampaign(false);
    } else {
      ctx.reply("❌ Use: /set BTC 10");
    }
  });

  // 6. Command /balance
  telly.onCommand("balance", async (ctx: any) => {
    try {
      const b = await bingx.getBalance();
      ctx.reply(`💰 Futures Balance: <b>${b.toFixed(2)} USDT</b>`, {
        parse_mode: "HTML",
      });
    } catch (e) {
      ctx.reply("❌ Error fetching balance.");
    }
  });

  // 7. Command /stop: Emergency Close
  telly.onCommand("stop", async (ctx: any) => {
    try {
      await bingx.closeAll(CONFIG.SYMBOL);
      APP_STATE.needRestart = true;
      ctx.reply("🛑 <b>EMERGENCY STOP</b>\nAll positions closed. Bot paused.");
    } catch (e) {
      ctx.reply("❌ Error during emergency stop.");
    }
  });
};
