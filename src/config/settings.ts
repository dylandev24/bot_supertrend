import "dotenv/config";

export const CONFIG = {
  API_KEY: process.env.BINGX_API_KEY || "",
  SECRET_KEY: process.env.BINGX_SECRET_KEY || "",
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || "",
  CHAT_ID: process.env.TELEGRAM_CHAT_ID || "",
  HOST: "open-api.bingx.com",
  protocol: "https",

  // Cài đặt chiến thuật
  SYMBOL: "HYPE-USDT", // Luôn dùng định dạng X-USDT
  INITIAL_SIZE_USDT: 10, // Lệnh đầu (Level 0): 10U
  DCA_STEP_VALUE_USDT: 10, // Giá trị tăng thêm mỗi cấp: 10U (DCA = 10, 20, 30...)

  // Chỉ báo (Khớp chuẩn Pine v4)
  ATR_PERIOD: 14,
  ATR_MULTIPLIER: 3.0,

  // Mục tiêu
  TARGET_PNL_PERCENT: 0.35, // Chốt lời khi Net PnL đạt 0.35% tổng Volume

  TEST_MODE: false, // Chuyển sang false để chạy thật
};
