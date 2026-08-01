import { useEffect, useRef } from 'react';
import { connectAlarmSocket } from '../api/alarmSocket';
import { fetchLatestAlarm } from '../api/alarms';
import { useNocStore } from '../store/useNocStore';
import type { Alarm } from '../types';

function playAlarmTone(severity: Alarm['severity']) {
  if (!['Critical', 'Major'].includes(severity)) return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = severity === 'Critical' ? 880 : 660;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.5);
  oscillator.onended = () => void context.close();
}

export function AlarmRealtime() {
  const syncAlarm = useNocStore(state => state.syncAlarm);
  const setRealtimeState = useNocStore(state => state.setRealtimeState);
  const seen = useRef(new Set<string>());

  useEffect(() => connectAlarmSocket({
    onState: setRealtimeState,
    onAlarm: alarm => {
      const isNew = !seen.current.has(alarm.id);
      seen.current.add(alarm.id);
      syncAlarm(alarm);
      if (isNew) playAlarmTone(alarm.severity);
    },
  }), [setRealtimeState, syncAlarm]);

  useEffect(() => {
    void fetchLatestAlarm().then(alarm => {
      seen.current.add(alarm.id);
      syncAlarm(alarm);
    }).catch(() => undefined);
  }, [syncAlarm]);

  return null;
}
