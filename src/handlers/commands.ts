import { Context } from "telegraf";
import { CONFIG } from "../config/settings.js";
import { BingXService } from "../services/bingX.service.js";
import { runCampaign } from "../index.js";

export const APP_STATE = { needRestart: false };

export const registerCommands = (telly: any, bingx: BingXService) => {
  // 1. Command /help: List all available commands
  telly.onCommand("help", (ctx: Context) => {
    let msg = `🆘 <b>AVAILABLE COMMANDS</b>\n\n`;
    msg += `🔹 <b>/status</b> - Show detailed current positions & PnL\n`;
    msg += `🔹 <b>/dca</b> - Check current DCA Level & Skew info\n`;
    msg += `🔹 <b>/balance</b> - Check your USDT Futures balance\n`;
    msg += `🔹 <b>/config</b> - View current bot settings\n`;
    msg += `🔹 <b>/set [SYMBOL] [VOL]</b> - Start new campaign (e.g., /set BTC 500)\n`;
    msg += `🔹 <b>/indicator [P] [M]</b> - Set ST Period & Multiplier\n`;
    msg += `🔹 <b>/stop</b> - Emergency close all positions & stop bot`;

    ctx.reply(msg, { parse_mode: "HTML" });
  });

  // 2. Command /status: Detailed position info
  telly.onCommand("status", async (ctx: Context) => {
    try {
      const pos = await bingx.getPositionDetails(CONFIG.SYMBOL);
      const netPnL = await bingx.getNetPnL(CONFIG.SYMBOL);

      if (pos.length === 0)
        return ctx.reply(`📊 <b>${CONFIG.SYMBOL}</b>: No active positions.`);

      // Tính tổng Volume thực tế
      const totalVol = pos.reduce(
        (sum: any, p: any) => sum + Math.abs(p.notional),
        0
      );
      // Tính Target USD thực tế
      const realTargetUSD = totalVol * (CONFIG.TARGET_PNL_PERCENT / 100);

      let msg = `📊 <b>STATUS: ${CONFIG.SYMBOL}</b>\n\n`;
      pos.forEach((p: any) => {
        const sideIcon = p.side === "LONG" ? "🟢" : "🔴";
        msg += `${sideIcon} <b>${p.side}</b> | x${p.leverage}\n`;
        msg += `   🔹 Vol: $${p.notional.toFixed(2)}\n`;
        msg += `   🔹 PnL: <b>${p.unrealizedProfit.toFixed(2)}$</b>\n\n`;
      });

      const pnlIcon = netPnL >= 0 ? "💰" : "📉";
      msg += `------------------------\n`;
      msg += `${pnlIcon} <b>Total PnL: ${netPnL.toFixed(3)}$</b>\n`;
      msg += `🎯 <b>Target (${
        CONFIG.TARGET_PNL_PERCENT
      }%): ${realTargetUSD.toFixed(3)}$</b>\n`;
      msg += `📊 Current ROI: ${((netPnL / totalVol) * 100).toFixed(2)}%`;

      ctx.reply(msg, { parse_mode: "HTML" });
    } catch (e) {
      ctx.reply("❌ Error fetching status.");
    }
  });

  // 3. Command /dca: Skew and Level info
  telly.onCommand("dca", async (ctx: Context) => {
    try {
      const initialQty = await bingx.amountToQty(
        CONFIG.INITIAL_SIZE_USDT,
        CONFIG.SYMBOL
      );
      const currentLevel = await bingx.getCurrentDcaLevel(
        CONFIG.SYMBOL,
        initialQty
      );

      const pos = await bingx.getPositionDetails(CONFIG.SYMBOL);
      const longVol = pos.find((p: any) => p.side === "LONG")?.notional || 0;
      const shortVol = pos.find((p: any) => p.side === "SHORT")?.notional || 0;
      const skew = Math.abs(longVol - shortVol);

      let msg = `🔄 <b>DCA ANALYTICS</b>\n\n`;
      msg += `📈 Current Level: <b>Level ${currentLevel}</b>\n`;
      msg += `⚖️ Skew Amount: $${skew.toFixed(2)}\n`;
      msg += `💸 DCA Step Value: $${CONFIG.DCA_STEP_VALUE_USDT}\n`;
      msg += `🚀 Skew Direction: ${
        longVol > shortVol ? "LONG 🟢" : "SHORT 🔴"
      }`;

      ctx.reply(msg, { parse_mode: "HTML" });
    } catch (e) {
      ctx.reply("❌ Error calculating DCA stats.");
    }
  });

  // 4. Command /config: View system settings
  telly.onCommand("config", (ctx: Context) => {
    let msg = `⚙️ <b>BOT CONFIGURATION</b>\n\n`;
    msg += `💎 Symbol: <code>${CONFIG.SYMBOL}</code>\n`;
    msg += `💵 Capital: $${CONFIG.CAPITAL}\n`;
    msg += `📦 Initial Vol: $${CONFIG.INITIAL_SIZE_USDT}\n`;
    msg += `🎯 Target: ${CONFIG.TARGET_PNL_PERCENT}%\n`;
    msg += `📉 Supertrend: ${CONFIG.ATR_PERIOD} / ${CONFIG.ATR_MULTIPLIER}\n`;
    msg += `⏱ Interval: 60s (TF: 15m)`;

    ctx.reply(msg, { parse_mode: "HTML" });
  });

  // 5. Command /set: Update pair and volume
  telly.onCommand("set", async (ctx: any) => {
    const args = ctx.message.text.split(" ");
    if (args.length === 3) {
      let sym = args[1].toUpperCase();
      if (!sym.includes("-")) sym = sym.replace("USDT", "-USDT");
      if (!sym.endsWith("-USDT")) sym += "-USDT";

      CONFIG.SYMBOL = sym;
      CONFIG.INITIAL_SIZE_USDT = parseFloat(args[2]);

      await ctx.reply(
        `✅ <b>SETTINGS SAVED</b>\nBot will restart and manage <b>${sym}</b> shortly.`,
        { parse_mode: "HTML" }
      );
      APP_STATE.needRestart = true;
      runCampaign(false);
    } else {
      ctx.reply("❌ Invalid syntax. Example: /set HYPE 300");
    }
  });

  // 6. Command /balance
  telly.onCommand("balance", async (ctx: any) => {
    try {
      const b = await bingx.getBalance();
      ctx.reply(`💰 Futures Wallet: <b>${b.toFixed(2)} USDT</b>`, {
        parse_mode: "HTML",
      });
    } catch (e) {
      ctx.reply("❌ Error fetching balance.");
    }
  });

  // 7. Command /indicator: Update Supertrend settings
  telly.onCommand("indicator", async (ctx: any) => {
    const args = ctx.message.text.split(" ");
    if (args.length === 3) {
      CONFIG.ATR_PERIOD = parseInt(args[1]);
      CONFIG.ATR_MULTIPLIER = parseFloat(args[2]);
      ctx.reply(
        `📊 <b>INDICATOR UPDATED</b>\nATR Period: ${CONFIG.ATR_PERIOD}\nMultiplier: ${CONFIG.ATR_MULTIPLIER}`
      );
    } else {
      ctx.reply("❌ Use: /indicator 10 3.0");
    }
  });
};
