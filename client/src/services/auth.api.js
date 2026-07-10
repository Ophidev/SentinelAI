import api from "./api";

// Each function here maps 1:1 to a backend route — keeps pages simple,
// they just call `login(email, password)` and don't know about axios/URLs.
export const registerUser = (name, email, password) =>
  api.post("/api/auth/register", { name, email, password }).then((res) => res.data);

export const loginUser = (email, password) =>
  api.post("/api/auth/login", { email, password }).then((res) => res.data);

export const getProfile = () => api.get("/api/auth/profile").then((res) => res.data);
