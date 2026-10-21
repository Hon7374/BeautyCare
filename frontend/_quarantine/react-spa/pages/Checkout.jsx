import { createVNPay } from "../api/paymentApi";

export default function Checkout() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const user = JSON.parse(localStorage.getItem("user"));

  const discount =
    user?.member === "vip" ? 0.2 :
    user?.member === "gold" ? 0.1 : 0;

  const total = cart.reduce(
    (sum, p) => sum + p.price * p.quantity, 0
  );

  const finalAmount = Math.round(total * (1 - discount));

  const handleVNPay = async () => {
    const res = await createVNPay(finalAmount);
    window.location.href = res.data.paymentUrl;
  };

  return (
    <div>
      <h2>Thanh toán</h2>
      <p>Tổng tiền: {total}₫</p>
      <p>Giảm giá: {discount * 100}%</p>
      <h3>Thanh toán: {finalAmount}₫</h3>

      <button onClick={handleVNPay}>
        Thanh toán VNPay
      </button>
    </div>
  );
}
