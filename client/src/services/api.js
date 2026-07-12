import axios from "axios";

// Single axios instance every service file imports — one place to configure
// the base URL and attach the JWT to every outgoing request.
// Note: kept as the server root (not /api) because App.jsx's health-check
// ping hits "/" directly — individual service files add the "/api/..." prefix.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
});

// Runs before every request. We store the JWT in localStorage after login
// (see auth.api.js) and attach it here so pages never have to remember to
// add the Authorization header themselves.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;