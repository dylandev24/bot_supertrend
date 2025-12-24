import CryptoJS from "crypto-js";
import axios from "axios";
import { CONFIG } from "../config/settings.js";

// Định nghĩa các hằng số để tránh gõ sai (Customizable types)
export type Side = "BUY" | "SELL";
export type PositionSide = "LONG" | "SHORT";

export class BingXService {
  // --- PRIVATE UTILS ---
  private getParameters(
    payload: any,
    timestamp: number,
    urlEncode: boolean = false
  ) {
    let parameters = "";
    const keys = Object.keys(payload).sort();
    for (const key of keys) {
      const value = urlEncode ? encodeURIComponent(payload[key]) : payload[key];
      parameters += `${key}=${value}&`;
    }
    parameters += `timestamp=${timestamp}`;
    return parameters;
  }

  async request(method: string, path: string, payload: any = {}) {
    const timestamp = new Date().getTime();
    const paramsStr = this.getParameters(payload, timestamp);
    const signature = CryptoJS.enc.Hex.stringify(
      CryptoJS.HmacSHA256(paramsStr, CONFIG.SECRET_KEY)
    );

    const url = `${CONFIG.protocol}://${
      CONFIG.HOST
    }${path}?${this.getParameters(
      payload,
      timestamp,
      true
    )}&signature=${signature}`;

    try {
      const resp = await axios({
        method,
        url,
        headers: { "X-BX-APIKEY": CONFIG.API_KEY },
        transformResponse: [(data) => data],
      });
      return JSON.parse(resp.data);
    } catch (error: any) {
      console.error(
        `🔴 API Error [${path}]:`,
        error.response?.data || error.message
      );
      return null;
    }
  }

  // --- PUBLIC API METHODS ---

  /**
   * Lấy số dư ví Perpetual Futures (USDT)
   */
  async getBalance(): Promise<number> {
    try {
      const res = await this.request("GET", "/openApi/swap/v2/user/balance");

      // Debug log để bạn theo dõi
      // console.log("Balance Response:", JSON.stringify(res));

      if (res && res.code === 0 && res.data) {
        // 1. Trường hợp data.balance là một object (như kết quả bạn vừa gửi)
        if (res.data.balance && res.data.balance.asset === "USDT") {
          return parseFloat(res.data.balance.balance || 0);
        }

        // 2. Trường hợp data là một mảng (phòng hờ sàn đổi format)
        if (Array.isArray(res.data)) {
          const usdt = res.data.find((item: any) => item.asset === "USDT");
          return usdt ? parseFloat(usdt.balance) : 0;
        }

        // 3. Trường hợp data.balance là một mảng
        if (res.data.balance && Array.isArray(res.data.balance)) {
          const usdt = res.data.balance.find(
            (item: any) => item.asset === "USDT"
          );
          return usdt ? parseFloat(usdt.balance) : 0;
        }
      }
      return 0;
    } catch (error) {
      console.error("Error fetching balance:", error);
      return 0;
    }
  }

  /**
   * Lấy nến để tính Supertrend
   */
  async getKlines(
    symbol: string,
    interval: string = "15m",
    limit: number = 100
  ) {
    const res = await this.request("GET", "/openApi/swap/v3/quote/klines", {
      symbol,
      interval,
      limit,
    });

    // Kiểm tra và Log dữ liệu nếu cần debug
    // console.log("Klines Response:", JSON.stringify(res));

    if (!res || res.code !== 0 || !res.data) {
      console.error("❌ Failed to fetch Klines:", res?.msg);
      return null;
    }

    // BingX V3 thường trả về mảng trực tiếp trong res.data
    // Tuy nhiên, ta cần đảm bảo nó là một mảng trước khi dùng .map()
    const candles = Array.isArray(res.data) ? res.data : [];

    if (candles.length === 0) {
      console.warn("⚠️ Klines data is empty");
      return null;
    }

    return {
      high: candles.map((d: any) => parseFloat(d.high || d[2])), // d.high hoặc index 2 tùy version
      low: candles.map((d: any) => parseFloat(d.low || d[3])),
      close: candles.map((d: any) => parseFloat(d.close || d[4])),
    };
  }

  /**
   * Đặt lệnh Market (Hedge Mode)
   * Chỗ này cực kỳ quan trọng:
   * - Để MỞ Long: side=BUY, positionSide=LONG
   * - Để MỞ Short: side=SELL, positionSide=SHORT
   */
  async placeOrder(side: Side, posSide: PositionSide, quantity: number) {
    return await this.request("POST", "/openApi/swap/v2/trade/order", {
      symbol: CONFIG.SYMBOL,
      side,
      positionSide: posSide,
      type: "MARKET",
      quantity: quantity.toString(),
    });
  }

  // Thêm vào class BingXService

  /**
   * Lấy đòn bẩy tối đa của Symbol
   */
  async getMaxLeverage(symbol: string): Promise<number> {
    try {
      // Thử endpoint User Leverage (yêu cầu chữ ký)
      const res = await this.request("GET", "/openApi/swap/v2/user/leverage", {
        symbol,
      });

      if (res && res.code === 0 && res.data) {
        // BingX trả về mảng, ta tìm bản ghi có maxLeverage
        const data = Array.isArray(res.data) ? res.data[0] : res.data;
        if (data && data.maxLeverage) {
          return parseInt(data.maxLeverage);
        }
      }

      // Nếu endpoint trên không trả về (thường do chưa có vị thế),
      // ta dùng bảng giá trị mặc định cho các coin phổ biến
      const commonMaxLeverage: { [key: string]: number } = {
        "BTC-USDT": 125,
        "ETH-USDT": 100,
        "SOL-USDT": 50,
        "XRP-USDT": 50,
        "ADA-USDT": 50,
      };

      return commonMaxLeverage[symbol] || 20; // Mặc định 20 nếu coin lạ
    } catch (error) {
      console.error("Critical error fetching leverage:", error);
      return 20;
    }
  }

