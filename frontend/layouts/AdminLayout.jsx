import { Link, Routes, Route } from "react-router-dom";
import Dashboard from "../admin/Dashboard";
import ProductManage from "../admin/ProductManage";
import UserManage from "../admin/UserManage";

export default function AdminLayout() {
  return (
    <div>
      <aside>
        <Link to="">Dashboard</Link><br/>
        <Link to="products">Products</Link><br/>
        <Link to="users">Users</Link>
      </aside>

      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<ProductManage />} />
        <Route path="users" element={<UserManage />} />
      </Routes>
    </div>
  );
}
