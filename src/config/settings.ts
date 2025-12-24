import "dotenv/config";

export const CONFIG = {
  API_KEY: process.env.BINGX_API_KEY || "",
  SECRET_KEY: process.env.BINGX_SECRET_KEY || "",
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || "",
  CHAT_ID: process.env.TELEGRAM_CHAT_ID || "", // ID người nhận thông báo
  HOST: "open-api.bingx.com",
  protocol: "https",
  SYMBOL: "BTC-USDT",
  CAPITAL: 10,
  INITIAL_SIZE_USDT: 10,
  DCA_STEP_VALUE_USDT: 2,

  // Các thông số có thể thay đổi qua Telegram
  ATR_PERIOD: 10,
  ATR_MULTIPLIER: 3.0,
  TARGET_PNL_PERCENT: 0.35,
};
