import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { AlarmPage, DiagnosisPage, IncidentsPage } from './pages/OperationsPages';
import { AccountsPage, DevicesPage, LabPage, RegionMapPage, TopologyPage, WallboardPage } from './pages/PlatformPages';
import { RbacPage } from './pages/RbacPage';
import { useNocStore } from './store/useNocStore';
import { hasPermission, routePermissions, type Permission } from './auth/rbac';
function Protected(){return useNocStore(s=>s.currentUser)?<AppShell/>:<Navigate to="/login" replace/>}
function Allowed({permission,children}:{permission:Permission;children:React.ReactNode}){const role=useNocStore(s=>s.currentUser?.role);return hasPermission(role,permission)?children:<Navigate to="/forbidden" replace/>}
const guard=(path:string,page:React.ReactNode)=><Allowed permission={routePermissions[path]}>{page}</Allowed>;
function Forbidden(){return <div className="page"><div className="page-title"><div><span className="eyebrow">403 FORBIDDEN</span><h1>沒有存取權限</h1><p>目前角色無法使用此頁面。</p></div></div></div>}
export default function App(){return <Routes><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<RegisterPage/>}/><Route element={<Protected/>}><Route path="/dashboard" element={guard('/dashboard',<DashboardPage/>)}/><Route path="/alarms" element={guard('/alarms',<AlarmPage/>)}/><Route path="/incidents" element={guard('/incidents',<IncidentsPage/>)}/><Route path="/topology" element={guard('/topology',<TopologyPage/>)}/><Route path="/map" element={guard('/map',<RegionMapPage/>)}/><Route path="/diagnosis" element={guard('/diagnosis',<DiagnosisPage/>)}/><Route path="/lab" element={guard('/lab',<LabPage/>)}/><Route path="/wallboard" element={guard('/wallboard',<WallboardPage/>)}/><Route path="/devices" element={guard('/devices',<DevicesPage/>)}/><Route path="/accounts" element={guard('/accounts',<AccountsPage/>)}/><Route path="/settings" element={guard('/settings',<RbacPage/>)}/><Route path="/forbidden" element={<Forbidden/>}/></Route><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes>}
