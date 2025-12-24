import { Telegraf } from "telegraf";
import { CONFIG } from "../config/settings.js";

export class TelegramService {
  private bot: Telegraf;

  constructor() {
    this.bot = new Telegraf(CONFIG.TELEGRAM_TOKEN);
    this.bot.launch();
  }

  // Gửi thông báo với màu sắc giả lập bằng Emoji
  async sendMessage(
    text: string,
    type: "info" | "success" | "error" | "warning" = "info"
  ) {
    let icon = "ℹ️";
    if (type === "success") icon = "✅"; // Dương / Chốt lời
    if (type === "error") icon = "🔻"; // Âm / Lỗi
    if (type === "warning") icon = "⚠️"; // DCA

    try {
      await this.bot.telegram.sendMessage(CONFIG.CHAT_ID, `${icon} ${text}`, {
        parse_mode: "HTML",
      });
    } catch (e) {
      console.error("Lỗi gửi Telegram:", e);
    }
  }

  // Lắng nghe lệnh từ người dùng
  onCommand(command: string, callback: (ctx: any) => void) {
    this.bot.command(command, callback);
  }
}
