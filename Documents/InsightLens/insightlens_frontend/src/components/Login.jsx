import { useState } from "react";
import API from "../services/api";

export default function Login({ onLogin }) {

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {

    if (e?.preventDefault) e.preventDefault();
    setError("");
    setIsLoading(true);

    try{

      const res = await API.post("/auth/login",{
        email: email.trim(),
        password
      });

      localStorage.setItem("token",res.data.token);

      onLogin();

    }catch(err){
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }

  };

  return (

    <div className="card-body">

      <h2 className="card-title">Welcome back</h2>
      <p className="card-subtitle">Log in to analyze brand sentiment and save reports.</p>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <form className="form" onSubmit={handleLogin}>
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
            placeholder="********"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </div>
      </form>

    </div>

  );

};
