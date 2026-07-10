import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppRouter from "./routes/AppRouter";

function App() {
  return (
    // AuthProvider makes useAuth() available to every page.
    // BrowserRouter enables client-side navigation (no full page reloads).
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
