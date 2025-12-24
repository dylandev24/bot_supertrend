import { BingXService } from "./services/bingX.service";

const bingx = new BingXService();

async function check() {
  console.log("⏳ Đang kiểm tra số dư Futures...");
  const res = await bingx.getBalance();

  console.log(res);
  // if (res && res.code === 0) {
  //   console.log("✅ Kết nối thành công!");
  //   console.log("Dữ liệu ví:", res.data);
  // } else {
  //   console.log(
  //     "❌ Thất bại. Kiểm tra lại API Key và quyền Perpetual Futures."
  //   );
  //   console.log("Phản hồi từ sàn:", res);
  // }
}

check();