  /**
   * Cài đặt đòn bẩy cho Symbol
   */
  async setLeverage(
    symbol: string,
    leverage: number,
    side: "LONG" | "SHORT"
  ): Promise<any> {
    return await this.request("POST", "/openApi/swap/v2/trade/leverage", {
      symbol,
      leverage,
      side,
    });
  }

  // --- HELPER METHODS CHO CHIẾN LƯỢC (Dễ Custom) ---

  async openLong(qty: number) {
    console.log(`🟢 [ORDER] Open LONG - Size: ${qty}`);
    return this.placeOrder("BUY", "LONG", qty);
  }

  async openShort(qty: number) {
    console.log(`🔴 [ORDER] Open SHORT - Size: ${qty}`);
    return this.placeOrder("SELL", "SHORT", qty);
  }

  async getNetPnL(symbol: string): Promise<number> {
    const res = await this.request("GET", "/openApi/swap/v2/user/positions", {
      symbol,
    });
    if (!res || !res.data) return 0;
    return res.data.reduce(
      (sum: number, pos: any) => sum + parseFloat(pos.unrealizedProfit || 0),
      0
    );
  }

  async closeAll(symbol: string) {
    const res = await this.request("GET", "/openApi/swap/v2/user/positions", {
      symbol,
    });
    if (!res || !res.data) return;

    for (const pos of res.data) {
      const amount = parseFloat(pos.positionAmt);
      if (amount === 0) continue;

      // Logic đóng lệnh chuẩn Hedge Mode:
      // Đang cầm Long (amt > 0) -> Đánh lệnh SELL trên vị thế LONG
      // Đang cầm Short (amt < 0) -> Đánh lệnh BUY trên vị thế SHORT
      const side: Side = amount > 0 ? "SELL" : "BUY";
      const posSide: PositionSide = pos.positionSide as PositionSide;

      console.log(`[CLOSE] Đóng ${posSide} | Vol: ${Math.abs(amount)}`);
      await this.placeOrder(side, posSide, Math.abs(amount));
    }
  }

  // Thêm vào trong class BingXService

  /**
   * Lấy giá hiện tại của Symbol để quy đổi
   */
  async getTickerPrice(symbol: string): Promise<number> {
    const res = await this.request("GET", "/openApi/swap/v2/quote/ticker", {
      symbol,
    });
    if (res && res.code === 0 && res.data) {
      return parseFloat(res.data.lastPrice);
    }
    return 0;
  }

  /**
   * Quy đổi từ số tiền USDT sang số lượng Coin (Quantity)
   * @param amount số tiền USDT (ví dụ 10 USDT)
   * @param symbol tên cặp tiền (BTC-USDT)
   */
  async amountToQty(amount: number, symbol: string): Promise<number> {
    const price = await this.getTickerPrice(symbol);
    if (price === 0) return 0;

    // Tính toán số lượng: Qty = Tiền / Giá
    const qty = amount / price;

    // BingX có quy định về số chữ số thập phân (Precision).
    // Ví dụ BTC thường lấy 3-4 số cuối. Để an toàn ta làm tròn xuống.
    return Math.floor(qty * 10000) / 10000;
  }

  /**
   * Lấy thông tin chi tiết các vị thế đang mở cho Symbol
   */
  async getPositionDetails(symbol?: string) {
    try {
      const params = symbol ? { symbol } : {};
      const res = await this.request(
        "GET",
        "/openApi/swap/v2/user/positions",
        params
      );

      console.log(res);

      if (!res || !res.data || !Array.isArray(res.data)) return [];

      return res.data
        .filter((pos: any) => Math.abs(parseFloat(pos.positionAmt)) > 0)
        .map((pos: any) => ({
          symbol: pos.symbol, // Thêm dòng này
          side: pos.positionSide,
          amount: Math.abs(parseFloat(pos.positionAmt)),
          notional: Math.abs(
            parseFloat(pos.positionAmt) * parseFloat(pos.avgPrice)
          ),
          entryPrice: parseFloat(pos.avgPrice),
          unrealizedProfit: parseFloat(pos.unrealizedProfit),
          leverage: pos.leverage,
        }));
    } catch (error) {
      console.error("Error fetching positions:", error);
      return [];
    }
  }

  // Tính toán xem hiện tại đang lệch (Skew) bao nhiêu so với ban đầu
  async getCurrentDcaLevel(
    symbol: string,
    initialQty: number
  ): Promise<number> {
    const positions = await this.getPositionDetails(symbol);
    if (positions.length < 2) return 0;

    const long = positions.find((p: any) => p.side === "LONG")?.amount || 0;
    const short = positions.find((p: any) => p.side === "SHORT")?.amount || 0;

    // Khoảng chênh lệch giữa 2 bên
    const diffQty = Math.abs(long - short);

    // Nếu chênh lệch bằng 0 hoặc rất nhỏ thì coi như chưa DCA (Level 0)
    if (diffQty < initialQty * 0.1) return 0;

    // Tính toán Level dựa trên công thức: dcaAmount = DCA_STEP * level
    // Ở đây ta có thể suy ngược từ diffQty
    const dcaStepQty = await this.amountToQty(
      CONFIG.DCA_STEP_VALUE_USDT,
      symbol
    );
    if (dcaStepQty <= 0) return 0;

    const level = Math.round(diffQty / dcaStepQty);
    return level;
  }
}
