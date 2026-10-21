import { useContext, useState } from "react";
import axiosClient from "../api/axiosClient";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async () => {
    const res = await axiosClient.post("/auth/login", { email, password });
    login(res.data);
    navigate(res.data.user.role === "admin" ? "/admin" : "/");
  };

  return (
    <div>
      <h2>Đăng nhập</h2>
      <input placeholder="Email hoặc số điện thoại" onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Mật khẩu" onChange={e => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Đăng nhập</button>
    </div>
  );
}
