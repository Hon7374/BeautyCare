import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../auth/Login";
import Home from "../pages/Home";
import Products from "../pages/Products";
import Profile from "../pages/Profile";
import AdminLayout from "../layouts/AdminLayout";
import UserLayout from "../layouts/UserLayout";

const RequireAuth = ({ role, children }) => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
};

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<UserLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/payment-result" element={<PaymentResult />} />
      </Route>

      <Route
        path="/admin/*"
        element={
          <RequireAuth role="admin">
            <AdminLayout />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
