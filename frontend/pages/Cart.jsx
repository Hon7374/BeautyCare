export default function Cart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const user = JSON.parse(localStorage.getItem("user"));

  const discount = user?.member === "vip" ? 0.2 :
                   user?.member === "gold" ? 0.1 : 0;

  const total = cart.reduce(
    (sum, p) => sum + p.price * p.quantity, 0
  );

  const finalPrice = total * (1 - discount);

  return (
    <div>
      <h2>Giỏ hàng</h2>
      {cart.map((p, i) => (
        <div key={i}>
          {p.name} x {p.quantity} = {p.price * p.quantity}₫
        </div>
      ))}
      <hr />
      <p>Tạm tính: {total}₫</p>
      <p>Giảm giá: {discount * 100}%</p>
      <h3>Thanh toán: {finalPrice}₫</h3>
    </div>
  );
}
