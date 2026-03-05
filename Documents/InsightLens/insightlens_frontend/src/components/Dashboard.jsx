import { useState } from "react";
import API from "../services/api";

// chart.js integration
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
ChartJS.register(ArcElement, Tooltip, Legend);

export default function Dashboard({ onLogout }) {

  const [brand, setBrand] = useState("");
  const [posts, setPosts] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const analyze = async () => {

    try {
      setError("");
      setIsLoading(true);

      const postArray = posts
        .split("\n")
        .map((post) => post.trim())
        .filter(Boolean);

      const res = await API.post("/sentiment/analyze", {
        brand: brand.trim(),
        posts: postArray,
      });

      setResult(res.data);
    } catch (err) {
      console.error("Analysis failed:", err);
      const status = err.response?.status;
      if (status === 429) {
        setError("Rate limit reached. Please wait 30-60 seconds and try again.");
      } else if (status === 503) {
        setError("Model is busy/loading. Please try again in a moment.");
      } else {
        setError(err.response?.data?.error || err.message || "Analysis failed");
      }
    } finally {
      setIsLoading(false);
    }

  };

  return (

    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">IL</div>
            <div>
              <div className="brand-name">InsightLens</div>
              <div className="brand-tagline">Brand sentiment analysis dashboard</div>
            </div>
          </div>

          <button className="btn btn-secondary" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="container">
        <div className="grid-2">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title">Analyze sentiment</h2>
              <p className="card-subtitle">Paste social posts (one per line). We'll summarize themes and recommendations.</p>

              {error ? <div className="alert alert-error">{error}</div> : null}

              <div className="form">
                <div className="field">
                  <div className="label">Brand name</div>
                  <input
                    className="input"
                    placeholder="e.g. Tesla"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>

                <div className="field">
                  <div className="label">Posts</div>
                  <textarea
                    className="textarea"
                    placeholder="Enter posts (one per line)"
                    rows="10"
                    value={posts}
                    onChange={(e) => setPosts(e.target.value)}
                  />
                </div>

                <div className="actions">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={analyze}
                    disabled={isLoading || !brand.trim() || !posts.trim()}
                  >
                    {isLoading ? "Analyzing..." : "Analyze sentiment"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 className="card-title">Results</h2>
              <p className="card-subtitle">Your latest analysis will show here.</p>

              {!result ? (
                <div className="alert">Run an analysis to see results.</div>
              ) : (
                <div style={{ display: "grid", gap: 14, textAlign: "left" }}>
                  <div>
                    <div className="label">Overall sentiment</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{result.overall_sentiment}</div>
                    {(() => {
                      const b = result.sentiment_breakdown || {};
                      const total = (b.positive || 0) + (b.neutral || 0) + (b.negative || 0);
                      if (!total) return null;
                      return (
                        <div style={{ maxWidth: 300, marginTop: 12 }}>
                          <Pie
                            data={{
                              labels: ["Positive", "Neutral", "Negative"],
                              datasets: [
                                {
                                  data: [
                                    b.positive || 0,
                                    b.neutral || 0,
                                    b.negative || 0,
                                  ],
                                  backgroundColor: ["#4caf50", "#ffca28", "#f44336"],
                                },
                              ],
                            }}
                            options={{
                              plugins: { legend: { position: "bottom" } },
                            }}
                          />
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <div className="label">Themes</div>
                    <div style={{ marginTop: 6 }}>
                      {Array.isArray(result.key_themes) && result.key_themes.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {result.key_themes.map((t, i) => (<li key={i}>{t}</li>))}
                        </ul>
                      ) : (
                        <div className="alert">No themes returned.</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="label">Recommendations</div>
                    <div style={{ marginTop: 6 }}>
                      {Array.isArray(result.pr_recommendations) && result.pr_recommendations.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {result.pr_recommendations.map((r, i) => (<li key={i}>{r}</li>))}
                        </ul>
                      ) : (
                        <div className="alert">No recommendations returned.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>

  );

}
