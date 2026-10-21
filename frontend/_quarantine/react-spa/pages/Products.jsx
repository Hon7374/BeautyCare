import { useEffect, useState } from "react";
import { getProducts } from "../api/productApi";

export default function Products() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    getProducts().then(res => setProducts(res.data));
  }, []);

  return (
    <div>
      <h2>Sản phẩm</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
        {products.map(p => (
          <div key={p.id} style={{ border: "1px solid #ccc", padding: 10 }}>
            <h4>{p.name}</h4>
            <p>Giá: {p.price}₫</p>
            <button
              onClick={() => {
                const cart = JSON.parse(localStorage.getItem("cart")) || [];
                cart.push({ ...p, quantity: 1 });
                localStorage.setItem("cart", JSON.stringify(cart));
                alert("Đã thêm vào giỏ");
              }}
            >
              Thêm giỏ
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
