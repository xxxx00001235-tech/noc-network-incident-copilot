import { BrainCircuit, Check, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import type { AnalysisResponse } from '../../api/analysis';
import { contacts } from '../../data/mockData';
import type { Alarm, DiagnosticResult } from '../../types';
import { Card } from '../common/UI';

export const diagnose=(alarm?:Alarm):DiagnosticResult=>{
 const optical=alarm?.content.toLowerCase().includes('optical')||alarm?.content.includes('無回應');
 const cpu=alarm?.content.includes('CPU');
 return {
  rootCause:cpu?'設備負載異常，可能有程序耗用資源':optical?'上游光纖中斷或 SFP 光模組異常':'設備連線或介面狀態異常',
  confidence:cpu?82:optical?87:74,
  evidence:cpu?['CPU 使用率超過 90%','設備仍可連線','同區域無其他連鎖告警']:['上游設備仍可達','目標設備 Ping 失敗','SNMP 無回應','同區域下游設備同時告警','Optical LOS 同時發生'],
  impact:alarm?.deviceId==='OLT-HC-001'?'下游 28 台設備可能受影響':'核心路徑與下游服務可能中斷',
  steps:['先確認是否存在維護作業','檢查上游介面狀態','確認光功率與 SFP 模組','聯絡設備管理員'],
  contact:contacts[0].name,maintenanceLikely:Boolean(alarm?.maintenance),risk:'若核心路徑無備援，影響範圍可能持續擴大',
 };
};
interface DiagnosisPanelProps {
 alarm?:Alarm;
 analysis?:AnalysisResponse|null;
 analysisState?:'idle'|'loading'|'success'|'error';
 analysisError?:string;
 onRefresh?:()=>void;
}
export function DiagnosisPanel({alarm,analysis,analysisState='idle',analysisError='',onRefresh}:DiagnosisPanelProps){
 const mock=diagnose(alarm);
 const apiDiagnosis=analysis?.diagnosis;
 const confidence=apiDiagnosis?Math.max(0,Math.min(100,Math.round(apiDiagnosis.confidence<=1?apiDiagnosis.confidence*100:apiDiagnosis.confidence))):mock.confidence;
 const recommendation=apiDiagnosis?(Array.isArray(apiDiagnosis.recommendation)?apiDiagnosis.recommendation.join(' → '):apiDiagnosis.recommendation):mock.steps.join(' → ');
 const rootCause=apiDiagnosis?.likely_cause||mock.rootCause;
 return <Card title="AI 模擬診斷" className="diagnosis">
  {analysisState!=='idle'&&<div className={`api-state ${analysisState}`}>{analysisState==='loading'?<RefreshCw className="spin"/>:analysisState==='success'?<Check/>:<WifiOff/>}<span><b>{analysisState==='loading'?'AI 分析載入中':analysisState==='success'?'FastAPI AI 分析已同步':'FastAPI AI 分析無法載入'}</b><small>{analysisState==='error'?`${analysisError}，目前顯示原有模擬診斷。`:analysisState==='success'?`${analysis?.device_id} · 即時分析結果`:'正在分析選取設備…'}</small></span>{analysisState!=='loading'&&onRefresh&&<button className="btn small" onClick={onRefresh}><RefreshCw/>重新整理</button>}</div>}
  <div className="ai-title"><BrainCircuit/><div><small>可能根本原因</small><strong>{rootCause}</strong></div></div>
  <div className="confidence"><span style={{width:`${confidence}%`}}/><b>{confidence}% 信心分數</b></div>
  <h3>判斷依據</h3><ol>{mock.evidence.map(x=><li key={x}>{x}</li>)}</ol>
  <div className="callout"><ShieldAlert size={18}/><span><b>影響：</b>{mock.impact}<br/><b>建議：</b>{recommendation}</span></div>
  {mock.maintenanceLikely&&<div className="maintenance-note">此告警可能由既定維護作業造成，請先確認維護進度。</div>}
  <p className="disclaimer">此結果為模擬 AI 判斷，僅供展示與輔助參考。</p>
 </Card>
}
