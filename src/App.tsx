import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type DashboardInfo = {
  cpu_usage: number;
  used_ram: number;
  total_ram: number;
  process_count: number;
};

type ProcessInfo = {
  name: string;
  pid: number;
  cpu_usage: number;
  memory_mb: number;
};

type LoadState = "idle" | "loading" | "error";

const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatMb = (value: number) => `${value.toFixed(0)} MB`;

function App() {
  const [dashboard, setDashboard] = useState<DashboardInfo | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoadState("loading");
    setError(null);

    try {
      const [dashboardInfo, processList] = await Promise.all([
        invoke<DashboardInfo>("get_dashboard_info"),
        invoke<ProcessInfo[]>("get_processes")
      ]);

      setDashboard(dashboardInfo);
      setProcesses(processList);
      setLastUpdated(new Date());
      setLoadState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadData();
    const intervalId = window.setInterval(() => {
      void loadData();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [loadData]);

  const ramUsagePercent = useMemo(() => {
    if (!dashboard || dashboard.total_ram === 0) {
      return 0;
    }

    return (dashboard.used_ram / dashboard.total_ram) * 100;
  }, [dashboard]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Why is my PC doing it?</h1>
          <p>Local system overview</p>
        </div>
        <div className="header-actions">
          {lastUpdated ? (
            <span className="updated-at">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          ) : null}
          <button onClick={() => void loadData()} disabled={loadState === "loading"}>
            {loadState === "loading" ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <div className="notice">Could not load system data: {error}</div> : null}

      <section className="overview-grid" aria-label="System overview">
        <article className="overview-card">
          <span className="card-label">CPU usage</span>
          <strong>{dashboard ? formatPercent(dashboard.cpu_usage) : "--"}</strong>
        </article>
        <article className="overview-card">
          <span className="card-label">RAM usage</span>
          <strong>{dashboard ? formatPercent(ramUsagePercent) : "--"}</strong>
          <span className="card-detail">
            {dashboard
              ? `${formatMb(dashboard.used_ram)} of ${formatMb(dashboard.total_ram)}`
              : "Waiting for data"}
          </span>
        </article>
        <article className="overview-card">
          <span className="card-label">Running processes</span>
          <strong>{dashboard?.process_count ?? "--"}</strong>
        </article>
      </section>

      <section className="process-panel">
        <div className="panel-header">
          <div>
            <h2>Running programs</h2>
            <p>Processes currently reported by Windows.</p>
          </div>
        </div>

        <div className="process-table" role="table" aria-label="Running process list">
          <div className="process-row process-heading" role="row">
            <span role="columnheader">Name</span>
            <span role="columnheader">PID</span>
            <span role="columnheader">CPU</span>
            <span role="columnheader">RAM</span>
          </div>

          {processes.map((process) => (
            <div className="process-row" role="row" key={process.pid}>
              <span className="process-name" role="cell" title={process.name}>
                {process.name || "Unknown process"}
              </span>
              <span role="cell">{process.pid}</span>
              <span role="cell">{formatPercent(process.cpu_usage)}</span>
              <span role="cell">{formatMb(process.memory_mb)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
