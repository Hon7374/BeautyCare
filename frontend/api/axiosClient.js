import axios from "axios";

const axiosClient = axios.create({
  baseURL: `http://${window.location.hostname || 'localhost'}:3000/api`,
  withCredentials: true,
});

// Cookie-based auth: CSRF header is added by callers (or use fetch wrapper in /js/api.js).

export default axiosClient;
