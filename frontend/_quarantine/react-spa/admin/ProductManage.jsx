import { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";

export default function ProductManage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    axiosClient.get("/products").then(res => setProducts(res.data));
  }, []);

  return (
    <div>
      <h2>Quản lý sản phẩm</h2>
      {products.map(p => (
        <div key={p.id}>
          {p.name} - {p.price}₫
        </div>
      ))}
    </div>
  );
}
