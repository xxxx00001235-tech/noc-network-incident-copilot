import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, Bell, Bot, ChevronDown, CircleUserRound, Cpu, Gauge, GitBranch, LayoutDashboard, LogOut, Map, Menu, MonitorUp, Moon, Settings, Sun, Users, Wrench, X } from 'lucide-react';
import { useNocStore } from '../../store/useNocStore';
import { AlarmRealtime } from '../AlarmRealtime';
import { hasPermission, routePermissions } from '../../auth/rbac';
const nav=[
 ['/dashboard','儀表板',LayoutDashboard],['/alarms','告警中心',Bell],['/incidents','事件中心',Activity],['/topology','網路拓樸',GitBranch],['/map','區域地圖',Map],['/diagnosis','AI 診斷',Bot],['/lab','SNMP Lab',Cpu],['/wallboard','NOC 大螢幕',MonitorUp],['/devices','設備管理',Wrench],['/accounts','帳號管理',Users],['/settings','系統設定',Settings],
] as const;
export function AppShell(){
 const [open,setOpen]=useState(false); const user=useNocStore(s=>s.currentUser)!; const theme=useNocStore(s=>s.theme); const setTheme=useNocStore(s=>s.setTheme); const logout=useNocStore(s=>s.logout); const switchRole=useNocStore(s=>s.switchRole); const toast=useNocStore(s=>s.toast); const clearToast=useNocStore(s=>s.clearToast); const navigate=useNavigate();
 useEffect(()=>{document.documentElement.dataset.theme=theme},[theme]); useEffect(()=>{if(!toast)return;const t=setTimeout(clearToast,2600);return()=>clearTimeout(t)},[toast,clearToast]);
 const allowed=nav.filter(([path])=>hasPermission(user.role,routePermissions[path]));
 return <div className="app-shell" data-role={user.role}>
  <AlarmRealtime/>
  <aside className={`sidebar ${open?'open':''}`}><div className="brand"><div className="brand-mark"><Activity/></div><div><b>NOC Copilot</b><small>事件處理模擬平台</small></div><button className="icon mobile-only" onClick={()=>setOpen(false)}><X/></button></div>
   <nav>{allowed.map(([path,label,Icon])=><NavLink key={path} to={path} onClick={()=>setOpen(false)}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
   <div className="sidebar-note"><Bot/><div><b>Demo Safe Mode</b><small>所有資料與查測皆為模擬</small></div></div>
  </aside>
  <div className="workspace"><header className="topbar"><button className="icon mobile-only" onClick={()=>setOpen(true)}><Menu/></button><div><small>Network Operations Center</small><b>網路事件指揮台</b></div><div className="top-actions">
   <div className="theme-switch" aria-label="主題切換"><button className={theme==='dark'?'active':''} onClick={()=>setTheme('dark')} title="Dark NOC"><Moon/></button><button className={theme==='light'?'active':''} onClick={()=>setTheme('light')} title="Light Enterprise"><Sun/></button><button className={theme==='ai'?'active':''} onClick={()=>setTheme('ai')} title="AI Copilot"><Bot/></button></div>
   <div className="user-menu"><CircleUserRound/><div><b>{user.name}</b><small>{user.role}</small></div><ChevronDown size={15}/><select aria-label="切換 Demo 角色" value={user.role} onChange={e=>switchRole(e.target.value as typeof user.role)}><option value="operator">一線人員</option><option value="engineer">設備管理員</option><option value="admin">系統管理員</option></select></div>
   <button className="icon" title="登出" onClick={()=>{logout();navigate('/login')}}><LogOut/></button>
  </div></header><main><Outlet/></main></div>{toast&&<div className="toast">{toast}</div>}<div className={`scrim ${open?'show':''}`} onClick={()=>setOpen(false)}/>
 </div>
}
