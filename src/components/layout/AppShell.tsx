import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Bell, Bot, CircleUserRound, GitBranch, LayoutDashboard, LogOut, Map, Menu, MonitorUp, Moon, Settings, Sun, Users, Wrench, X } from 'lucide-react';
import { useNocStore } from '../../store/useNocStore';
import { AlarmRealtime } from '../AlarmRealtime';
import { hasPermission, routePermissions } from '../../auth/rbac';
const nav=[
 ['/dashboard','儀表板',LayoutDashboard],['/alarms','告警中心',Bell],['/incidents','事件中心',Activity],['/topology','網路拓樸',GitBranch],['/map','區域地圖',Map],['/diagnosis','AI 診斷',Bot],['/wallboard','NOC 大螢幕',MonitorUp],['/devices','設備管理',Wrench],['/accounts','帳號管理',Users],['/settings','系統設定',Settings],
] as const;
export function AppShell(){
 const [open,setOpen]=useState(false); const user=useNocStore(s=>s.currentUser)!; const theme=useNocStore(s=>s.theme); const setTheme=useNocStore(s=>s.setTheme); const logout=useNocStore(s=>s.logout); const toast=useNocStore(s=>s.toast); const clearToast=useNocStore(s=>s.clearToast); const unreadAlarmCount=useNocStore(s=>s.unreadAlarmCount); const acknowledgeAlarms=useNocStore(s=>s.acknowledgeAlarms); const realtimeState=useNocStore(s=>s.realtimeState); const navigate=useNavigate(); const location=useLocation();
 useEffect(()=>{document.documentElement.dataset.theme=theme},[theme]); useEffect(()=>{if(!toast)return;const t=setTimeout(clearToast,5000);return()=>clearTimeout(t)},[toast,clearToast]);
 useEffect(()=>{if(location.pathname==='/alarms')acknowledgeAlarms()},[location.pathname,acknowledgeAlarms]);
 const allowed=nav.filter(([path])=>hasPermission(user.role,routePermissions[path]));
 return <div className="app-shell" data-role={user.role}>
  <AlarmRealtime/>
  <aside className={`sidebar ${open?'open':''}`}><div className="brand"><div className="brand-mark"><Activity/></div><div><b>NOC Copilot</b><small>網路事件處理平台</small></div><button className="icon mobile-only" onClick={()=>setOpen(false)}><X/></button></div>
   <nav>{allowed.map(([path,label,Icon])=><NavLink key={path} to={path} onClick={()=>setOpen(false)}><Icon size={19}/><span>{label}</span>{path==='/alarms'&&unreadAlarmCount>0&&<span className="alarm-count">{unreadAlarmCount>99?'99+':unreadAlarmCount}</span>}</NavLink>)}</nav>
   <div className={`sidebar-note ${realtimeState}`}><Bot/><div><b>{realtimeState==='connected'?'即時資料服務已連線':'正在重新連線'}</b><small>PostgreSQL · FastAPI · WebSocket</small></div></div>
  </aside>
  <div className="workspace"><header className="topbar"><button className="icon mobile-only" onClick={()=>setOpen(true)}><Menu/></button><div><small>Network Operations Center</small><b>網路事件指揮台</b></div><div className="top-actions">
   <button className="icon alarm-button" title="前往告警中心" aria-label={`告警中心，${unreadAlarmCount} 則未讀`} onClick={()=>navigate('/alarms')}><Bell/>{unreadAlarmCount>0&&<span className="alarm-count">{unreadAlarmCount>99?'99+':unreadAlarmCount}</span>}</button>
   <div className="theme-switch" aria-label="主題切換"><button className={theme==='dark'?'active':''} onClick={()=>setTheme('dark')} title="Dark NOC"><Moon/></button><button className={theme==='light'?'active':''} onClick={()=>setTheme('light')} title="Light Enterprise"><Sun/></button><button className={theme==='ai'?'active':''} onClick={()=>setTheme('ai')} title="AI Copilot"><Bot/></button></div>
   <div className="user-menu"><CircleUserRound/><div><b>{user.name}</b><small>{user.role}</small></div></div>
   <button className="icon" title="登出" onClick={()=>{logout();navigate('/login')}}><LogOut/></button>
  </div></header><main><Outlet/></main></div>{toast&&<button className="toast alarm-toast" role="status" onClick={()=>{clearToast();navigate('/alarms')}}><Bell/><span><b>即時告警通知</b><small>{toast}</small></span></button>}<div className={`scrim ${open?'show':''}`} onClick={()=>setOpen(false)}/>
 </div>
}
