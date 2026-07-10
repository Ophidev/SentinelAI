import { createContext, useContext, useState } from "react";
import { loginUser as loginRequest, registerUser as registerRequest } from "../services/auth.api";

// A plain React Context, not Redux. This project's global state is small
// (just "who is logged in"), so a Context is enough and keeps the code
// simpler to read/explain — Redux Toolkit would be reached for once state
// gets bigger/more shared (e.g. a real-time dashboard with many subscribers).
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialize from localStorage so a page refresh doesn't log the user out.
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (email, password) => {
    const data = await loginRequest(email, password);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const register = async (name, email, password) => {
    await registerRequest(name, email, password);
    // Registration doesn't return a token in this backend, so we log in
    // right after to get one — keeps the "register then land on dashboard" UX.
    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook so pages just do `const { user, login } = useAuth()`.
export function useAuth() {
  return useContext(AuthContext);
}
