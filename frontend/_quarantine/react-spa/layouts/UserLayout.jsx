import { AppBar, Toolbar, Button, Box } from "@mui/material";
import { Outlet, Link } from "react-router-dom";

export default function UserLayout() {
  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Box sx={{ flexGrow: 1 }}>
            BeautyCare
          </Box>
          <Button color="inherit" component={Link} to="/">
            Trang chủ
          </Button>
          <Button color="inherit" component={Link} to="/products">
            Sản phẩm
          </Button>
          <Button color="inherit" component={Link} to="/cart">
            Giỏ hàng
          </Button>
          <Button color="inherit" component={Link} to="/profile">
            Tài khoản
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </>
  );
}
