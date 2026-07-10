import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function Login() {
  // Local component state for the two form fields — no need for anything
  // heavier than useState for a two-field form.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); // stop the browser's default full-page-reload form submit
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard"); // on success, go to the projects/dashboard page
    } catch (err) {
      // The backend sends { success:false, message } on bad credentials.
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-gray-900 p-8 rounded-lg space-y-4">
        <h1 className="text-2xl font-bold">SentinelAI Login</h1>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="text-sm text-gray-400">
          No account? <Link to="/register" className="text-blue-400">Register</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
