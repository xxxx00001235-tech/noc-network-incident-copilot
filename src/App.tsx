import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { AlarmPage, DiagnosisPage, IncidentsPage } from './pages/OperationsPages';
import { AccountsPage, DevicesPage, LabPage, RegionMapPage, SettingsPage, TopologyPage, WallboardPage } from './pages/PlatformPages';
import { useNocStore } from './store/useNocStore';
function Protected(){return useNocStore(s=>s.currentUser)?<AppShell/>:<Navigate to="/login" replace/>}
export default function App(){return <Routes><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<RegisterPage/>}/><Route element={<Protected/>}><Route path="/dashboard" element={<DashboardPage/>}/><Route path="/alarms" element={<AlarmPage/>}/><Route path="/incidents" element={<IncidentsPage/>}/><Route path="/topology" element={<TopologyPage/>}/><Route path="/map" element={<RegionMapPage/>}/><Route path="/diagnosis" element={<DiagnosisPage/>}/><Route path="/lab" element={<LabPage/>}/><Route path="/wallboard" element={<WallboardPage/>}/><Route path="/devices" element={<DevicesPage/>}/><Route path="/accounts" element={<AccountsPage/>}/><Route path="/settings" element={<SettingsPage/>}/></Route><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes>}
