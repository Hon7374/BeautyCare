// App.jsx
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppRouter from "./router/AppRouter";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}
