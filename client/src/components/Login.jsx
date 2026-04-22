import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router";
import { Link } from "react-router";

// Login screen: exchanges credentials for token via AuthContext.
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState(null);

  // Read form values and attempt login.
  const tryLogin = async (formData) => {
    setError(null);

    const username = formData.get("username");
    const password = formData.get("password");
    try {
      await login({ username, password });
      navigate('/')
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <main className="page auth-page">
      <h1 className="page-title">Log in to your account</h1>
      <form
        className="auth-form"
        onSubmit={(e)=>{
          e.preventDefault()
          tryLogin(new FormData(e.target))
        }}
      >
        <label className="form-group">
          Username
          <input type="username" name="username" required />
        </label>
        <label className="form-group">
          Password
          <input type="password" name="password" required />
        </label>
        <button type="submit" className="btn btn-primary">Login</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
      <p className="auth-footer"><Link to="/register">Need an account? Register here.</Link></p>
    </main>
  );
}