import { useMemo } from "react";

export type TokenUsageDaily = {
  date: string;
  models: { model: string; tokens: number; estimated_cost_usd: number }[];
};

export type TokenUsageSession = {
  session_key: string;
  model: string;
  tokens_today: number;
  estimated_cost_usd: number;
  last_active: string;
};

export type TokenUsageApi = {
  generated_at_utc: string;
  kpis: {
    daily_tokens: number;
    estimated_daily_cost_usd: number;
    gemini_percent: number;
    openai_percent: number;
  };
  daily_by_model: TokenUsageDaily[];
  sessions_today: TokenUsageSession[];
  active_cron_jobs?: number;
};

// Cost per 1M tokens (input+output blended estimate)
const MODEL_COST_PER_M: Record<string, number> = {
  "gpt-5.2": 3.0,
  "gpt-5.3-codex": 3.0,
  "gpt-5-mini": 0.4,
  "gemini-2.5-flash": 0.025,
  "gemini-3-flash-preview": 0.025,
};

function estimateCost(model: string, tokens: number): number {
  const key = Object.keys(MODEL_COST_PER_M).find((k) =>
    model.toLowerCase().includes(k.toLowerCase())
  );
  const rate = key ? MODEL_COST_PER_M[key] : 2.0; // fallback
  return (tokens / 1_000_000) * rate;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function usd(n: number): string {
  if (n < 0.01 && n > 0) return "<$0.01";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Parse session keys into readable names and categories
type SessionCategory = "cron" | "discord" | "main" | "other";

function categorizeSession(key: string): {
  category: SessionCategory;
  label: string;
} {
  if (key === "agent:main:main") return { category: "main", label: "Main Session" };

  if (key.includes(":cron:")) {
    // Extract cron job UUID
    const match = key.match(/:cron:([a-f0-9-]+)/);
    const cronId = match ? match[1].slice(0, 8) : "unknown";
    const isRun = key.includes(":run:");
    return {
      category: "cron",
      label: isRun ? `Cron ${cronId} (subrun)` : `Cron ${cronId}`,
    };
  }

  if (key.includes(":discord:")) {
    if (key.includes(":direct:")) return { category: "discord", label: "Discord DM" };
    if (key.includes("heartbeat")) return { category: "discord", label: "Heartbeat Channel" };
    const chanMatch = key.match(/:channel:(\d+)/);
    const chanId = chanMatch ? chanMatch[1].slice(-6) : "unknown";
    return { category: "discord", label: `Discord #...${chanId}` };
  }

  return { category: "other", label: key.slice(0, 30) };
}

const CATEGORY_LABELS: Record<SessionCategory, string> = {
  cron: "Cron Jobs",
  discord: "Discord",
  main: "Main Session",
  other: "Other",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 12,
  padding: 16,
  background: "#111",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#b7b7bf",
  marginBottom: 6,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const bigValue: React.CSSProperties = {
  fontSize: "1.8rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
};

// ── Cost by Model table ──
function CostByModel({ sessions }: { sessions: TokenUsageSession[] }) {
  const models = useMemo(() => {
    const map = new Map<string, { tokens: number; cost: number }>();
    for (const s of sessions) {
      const prev = map.get(s.model) ?? { tokens: 0, cost: 0 };
      prev.tokens += s.tokens_today;
      prev.cost += estimateCost(s.model, s.tokens_today);
      map.set(s.model, prev);
    }
    return [...map.entries()]
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.cost - a.cost);
  }, [sessions]);

  const totalCost = models.reduce((s, m) => s + m.cost, 0);
  const totalTokens = models.reduce((s, m) => s + m.tokens, 0);

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
      <thead>
        <tr style={{ color: "#b7b7bf" }}>
          <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #222" }}>Model</th>
          <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>Tokens</th>
          <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>% of Total</th>
          <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>Est. Cost</th>
          <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>% of Cost</th>
        </tr>
      </thead>
      <tbody>
        {models.map((m) => (
          <tr key={m.model} style={{ borderTop: "1px solid #1a1a1a" }}>
            <td style={{ padding: "6px", fontWeight: 600 }}>{m.model}</td>
            <td style={{ padding: "6px", textAlign: "right" }}>{fmt(m.tokens)}</td>
            <td style={{ padding: "6px", textAlign: "right", color: "#b7b7bf" }}>
              {totalTokens ? ((m.tokens / totalTokens) * 100).toFixed(1) : 0}%
            </td>
            <td style={{ padding: "6px", textAlign: "right", color: m.cost > 1 ? "#e05252" : "#fff" }}>
              {usd(m.cost)}
            </td>
            <td style={{ padding: "6px", textAlign: "right", color: "#b7b7bf" }}>
              {totalCost ? ((m.cost / totalCost) * 100).toFixed(1) : 0}%
            </td>
          </tr>
        ))}
        <tr style={{ borderTop: "2px solid #333", fontWeight: 700 }}>
          <td style={{ padding: "8px 6px" }}>Total</td>
          <td style={{ padding: "8px 6px", textAlign: "right" }}>{fmt(totalTokens)}</td>
          <td style={{ padding: "8px 6px", textAlign: "right" }}>100%</td>
          <td style={{ padding: "8px 6px", textAlign: "right", color: "#e05252" }}>{usd(totalCost)}</td>
          <td style={{ padding: "8px 6px", textAlign: "right" }}>100%</td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Spend by Source (grouped by category) ──
function SpendBySource({ sessions }: { sessions: TokenUsageSession[] }) {
  const groups = useMemo(() => {
    const map = new Map<SessionCategory, { tokens: number; cost: number; count: number }>();
    for (const s of sessions) {
      const { category } = categorizeSession(s.session_key);
      const prev = map.get(category) ?? { tokens: 0, cost: 0, count: 0 };
      prev.tokens += s.tokens_today;
      prev.cost += estimateCost(s.model, s.tokens_today);
      prev.count += 1;
      map.set(category, prev);
    }
    return [...map.entries()]
      .map(([cat, v]) => ({ category: cat, label: CATEGORY_LABELS[cat], ...v }))
      .sort((a, b) => b.cost - a.cost);
  }, [sessions]);

  const totalCost = groups.reduce((s, g) => s + g.cost, 0);

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
      <thead>
        <tr style={{ color: "#b7b7bf" }}>
          <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #222" }}>Source</th>
          <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>Sessions</th>
          <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>Tokens</th>
          <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>Est. Cost</th>
          <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>% of Cost</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr key={g.category} style={{ borderTop: "1px solid #1a1a1a" }}>
            <td style={{ padding: "6px", fontWeight: 600 }}>{g.label}</td>
            <td style={{ padding: "6px", textAlign: "right" }}>{g.count}</td>
            <td style={{ padding: "6px", textAlign: "right" }}>{fmt(g.tokens)}</td>
            <td style={{ padding: "6px", textAlign: "right", color: g.cost > 1 ? "#e05252" : "#fff" }}>
              {usd(g.cost)}
            </td>
            <td style={{ padding: "6px", textAlign: "right", color: "#b7b7bf" }}>
              {totalCost ? ((g.cost / totalCost) * 100).toFixed(1) : 0}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Top Sessions table ──
function TopSessions({ sessions }: { sessions: TokenUsageSession[] }) {
  const rows = useMemo(() => {
    return sessions
      .map((s) => ({
        ...s,
        ...categorizeSession(s.session_key),
        estCost: estimateCost(s.model, s.tokens_today),
      }))
      .sort((a, b) => b.estCost - a.estCost)
      .slice(0, 20);
  }, [sessions]);

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
      <thead>
        <tr style={{ color: "#b7b7bf" }}>
          <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #222" }}>Session</th>
          <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #222" }}>Type</th>
          <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #222" }}>Model</th>
          <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>Tokens</th>
          <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>Est. Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.session_key} style={{ borderTop: "1px solid #1a1a1a" }}>
            <td style={{ padding: "6px" }}>{r.label}</td>
            <td style={{ padding: "6px", color: "#b7b7bf" }}>{r.category}</td>
            <td style={{ padding: "6px" }}>{r.model}</td>
            <td style={{ padding: "6px", textAlign: "right" }}>{fmt(r.tokens_today)}</td>
            <td style={{ padding: "6px", textAlign: "right", color: r.estCost > 0.5 ? "#e05252" : "#fff" }}>
              {usd(r.estCost)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Model split bar ──
function ModelSplitBar({ gemini, openai }: { gemini: number; openai: number }) {
  const g = Math.max(0, Math.min(100, gemini));
  const o = Math.max(0, Math.min(100, openai));
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
          fontSize: "0.85rem",
          color: "#b7b7bf",
        }}
      >
        <span style={{ color: "#1a8f5c" }}>Gemini {g.toFixed(1)}%</span>
        <span style={{ color: "#00338D" }}>OpenAI {o.toFixed(1)}%</span>
      </div>
      <div
        style={{
          display: "flex",
          borderRadius: 999,
          overflow: "hidden",
          height: 12,
          background: "#1a1a1a",
        }}
      >
        <div style={{ width: `${g}%`, background: "#1a8f5c" }} />
        <div style={{ width: `${o}%`, background: "#00338D" }} />
      </div>
    </div>
  );
}

// ── 7-day chart ──
function DailyChart({ rows }: { rows: TokenUsageDaily[] }) {
  const last7 = rows.slice(-7);
  const max = useMemo(
    () => Math.max(1, ...last7.map((r) => r.models.reduce((s, m) => s + m.tokens, 0))),
    [rows]
  );

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {last7.map((row) => {
        const total = row.models.reduce((s, m) => s + m.tokens, 0);
        const cost = row.models.reduce((s, m) => s + estimateCost(m.model, m.tokens), 0);
        return (
          <div
            key={row.date}
            style={{
              display: "grid",
              gridTemplateColumns: "64px 1fr 90px 70px",
              gap: 10,
              alignItems: "center",
              fontSize: "0.85rem",
            }}
          >
            <div style={{ color: "#b7b7bf" }}>{shortDate(row.date)}</div>
            <div
              style={{
                display: "flex",
                borderRadius: 999,
                overflow: "hidden",
                height: 12,
                background: "#1a1a1a",
              }}
            >
              {row.models.map((m) => {
                const width = total === 0 ? 0 : (m.tokens / max) * 100;
                const color = /gemini/i.test(m.model) ? "#1a8f5c" : "#00338D";
                return (
                  <div
                    key={m.model}
                    style={{ width: `${width}%`, background: color }}
                    title={`${m.model}: ${fmt(m.tokens)} (${usd(estimateCost(m.model, m.tokens))})`}
                  />
                );
              })}
            </div>
            <div style={{ textAlign: "right" }}>{fmt(total)}</div>
            <div style={{ textAlign: "right", color: cost > 5 ? "#e05252" : "#b7b7bf" }}>
              {usd(cost)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ──
export function TokenUsageTab({ data }: { data: TokenUsageApi }) {
  const totalCost = useMemo(
    () => data.sessions_today.reduce((s, r) => s + estimateCost(r.model, r.tokens_today), 0),
    [data.sessions_today]
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* KPI row */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <article style={cardStyle}>
          <div style={labelStyle}>Daily Tokens</div>
          <div style={bigValue}>{fmt(data.kpis.daily_tokens)}</div>
        </article>
        <article style={cardStyle}>
          <div style={labelStyle}>Est. Daily Cost</div>
          <div style={{ ...bigValue, color: totalCost > 5 ? "#e05252" : "#fff" }}>
            {usd(totalCost)}
          </div>
        </article>
        <article style={cardStyle}>
          <div style={labelStyle}>Model Split</div>
          <ModelSplitBar gemini={data.kpis.gemini_percent} openai={data.kpis.openai_percent} />
        </article>
        <article style={cardStyle}>
          <div style={labelStyle}>Active Cron Jobs</div>
          <div style={bigValue}>{data.active_cron_jobs ?? 0}</div>
        </article>
      </section>

      {/* Cost by Model */}
      <section style={{ ...cardStyle, padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "1rem" }}>Cost by Model</h3>
        <CostByModel sessions={data.sessions_today} />
      </section>

      {/* Spend by Source */}
      <section style={{ ...cardStyle, padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "1rem" }}>Spend by Source</h3>
        <SpendBySource sessions={data.sessions_today} />
      </section>

      {/* 7-day chart */}
      <section style={{ ...cardStyle, padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "1rem" }}>7-Day Usage + Cost</h3>
        <DailyChart rows={data.daily_by_model} />
      </section>

      {/* Top sessions */}
      <section style={{ ...cardStyle, padding: 16, overflow: "auto" }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "1rem" }}>Top 20 Sessions by Cost</h3>
        <TopSessions sessions={data.sessions_today} />
      </section>
    </div>
  );
}
