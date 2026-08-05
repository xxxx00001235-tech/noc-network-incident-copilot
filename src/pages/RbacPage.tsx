import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/common/UI';
import { permissionLabels, roleLabels, rolePermissions } from '../auth/rbac';
import { deleteUser, fetchUsers, reviewUser, updateUser, type ApiUser } from '../api/auth';
import type { Role } from '../types';

const roles = Object.keys(roleLabels) as Role[];

export function RbacPage() {
  const [users,setUsers]=useState<ApiUser[]>([]);
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('');
  const [message,setMessage]=useState('');
  const load=useCallback(async()=>{
    const params=new URLSearchParams();
    if(query)params.set('q',query);
    if(status)params.set('status',status);
    try{setUsers(await fetchUsers(params.toString()));setMessage('');}catch(error){setMessage(error instanceof Error?error.message:'無法讀取帳號');}
  },[query,status]);
  useEffect(()=>{void load()},[load]);
  const act=async(action:()=>Promise<unknown>)=>{try{await action();await load()}catch(error){setMessage(error instanceof Error?error.message:'操作失敗')}};
  return <div className="page">
    <div className="page-title"><div><span className="eyebrow">ACCESS GOVERNANCE</span><h1>帳號與權限管理</h1><p>核准、角色與帳號狀態皆由後端資料庫管理。</p></div></div>
    <Card title="Role / Permission">
      <div className="table-wrap"><table><thead><tr><th>Permission</th>{roles.map(role=><th key={role}>{roleLabels[role]}</th>)}</tr></thead>
        <tbody>{Object.entries(permissionLabels).map(([permission,label])=><tr key={permission}><td><b>{label}</b><small>{permission}</small></td>{roles.map(role=><td key={role}>{rolePermissions[role].includes(permission as never)?'✓':'—'}</td>)}</tr>)}</tbody>
      </table></div>
    </Card>
    <Card title="User Mapping">
      <div className="toolbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜尋帳號、姓名、Email、員編"/><select value={status} onChange={event=>setStatus(event.target.value)}><option value="">全部狀態</option><option value="pending">待核准</option><option value="approved">啟用</option><option value="rejected">拒絕</option><option value="disabled">停用</option></select></div>
      {message&&<p className="disclaimer">{message}</p>}
      <div className="table-wrap"><table><thead><tr><th>使用者</th><th>帳號</th><th>Role</th><th>狀態</th><th>操作</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><b>{user.name||user.username}</b><small>{user.department||user.employee_id||'—'}</small></td><td>{user.username}<small>{user.email}</small></td><td><select value={user.role} onChange={event=>void act(()=>updateUser(user.id,{role:event.target.value as Role}))}>{roles.map(role=><option key={role} value={role}>{roleLabels[role]}</option>)}</select></td><td>{user.status}</td><td><div className="form-actions">{user.status==='pending'&&<><button className="btn small" onClick={()=>void act(()=>reviewUser(user.id,'approve'))}>核准</button><button className="btn small" onClick={()=>void act(()=>reviewUser(user.id,'reject'))}>拒絕</button></>}{user.status==='approved'?<button className="btn small" onClick={()=>void act(()=>reviewUser(user.id,'disable'))}>停用</button>:user.status==='disabled'&&<button className="btn small" onClick={()=>void act(()=>reviewUser(user.id,'restore'))}>恢復</button>}<button className="btn small" onClick={()=>void act(()=>deleteUser(user.id))}>刪除</button></div></td></tr>)}</tbody></table></div>
    </Card>
  </div>;
}
