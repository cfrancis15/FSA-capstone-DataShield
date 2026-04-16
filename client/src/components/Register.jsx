import { useState } from "react";
import { useAuth } from "../context/AuthContext";
// WHY (Code Style): useNavigate and Link both come from 'react-router', so combining
// them into one import keeps the import list readable and avoids duplicate module lines.
import { useNavigate, Link } from "react-router";

/** A form that allows users to register for a new account */
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate()

  const [error, setError] = useState(null);

  const tryRegister = async (formData) => {
    setError(null);

    const username = formData.get("username");
    const password = formData.get("password");
    try {
      await register({username, password });
      navigate('/');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <main className="page auth-page">
      <h1 className="page-title">Register for an account</h1>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          tryRegister(new FormData(e.target));
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
        <button type="submit" className="btn btn-primary">Register</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
      <p className="auth-footer"><Link to="/login">Already have an account? Log in here.</Link></p>
    </main>
  );
}
