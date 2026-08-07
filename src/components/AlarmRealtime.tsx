import { useEffect, useRef } from 'react';
import { connectAlarmSocket } from '../api/alarmSocket';
import { useNocStore } from '../store/useNocStore';
import type { Alarm } from '../types';

let audioContext: AudioContext | null = null;

function playAlarmTone(severity: Alarm['severity']) {
  if (!['Critical', 'Major'].includes(severity)) return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = audioContext ?? new AudioContextClass();
  audioContext = context;
  if (context.state === 'suspended') void context.resume();
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
}

export function AlarmRealtime() {
  const syncAlarm = useNocStore(state => state.syncAlarm);
  const receiveRealtimeAlarm = useNocStore(state => state.receiveRealtimeAlarm);
  const setRealtimeState = useNocStore(state => state.setRealtimeState);
  const setAiDiagnosis = useNocStore(state => state.setAiDiagnosis);
  const refreshAuthoritativeData = useNocStore(state => state.refreshAuthoritativeData);
  const seen = useRef(new Set<string>());

  const eventKey = (alarm: Alarm) => `${alarm.id}:${alarm.status}:${alarm.updated}`;

  useEffect(() => connectAlarmSocket({
    onState: setRealtimeState,
    onDiagnosis:setAiDiagnosis,
    onAlarmChange: () => { void refreshAuthoritativeData(); },
    onAlarm: alarm => {
      const key = eventKey(alarm);
      const isNew = !seen.current.has(key);
      seen.current.add(key);
      if (isNew) {
        receiveRealtimeAlarm(alarm);
        playAlarmTone(alarm.severity);
      } else {
        syncAlarm(alarm);
      }
    },
  }), [receiveRealtimeAlarm, refreshAuthoritativeData, setAiDiagnosis, setRealtimeState, syncAlarm]);

  useEffect(() => {
    const unlockAudio = () => {
      if (audioContext?.state === 'suspended') void audioContext.resume();
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => { void refreshAuthoritativeData(); }, [refreshAuthoritativeData]);

  return null;
}
