import { Card } from '../components/common/UI';
import { permissionLabels, roleLabels, rolePermissions } from '../auth/rbac';
import { useNocStore } from '../store/useNocStore';
import type { Role } from '../types';

const roles = Object.keys(roleLabels) as Role[];

export function RbacPage() {
  const users = useNocStore(state => state.users);
  const setUserRole = useNocStore(state => state.setUserRole);
  return <div className="page">
    <div className="page-title"><div><span className="eyebrow">ACCESS GOVERNANCE</span><h1>權限設定</h1><p>Role、Permission 與 User Mapping。</p></div></div>
    <Card title="Role / Permission">
      <div className="table-wrap"><table><thead><tr><th>Permission</th>{roles.map(role=><th key={role}>{roleLabels[role]}</th>)}</tr></thead>
        <tbody>{Object.entries(permissionLabels).map(([permission,label])=><tr key={permission}><td><b>{label}</b><small>{permission}</small></td>{roles.map(role=><td key={role}>{rolePermissions[role].includes(permission as never)?'✓':'—'}</td>)}</tr>)}</tbody>
      </table></div>
    </Card>
    <Card title="User Mapping">
      <div className="table-wrap"><table><thead><tr><th>使用者</th><th>帳號</th><th>Role</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><b>{user.name}</b><small>{user.department}</small></td><td>{user.username}</td><td><select value={user.role} onChange={event=>setUserRole(user.id,event.target.value as Role)}>{roles.map(role=><option key={role} value={role}>{roleLabels[role]}</option>)}</select></td></tr>)}</tbody></table></div>
    </Card>
  </div>;
}
