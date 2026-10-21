import axiosClient from "./axiosClient";

export const createOrder = (order) =>
  axiosClient.post("/orders", order);
