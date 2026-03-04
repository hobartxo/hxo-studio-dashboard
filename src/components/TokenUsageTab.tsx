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
  const rate = key ? MODEL_COST_PER_M[key] : 2.0;
  return (tokens / 1_000_000) * rate;
}

// Known cron job names — maps UUID prefix to human name
const CRON_NAMES: Record<string, string> = {
  "718b0c5f": "heartbeat",
  "bc7f3d13": "standup",
  "23630f4c": "consolidation",
  "1b455d63": "weekly-review",
  "339d2c77": "research-digest",
  "bc361e6a": "gcp-auth-check",
  "e9791639": "token-usage-collector",
};

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

// ── Session parsing ──

type SourceGroup = {
  key: string;
  label: string;
  category: "cron" | "discord" | "main" | "other";
  models: Map<string, number>; // model → tokens
  tokens: number;
  cost: number;
  sessions: number;
};

function getCronId(sessionKey: string): string | null {
  const match = sessionKey.match(/:cron:([a-f0-9-]+)/);
  return match ? match[1] : null;
}

function getCronName(cronUuid: string): string {
  const prefix = cronUuid.slice(0, 8);
  return CRON_NAMES[prefix] ?? prefix;
}

function buildSourceGroups(sessions: TokenUsageSession[]): SourceGroup[] {
  const map = new Map<string, SourceGroup>();

  for (const s of sessions) {
    let key: string;
    let label: string;
    let category: SourceGroup["category"];

    if (s.session_key === "agent:main:main") {
      key = "main";
      label = "Main Session";
      category = "main";
    } else if (s.session_key.includes(":cron:")) {
      const cronUuid = getCronId(s.session_key)!;
      const name = getCronName(cronUuid);
      key = `cron:${name}`;
      label = name;
      category = "cron";
    } else if (s.session_key.includes(":discord:")) {
      if (s.session_key.includes(":direct:")) {
        key = "discord:dm";
        label = "Discord DMs";
      } else if (s.session_key.includes("heartbeat")) {
        key = "discord:heartbeat";
        label = "Heartbeat Channel";
      } else {
        const chanMatch = s.session_key.match(/:channel:(\d+)/);
        const chanId = chanMatch ? chanMatch[1] : "unknown";
        key = `discord:${chanId}`;
        label = `Channel ...${chanId.slice(-6)}`;
      }
      category = "discord";
    } else {
      key = `other:${s.session_key.slice(0, 20)}`;
      label = s.session_key.slice(0, 30);
      category = "other";
    }

    const prev = map.get(key) ?? {
      key,
      label,
      category,
      models: new Map(),
      tokens: 0,
      cost: 0,
      sessions: 0,
    };
    prev.tokens += s.tokens_today;
    prev.cost += estimateCost(s.model, s.tokens_today);
    prev.sessions += 1;
    prev.models.set(s.model, (prev.models.get(s.model) ?? 0) + s.tokens_today);
    map.set(key, prev);
  }

  return [...map.values()].sort((a, b) => b.cost - a.cost);
}

function modelsString(models: Map<string, number>): string {
  return [...models.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m, t]) => `${m} (${fmt(t)})`)
    .join(", ");
}

// ── Styles ──

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

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 6px",
  borderBottom: "1px solid #222",
};

const thRight: React.CSSProperties = { ...thStyle, textAlign: "right" };

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
          <th style={thStyle}>Model</th>
          <th style={thRight}>Tokens</th>
          <th style={thRight}>%</th>
          <th style={thRight}>Est. Cost</th>
          <th style={thRight}>% of Cost</th>
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

// ── Spend by Source with subcategories ──
function SpendBySource({ sessions }: { sessions: TokenUsageSession[] }) {
  const groups = useMemo(() => buildSourceGroups(sessions), [sessions]);
  const totalCost = groups.reduce((s, g) => s + g.cost, 0);

  // Group by category for collapsible sections
  const categories: SourceGroup["category"][] = ["cron", "discord", "main", "other"];
  const byCategory = new Map<string, SourceGroup[]>();
  for (const cat of categories) {
    const items = groups.filter((g) => g.category === cat);
    if (items.length) byCategory.set(cat, items);
  }

  const categoryLabels: Record<string, string> = {
    cron: "Cron Jobs",
    discord: "Discord",
    main: "Main Session",
    other: "Other",
  };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
      <thead>
        <tr style={{ color: "#b7b7bf" }}>
          <th style={thStyle}>Source</th>
          <th style={thRight}>Sessions</th>
          <th style={thStyle}>Models</th>
          <th style={thRight}>Tokens</th>
          <th style={thRight}>Est. Cost</th>
          <th style={thRight}>%</th>
        </tr>
      </thead>
      <tbody>
        {[...byCategory.entries()].map(([cat, items]) => {
          const catTokens = items.reduce((s, i) => s + i.tokens, 0);
          const catCost = items.reduce((s, i) => s + i.cost, 0);
          const catSessions = items.reduce((s, i) => s + i.sessions, 0);
          return (
            <Fragment key={cat}>
              {/* Category header row */}
              <tr style={{ borderTop: "2px solid #333", background: "#0d0d0d" }}>
                <td style={{ padding: "10px 6px", fontWeight: 700, fontSize: "0.9rem" }} colSpan={1}>
                  {categoryLabels[cat]}
                </td>
                <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700 }}>{catSessions}</td>
                <td style={{ padding: "10px 6px" }} />
                <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700 }}>{fmt(catTokens)}</td>
                <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700, color: catCost > 1 ? "#e05252" : "#fff" }}>
                  {usd(catCost)}
                </td>
                <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700, color: "#b7b7bf" }}>
                  {totalCost ? ((catCost / totalCost) * 100).toFixed(1) : 0}%
                </td>
              </tr>
              {/* Individual items */}
              {items.map((item) => (
                <tr key={item.key} style={{ borderTop: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "6px 6px 6px 20px", color: "#b7b7bf" }}>{item.label}</td>
                  <td style={{ padding: "6px", textAlign: "right", color: "#b7b7bf" }}>{item.sessions}</td>
                  <td style={{ padding: "6px", fontSize: "0.78rem", color: "#888" }}>{modelsString(item.models)}</td>
                  <td style={{ padding: "6px", textAlign: "right" }}>{fmt(item.tokens)}</td>
                  <td style={{ padding: "6px", textAlign: "right", color: item.cost > 0.5 ? "#e05252" : "#fff" }}>
                    {usd(item.cost)}
                  </td>
                  <td style={{ padding: "6px", textAlign: "right", color: "#b7b7bf" }}>
                    {totalCost ? ((item.cost / totalCost) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </Fragment>
          );
        })}
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

// Need Fragment for grouped rows
import { Fragment } from "react";

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

      {/* Spend by Source — with subcategories */}
      <section style={{ ...cardStyle, padding: 16, overflow: "auto" }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "1rem" }}>Spend by Source</h3>
        <SpendBySource sessions={data.sessions_today} />
      </section>

      {/* 7-day chart */}
      <section style={{ ...cardStyle, padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "1rem" }}>7-Day Usage + Cost</h3>
        <DailyChart rows={data.daily_by_model} />
      </section>
    </div>
  );
}
