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
  borderRadius: 12,
  padding: 12,
  background: "#111",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#b7b7bf",
  marginBottom: 6,
};

const valueStyle: React.CSSProperties = {
  fontSize: "1.4rem",
  fontWeight: 600,
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
          marginBottom: 8,
          fontSize: "0.85rem",
        }}
      >
        <span>Gemini {g.toFixed(1)}%</span>
        <span>OpenAI {o.toFixed(1)}%</span>
      </div>
      <div
        style={{
          display: "flex",
          borderRadius: 10,
          overflow: "hidden",
          height: 14,
          background: "#1a1a1a",
        }}
      >
        <div style={{ width: `${g}%`, background: "#1a8f5c" }} />
        <div style={{ width: `${o}%`, background: "#00338D" }} />
      </div>
    </div>
  );
}

function DailyByModelChart({ rows }: { rows: TokenUsageDaily[] }) {
  const max = useMemo(
    () => Math.max(1, ...rows.map((r) => r.models.reduce((s, m) => s + m.tokens, 0))),
    [rows]
  );
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.slice(-7).map((row) => {
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
                borderRadius: 8,
                overflow: "hidden",
                height: 14,
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
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <article style={cardStyle}>
          <div style={labelStyle}>Daily Token Usage</div>
          <strong style={valueStyle}>{number(data.kpis.daily_tokens)}</strong>
        </article>
        <article style={cardStyle}>
          <div style={labelStyle}>Est. Daily Cost</div>
          <strong style={valueStyle}>
            {usd(data.kpis.estimated_daily_cost_usd)}
          </strong>
        </article>
        <article style={cardStyle}>
          <div style={labelStyle}>Gemini vs OpenAI</div>
          <ModelSplitBar
            gemini={data.kpis.gemini_percent}
            openai={data.kpis.openai_percent}
          />
        </article>
        <article style={cardStyle}>
          <div style={labelStyle}>Active Cron Jobs</div>
          <strong style={valueStyle}>{data.active_cron_jobs ?? 0}</strong>
        </article>
      </section>

      <section style={{ ...cardStyle, padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "1rem" }}>
          7-Day Tokens by Model
        </h3>
        <DailyByModelChart rows={data.daily_by_model} />
      </section>

      <section style={{ ...cardStyle, padding: 16, overflow: "auto" }}>
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "1rem" }}>
          Session Breakdown (Today)
        </h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.85rem",
          }}
        >
          <thead>
            <tr style={{ color: "#b7b7bf" }}>
              <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #222" }}>
                Session Key
              </th>
              <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #222" }}>
                Model
              </th>
              <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>
                Tokens Today
              </th>
              <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #222" }}>
                Est. Cost
              </th>
              <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #222" }}>
                Last Active
              </th>
            </tr>
          </thead>
          <tbody>
            {data.sessions_today.slice(0, 100).map((row) => (
              <tr key={row.session_key} style={{ borderTop: "1px solid #1a1a1a" }}>
                <td style={{ padding: "6px", color: "#b7b7bf", fontFamily: "monospace", fontSize: "0.78rem" }}>
                  {row.session_key}
                </td>
                <td style={{ padding: "6px" }}>{row.model}</td>
                <td style={{ padding: "6px", textAlign: "right" }}>
                  {number(row.tokens_today)}
                </td>
                <td style={{ padding: "6px", textAlign: "right" }}>
                  {usd(row.estimated_cost_usd)}
                </td>
                <td style={{ padding: "6px", color: "#b7b7bf" }}>
                  {new Date(row.last_active).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
