import { Telegraf } from "telegraf";
import { CONFIG } from "../config/settings.js";

export class TelegramService {
  private bot: Telegraf;

  constructor() {
    this.bot = new Telegraf(CONFIG.TELEGRAM_TOKEN);
    // XÓA bỏ dòng this.bot.launch() ở đây
  }

  // Hàm này để Bot chính gọi khi bắt đầu chạy
  launch() {
    this.bot
      .launch()
      .then(() => {
        console.log("🤖 Telegram Bot listener started!");
      })
      .catch((err) => {
        console.error("❌ Telegram Launch Error:", err);
      });
  }

  async sendMessage(
    text: string,
    type: "info" | "success" | "error" | "warning" = "info"
  ) {
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "🔻";
    if (type === "warning") icon = "⚠️";

    try {
      // Dùng CONFIG.CHAT_ID hoặc CONFIG.TELEGRAM_CHAT_ID tùy theo file settings của anh
      await this.bot.telegram.sendMessage(CONFIG.CHAT_ID, `${icon} ${text}`, {
        parse_mode: "HTML",
      });
    } catch (e) {
      console.error("Lỗi gửi Telegram:", e);
    }
  }

  onCommand(command: string, callback: (ctx: any) => void) {
    this.bot.command(command, callback);
  }
}
