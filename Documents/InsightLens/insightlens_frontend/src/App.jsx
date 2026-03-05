import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Signup from "./components/Signup";
import "./App.css";

function App() {

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState('login');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    setView("login");
  };

  if (isLoggedIn) {
    return <Dashboard onLogout={handleLogout} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">IL</div>
            <div>
              <div className="brand-name">InsightLens</div>
              <div className="brand-tagline">See what the world thinks about your brand</div>
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        <div className="card auth-card">
          <div className="tabs" role="tablist" aria-label="Authentication">
            <button
              className={view === "login" ? "tab tab-active" : "tab"}
              onClick={() => setView("login")}
              type="button"
            >
              Login
            </button>
            <button
              className={view === "signup" ? "tab tab-active" : "tab"}
              onClick={() => setView("signup")}
              type="button"
            >
              Signup
            </button>
          </div>

          {view === "login" ? (
            <Login onLogin={() => setIsLoggedIn(true)} />
          ) : (
            <Signup onGoToLogin={() => setView("login")} />
          )}
        </div>
      </main>
    </div>
  );

}

export default App;