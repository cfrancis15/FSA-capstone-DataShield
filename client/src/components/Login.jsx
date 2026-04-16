import { useState } from "react";
import { useAuth } from "../context/AuthContext";
// WHY (Code Style): useNavigate and Link both come from 'react-router', so combining
// them into one import keeps the import list readable and avoids duplicate module lines.
import { useNavigate, Link } from "react-router";

/** A form that allows users to log into an existing account. */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState(null);

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
          {/* WHY (Functionality): 'username' is not a valid HTML input type. Using type="text"
               ensures browsers apply correct autocomplete, accessibility labeling, and
               keyboard behavior. An invalid type can silently break autofill on some browsers. */}
          <input type="text" name="username" required />
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