import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { backendStatusEvent, demoSafeModeMessage, isBackendAvailable } from '../lib/apiClient';

export function BackendStatusBanner() {
  const [available, setAvailable] = useState(isBackendAvailable);

  useEffect(() => {
    const update = (event: Event) => setAvailable((event as CustomEvent<{ available: boolean }>).detail.available);
    window.addEventListener(backendStatusEvent, update);
    return () => window.removeEventListener(backendStatusEvent, update);
  }, []);

  if (available) return null;
  return <div className="backend-safe-mode" role="status"><WifiOff />{demoSafeModeMessage}</div>;
}
