import { useLocation } from "react-router-dom";

export default function PaymentResult() {
  const query = new URLSearchParams(useLocation().search);
  const status = query.get("vnp_ResponseCode");

  return (
    <div>
      {status === "00" ? (
        <h2>✅ Thanh toán thành công</h2>
      ) : (
        <h2>❌ Thanh toán thất bại</h2>
      )}
    </div>
  );
}
