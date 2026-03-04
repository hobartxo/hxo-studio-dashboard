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

function number(n: number): string {
  return n.toLocaleString("en-US");
}

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function shortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #222",
  borderRadius: 16,
  padding: 16,
  background: "#111",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "#b7b7bf",
  marginBottom: 8,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const valueStyle: React.CSSProperties = {
  fontSize: "2rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  lineHeight: 1.1,
};

function ModelSplitBar({ gemini, openai }: { gemini: number; openai: number }) {
  const g = Math.max(0, Math.min(100, gemini));
  const o = Math.max(0, Math.min(100, openai));
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
          fontSize: "0.85rem",
          color: "#b7b7bf",
        }}
      >
        <span>Gemini {g.toFixed(1)}%</span>
        <span>OpenAI {o.toFixed(1)}%</span>
      </div>
      <div
        style={{
          display: "flex",
          borderRadius: 999,
          overflow: "hidden",
          height: 12,
          background: "#1a1a1a",
          border: "1px solid #222",
        }}
      >
        <div style={{ width: `${g}%`, background: "#1a8f5c" }} />
        <div style={{ width: `${o}%`, background: "#002244" }} />
      </div>
    </div>
  );
}

function DailyUsageMiniBars({ rows }: { rows: TokenUsageDaily[] }) {
  const last5 = rows.slice(-5);
  const totals = last5.map((r) => r.models.reduce((s, m) => s + m.tokens, 0));
  const max = Math.max(1, ...totals);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {last5.map((row) => {
        const total = row.models.reduce((s, m) => s + m.tokens, 0);
        const pct = (total / max) * 100;
        return (
          <div
            key={row.date}
            style={{
              display: "grid",
              gridTemplateColumns: "64px 1fr 84px",
              gap: 12,
              alignItems: "center",
              fontSize: "0.9rem",
            }}
          >
            <div style={{ color: "#b7b7bf" }}>{shortDate(row.date)}</div>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                overflow: "hidden",
                background: "#1a1a1a",
                border: "1px solid #222",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: "#002244",
                }}
              />
            </div>
            <div style={{ textAlign: "right", color: "#b7b7bf" }}>{number(total)}</div>
          </div>
        );
      })}
    </div>
  );
}

function TokensByModelBars({ rows }: { rows: TokenUsageDaily[] }) {
  const last7 = rows.slice(-7);
  const max = useMemo(
    () =>
      Math.max(
        1,
        ...last7.map((r) => r.models.reduce((s, m) => s + m.tokens, 0))
      ),
    [rows]
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {last7.map((row) => {
        const total = row.models.reduce((s, m) => s + m.tokens, 0);
        return (
          <div
            key={row.date}
            style={{
              display: "grid",
              gridTemplateColumns: "74px 1fr 100px",
              gap: 10,
              alignItems: "center",
              fontSize: "0.9rem",
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
                border: "1px solid #222",
              }}
            >
              {row.models.map((m) => {
                const width = total === 0 ? 0 : (m.tokens / max) * 100;
                const color = /gemini/i.test(m.model) ? "#1a8f5c" : "#002244";
                return (
                  <div
                    key={m.model}
                    style={{ width: `${width}%`, background: color }}
                    title={`${m.model}: ${number(m.tokens)}`}
                  />
                );
              })}
            </div>
            <div style={{ textAlign: "right" }}>{number(total)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function TokenUsageTab({ data }: { data: TokenUsageApi }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Row 1: two hero cards */}
      <section className="grid-2">
        <article style={{ ...cardStyle, minHeight: 220 }}>
          <div style={labelStyle}>Context Savings This Week</div>
          <div style={valueStyle}>—</div>
          <p style={{ marginTop: 10, color: "#b7b7bf", fontSize: "0.95rem", lineHeight: 1.4 }}>
            Wire this to your pipeline: estimate saved tokens from context trimming,
            cached instructions, and tool routing.
          </p>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Top improvements</div>
            <ul style={{ marginLeft: 18, color: "#b7b7bf", display: "grid", gap: 6 }}>
              <li>AGENTS.md instruction scoping</li>
              <li>Memory file pruning</li>
              <li>Tool call consolidation</li>
              <li>Prompt header normalization</li>
              <li>Session routing hygiene</li>
            </ul>
          </div>
        </article>

        <article style={{ ...cardStyle, minHeight: 220 }}>
          <div style={labelStyle}>Daily Token Usage</div>
          <div style={valueStyle}>{number(data.kpis.daily_tokens)}</div>
          <div style={{ marginTop: 10, color: "#b7b7bf", fontSize: "0.95rem" }}>
            Est. daily cost:{" "}
            <span style={{ color: "#ffffff", fontWeight: 700 }}>
              {usd(data.kpis.estimated_daily_cost_usd)}
            </span>
          </div>
          <div style={{ marginTop: 14 }}>
            <DailyUsageMiniBars rows={data.daily_by_model} />
          </div>
        </article>
      </section>

      {/* Row 2: three KPI cards */}
      <section className="grid-3">
        <article style={cardStyle}>
          <div style={labelStyle}>Model Split</div>
          <ModelSplitBar gemini={data.kpis.gemini_percent} openai={data.kpis.openai_percent} />
        </article>

        <article style={cardStyle}>
          <div style={labelStyle}>Active Cron Jobs</div>
          <div style={{ ...valueStyle, fontSize: "1.8rem" }}>{data.active_cron_jobs ?? 0}</div>
          <div style={{ marginTop: 8, color: "#b7b7bf", fontSize: "0.9rem" }}>
            Scheduled automations currently enabled.
          </div>
        </article>

        <article style={cardStyle}>
          <div style={labelStyle}>Boot Tokens / Session</div>
          <div style={{ ...valueStyle, fontSize: "1.8rem" }}>—</div>
          <div style={{ marginTop: 8, color: "#b7b7bf", fontSize: "0.9rem" }}>
            Add to the API if you want startup overhead tracking.
          </div>
        </article>
      </section>

      {/* Row 3: chart */}
      <section style={{ ...cardStyle, padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "1rem" }}>7-Day Tokens by Model</h3>
        <TokensByModelBars rows={data.daily_by_model} />
      </section>

      {/* Row 4: table */}
      <section style={{ ...cardStyle, padding: 16, overflow: "auto" }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "1rem" }}>Session Breakdown (Today)</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ color: "#b7b7bf" }}>
              <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #222" }}>Session Key</th>
              <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #222" }}>Model</th>
              <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>Tokens Today</th>
              <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>Est. Cost</th>
              <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #222" }}>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {data.sessions_today.slice(0, 100).map((row) => (
              <tr key={row.session_key} style={{ borderTop: "1px solid #1a1a1a" }}>
                <td style={{ padding: "6px", color: "#b7b7bf", fontFamily: "monospace", fontSize: "0.78rem" }}>{row.session_key}</td>
                <td style={{ padding: "6px" }}>{row.model}</td>
                <td style={{ padding: "6px", textAlign: "right" }}>{number(row.tokens_today)}</td>
                <td style={{ padding: "6px", textAlign: "right" }}>{usd(row.estimated_cost_usd)}</td>
                <td style={{ padding: "6px", color: "#b7b7bf" }}>{new Date(row.last_active).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
