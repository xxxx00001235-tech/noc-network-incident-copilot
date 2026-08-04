import { useEffect, useRef } from 'react';
import { connectAlarmSocket } from '../api/alarmSocket';
import { fetchLatestAlarm } from '../api/alarms';
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
  const seen = useRef(new Set<string>());

  useEffect(() => connectAlarmSocket({
    onState: setRealtimeState,
    onDiagnosis:setAiDiagnosis,
    onAlarm: alarm => {
      const isNew = !seen.current.has(alarm.id);
      seen.current.add(alarm.id);
      if (isNew) {
        receiveRealtimeAlarm(alarm);
        playAlarmTone(alarm.severity);
      } else {
        syncAlarm(alarm);
      }
    },
  }), [receiveRealtimeAlarm, setAiDiagnosis, setRealtimeState, syncAlarm]);

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

  useEffect(() => {
    void fetchLatestAlarm().then(alarm => {
      seen.current.add(alarm.id);
      syncAlarm(alarm);
    }).catch(() => undefined);
  }, [syncAlarm]);

  return null;
}
