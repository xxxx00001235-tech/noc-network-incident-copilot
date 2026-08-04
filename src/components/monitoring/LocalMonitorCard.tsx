import { useEffect, useState } from 'react';
import { Activity, Cpu, Database, HardDrive, MemoryStick, WifiOff } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Card } from '../common/UI';

type LocalMetrics = {
  source: 'local';
  status: 'online';
  collectedAt: string;
  cpu: { usedPercent: number };
  memory: { totalBytes: number; usedBytes: number; usedPercent: number };
  disk: { totalBytes: number; usedBytes: number; usedPercent: number };
  network: { receivedBytes: number | null; sentBytes: number | null; available: boolean };
  uptimeSeconds: number;
};
type HistoryPoint = {
  collectedAt: string;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
};
type MonitorAlert = {
  id: number;
  metric: 'cpu' | 'memory' | 'disk';
  severity: 'Warning' | 'Critical';
  value: number;
  threshold: number;
  status: 'active' | 'resolved';
  openedAt: string;
  resolvedAt: string | null;
};

const isLocalBrowser = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const liveRequested = import.meta.env.VITE_DATA_MODE === 'live' || isLocalBrowser;
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBaseUrl = (() => {
  const candidate = configuredApiBaseUrl || (import.meta.env.PROD ? window.location.origin : 'http://127.0.0.1:3001');
  try {
    const url = new URL(candidate, window.location.href);
    if (window.location.protocol === 'https:' && url.protocol !== 'https:') return null;
    return url.toString().replace(/\/+$/, '');
  } catch (error) {
    console.warn('Local monitor API URL is invalid; live metrics are disabled.', error);
    return null;
  }
})();
const metricLabels = { cpu: 'CPU', memory: '記憶體', disk: '系統磁碟' };

const formatBytes = (bytes: number | null) => {
  if (bytes === null) return '無法取得';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
};

export function LocalMonitorCard() {
  const [metrics, setMetrics] = useState<LocalMetrics | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [alerts, setAlerts] = useState<MonitorAlert[]>([]);
  const [offline, setOffline] = useState(liveRequested);

  useEffect(() => {
    if (!liveRequested || !apiBaseUrl) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [metricsResponse, historyResponse, alertsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/metrics/current`, { cache: 'no-store' }),
          fetch(`${apiBaseUrl}/api/metrics/history?limit=60`, { cache: 'no-store' }),
          fetch(`${apiBaseUrl}/api/alerts?limit=20`, { cache: 'no-store' }),
        ]);
        if (!metricsResponse.ok || !historyResponse.ok || !alertsResponse.ok) throw new Error('API unavailable');
        const [nextMetrics, nextHistory, nextAlerts] = await Promise.all([
          metricsResponse.json() as Promise<LocalMetrics>,
          historyResponse.json() as Promise<{ items: HistoryPoint[] }>,
          alertsResponse.json() as Promise<{ items: MonitorAlert[] }>,
        ]);
        if (!cancelled) {
          setMetrics(nextMetrics);
          setHistory(nextHistory.items);
          setAlerts(nextAlerts.items);
          setOffline(false);
        }
      } catch {
        if (!cancelled) {
          setMetrics(null);
          setOffline(true);
        }
      }
    };
    void load();
    const timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!liveRequested) {
    return <Card title="本機監控資料" action={<Badge tone="maintenance">公開展示站</Badge>}>
      <div className="monitor-empty"><Database/><div>
        <b>即時監控服務未連接</b>
        <small>公開靜態網站不會直接讀取訪客電腦；正式遠端監控需經受保護的 API。</small>
      </div></div>
    </Card>;
  }

  if (offline || !metrics) {
    return <Card title="本機監控資料" action={<Badge tone="critical">資料來源離線</Badge>}>
      <div className="monitor-empty"><WifiOff/><div>
        <b>無法連接本機監控 API</b>
        <small>請執行 npm run dev:monitor。系統不會使用假資料冒充即時資料。</small>
      </div></div>
    </Card>;
  }

  const values = [
    ['CPU', `${metrics.cpu.usedPercent}%`, Cpu],
    ['記憶體', `${metrics.memory.usedPercent}%`, MemoryStick],
    ['系統磁碟', `${metrics.disk.usedPercent}%`, HardDrive],
    ['網路接收總量', formatBytes(metrics.network.receivedBytes), Activity],
  ] as const;
  const activeAlerts = alerts.filter((alert) => alert.status === 'active');
  const chartData = history.map((point) => ({
    ...point,
    time: new Date(point.collectedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }));

  return <Card title="本機即時監控" action={<Badge tone={activeAlerts.length ? 'critical' : 'normal'}>{activeAlerts.length ? `${activeAlerts.length} 筆作用中告警` : '資料來源在線'}</Badge>}>
    <div className="monitor-grid">
      {values.map(([label, value, Icon]) => <div key={label}><Icon/><span>{label}</span><b>{value}</b></div>)}
    </div>
    <div className="monitor-meta">
      <span>最後更新：{new Date(metrics.collectedAt).toLocaleString('zh-TW')}</span>
      <span>開機時間：{Math.floor(metrics.uptimeSeconds / 3600)} 小時</span>
      <span>網路傳送總量：{formatBytes(metrics.network.sentBytes)}</span>
    </div>
    <div className="monitor-detail-grid">
      <section>
        <h3>最近 5 分鐘使用率趨勢</h3>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
            <XAxis dataKey="time" minTickGap={35}/>
            <YAxis domain={[0, 100]} unit="%"/>
            <Tooltip/><Legend/>
            <Line name="CPU" type="monotone" dataKey="cpuPercent" stroke="#2bd4ce" dot={false}/>
            <Line name="記憶體" type="monotone" dataKey="memoryPercent" stroke="#8a7dff" dot={false}/>
            <Line name="磁碟" type="monotone" dataKey="diskPercent" stroke="#f6c85f" dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </section>
      <section>
        <h3>資源告警</h3>
        <div className="monitor-alerts">
          {alerts.length ? alerts.slice(0, 8).map((alert) => <div key={alert.id}>
            <Badge tone={alert.severity === 'Critical' ? 'critical' : alert.status === 'active' ? 'maintenance' : 'normal'}>
              {alert.status === 'active' ? alert.severity : '已恢復'}
            </Badge>
            <span><b>{metricLabels[alert.metric]}</b> {alert.value}%（門檻 {alert.threshold}%）</span>
            <small>{new Date(alert.openedAt).toLocaleString('zh-TW')}</small>
          </div>) : <div className="monitor-no-alert">目前沒有資源告警</div>}
        </div>
      </section>
    </div>
  </Card>;
}
