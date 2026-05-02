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
  executable_path?: string | null;
};

type StorageInfo = {
  name: string;
  mount_point: string;
  total_space: number;
  used_space: number;
  free_space: number;
  usage_percent: number;
};

type LoadState = "idle" | "loading" | "error";
type ViewMode = "simple" | "advanced";
type ProcessStatus = "Normal" | "Check";

const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatMb = (value: number) => `${value.toFixed(0)} MB`;
const formatGb = (value: number) => `${value.toFixed(0)} GB`;

const getProcessExplanation = (processName: string) => {
  const normalizedName = processName.toLowerCase();

  if (["chrome.exe", "msedge.exe", "firefox.exe"].includes(normalizedName)) {
    return "Browser process. Usually used for websites, tabs and extensions.";
  }

  if (normalizedName === "discord.exe") {
    return "Discord process. Usually used for chat, voice and background updates.";
  }

  if (normalizedName === "steam.exe") {
    return "Steam process. Usually used for game updates, downloads and overlay.";
  }

  if (normalizedName === "svchost.exe") {
    return "Windows service host. Used by Windows for background services.";
  }

  if (normalizedName === "explorer.exe") {
    return "Windows Explorer. Handles desktop, taskbar and file browsing.";
  }

  return "Unknown or third-party process. Check the path if you do not recognize it.";
};

const getProcessHint = (process: ProcessInfo, mode: ViewMode) => {
  if (process.cpu_usage > 50) {
    return "High CPU usage";
  }

  if (process.memory_mb > 1500) {
    return "High memory usage";
  }

  if (mode === "advanced" && !process.executable_path) {
    return "Path unavailable";
  }

  return "No obvious issue";
};

const getProcessStatus = (hint: string): ProcessStatus =>
  hint === "No obvious issue" ? "Normal" : "Check";

function App() {
  const [dashboard, setDashboard] = useState<DashboardInfo | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [storage, setStorage] = useState<StorageInfo[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("simple");

  const loadData = useCallback(async () => {
    setLoadState("loading");
    setError(null);

    try {
      const [dashboardInfo, processList, storageInfo] = await Promise.all([
        invoke<DashboardInfo>("get_dashboard_info"),
        invoke<ProcessInfo[]>("get_processes"),
        invoke<StorageInfo[]>("get_storage_info")
      ]);

      setDashboard(dashboardInfo);
      setProcesses(processList);
      setStorage(storageInfo);
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
          <div className="mode-toggle" aria-label="View mode">
            <button
              className={viewMode === "simple" ? "active" : ""}
              onClick={() => setViewMode("simple")}
              type="button"
            >
              Simple
            </button>
            <button
              className={viewMode === "advanced" ? "active" : ""}
              onClick={() => setViewMode("advanced")}
              type="button"
            >
              Advanced
            </button>
          </div>
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

      <section className="storage-panel">
        <div className="panel-header">
          <div>
            <h2>Storage overview</h2>
            <p>Local drives reported by Windows.</p>
          </div>
        </div>

        <div className="storage-list">
          {storage.length > 0 ? (
            storage.map((drive) => (
              <article className="storage-row" key={drive.mount_point || drive.name}>
                <div className="storage-main">
                  <div>
                    <strong>{drive.mount_point || drive.name || "Drive"}</strong>
                    <span>{drive.name || "Local disk"}</span>
                  </div>
                  <span>{formatPercent(drive.usage_percent)} used</span>
                </div>
                <div className="storage-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(drive.usage_percent, 100)}%` }} />
                </div>
                <div className="storage-detail">
                  <span>{formatGb(drive.used_space)} used</span>
                  <span>{formatGb(drive.free_space)} free</span>
                  <span>{formatGb(drive.total_space)} total</span>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">Waiting for storage data.</div>
          )}
        </div>
      </section>

      <section className="process-panel">
        <div className="panel-header">
          <div>
            <h2>Running programs</h2>
            <p>Processes currently reported by Windows.</p>
          </div>
        </div>

        <div className="process-table" role="table" aria-label="Running process list">
          <div
            className={`process-row process-heading ${
              viewMode === "advanced" ? "advanced" : "simple"
            }`}
            role="row"
          >
            <span role="columnheader">Name</span>
            <span role="columnheader">Explanation</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Hint</span>
            <span role="columnheader">CPU</span>
            <span role="columnheader">RAM</span>
            {viewMode === "advanced" ? (
              <>
                <span role="columnheader">PID</span>
                <span role="columnheader">Path</span>
              </>
            ) : null}
          </div>

          {processes.map((process) => {
            const explanation = getProcessExplanation(process.name);
            const hint = getProcessHint(process, viewMode);
            const status = getProcessStatus(hint);

            return (
              <div
                className={`process-row ${viewMode === "advanced" ? "advanced" : "simple"}`}
                role="row"
                key={process.pid}
              >
                <span className="process-name" role="cell" title={process.name}>
                  {process.name || "Unknown process"}
                </span>
                <span className="process-explanation" role="cell" title={explanation}>
                  {explanation}
                </span>
                <span role="cell">
                  <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
                </span>
                <span className="process-hint" role="cell" title={hint}>
                  {hint}
                </span>
                <span role="cell">{formatPercent(process.cpu_usage)}</span>
                <span role="cell">{formatMb(process.memory_mb)}</span>
                {viewMode === "advanced" ? (
                  <>
                    <span role="cell">{process.pid}</span>
                    <span
                      className="process-path"
                      role="cell"
                      title={process.executable_path ?? "Path unavailable"}
                    >
                      {process.executable_path ?? "Path unavailable"}
                    </span>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default App;
