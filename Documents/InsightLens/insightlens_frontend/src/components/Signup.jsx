import { useState } from "react";
import API from "../services/api";

export default function Signup({ onGoToLogin }) {

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e) => {

    if (e?.preventDefault) e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try{
      await API.post("/auth/register",{
        email: email.trim(),
        password
      });

      setSuccess("Registration successful. Please log in.");
      if (onGoToLogin) onGoToLogin();

    }catch(err){
      setError(err.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }

  };

  return (

    <div className="card-body">

      <h2 className="card-title">Create your account</h2>
      <p className="card-subtitle">Sign up to start generating brand insights.</p>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert">{success}</div> : null}

      <form className="form" onSubmit={handleSignup}>
        <div className="field">
          <div className="label">Email</div>
          <input
            className="input"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="field">
          <div className="label">Password</div>
          <input
            className="input"
            type="password"
            placeholder="Create a strong password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create account"}
          </button>
        </div>
      </form>

    </div>
  );

};
