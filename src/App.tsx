import { useEffect, useState } from "react";
import { TokenUsageTab } from "./components/TokenUsageTab";
import { BusinessMetricsTab } from "./components/BusinessMetricsTab";
import type { TokenUsageApi } from "./components/TokenUsageTab";

type Tab = "token-usage" | "business-metrics";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("token-usage");
  const [data, setData] = useState<TokenUsageApi | null>(null);

  useEffect(() => {
    fetch("/token-usage-api.json")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>HXO Studio Dashboard</h1>
        {data && (
          <span className="last-updated">
            Last updated:{" "}
            {new Date(data.generated_at_utc).toLocaleString()}
          </span>
        )}
      </header>

      <nav className="tabs">
        <button
          className={`tab-button ${activeTab === "token-usage" ? "active" : ""}`}
          onClick={() => setActiveTab("token-usage")}
        >
          Token Usage
        </button>
        <button
          className={`tab-button ${activeTab === "business-metrics" ? "active" : ""}`}
          onClick={() => setActiveTab("business-metrics")}
        >
          Business Metrics
        </button>
      </nav>

      <main className="tab-content">
        {activeTab === "token-usage" && data && <TokenUsageTab data={data} />}
        {activeTab === "token-usage" && !data && (
          <p style={{ color: "#b7b7bf" }}>Loading token data...</p>
        )}
        {activeTab === "business-metrics" && <BusinessMetricsTab />}
      </main>
    </div>
  );
}

export default App;
