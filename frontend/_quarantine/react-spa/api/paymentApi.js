import axiosClient from "./axiosClient";

export const createVNPay = (amount) => {
  return axiosClient.post("/payment/create-vnpay", {
    amount,
    orderInfo: "Thanh toán đơn hàng BeautyCare"
  });
};
