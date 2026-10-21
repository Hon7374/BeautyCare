import axiosClient from "./axiosClient";

export const getProducts = () => axiosClient.get("/products");
export const getProductById = (id) => axiosClient.get(`/products/${id}`);
