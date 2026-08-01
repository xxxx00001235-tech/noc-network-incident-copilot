import type { Role } from '../types';

export type Permission =
  | 'dashboard.view' | 'alarms.view' | 'incidents.view' | 'incidents.manage'
  | 'topology.view' | 'diagnosis.view' | 'lab.use' | 'wallboard.view'
  | 'devices.view' | 'devices.manage' | 'access.manage';

export const roleLabels: Record<Role, string> = { admin: 'System Admin', operator: 'NOC Operator', engineer: 'Device Manager' };
export const permissionLabels: Record<Permission, string> = {
  'dashboard.view':'Dashboard','alarms.view':'告警檢視','incidents.view':'事件檢視','incidents.manage':'事件處理',
  'topology.view':'拓樸檢視','diagnosis.view':'AI 診斷','lab.use':'SNMP Lab 操作','wallboard.view':'戰情看板',
  'devices.view':'設備檢視','devices.manage':'設備管理','access.manage':'權限與使用者管理',
};
export const rolePermissions: Record<Role, readonly Permission[]> = {
  admin: Object.keys(permissionLabels) as Permission[],
  operator: ['dashboard.view','alarms.view','incidents.view','incidents.manage','topology.view','diagnosis.view','lab.use','wallboard.view'],
  engineer: ['dashboard.view','alarms.view','incidents.view','topology.view','diagnosis.view','wallboard.view','devices.view','devices.manage'],
};
export const routePermissions: Record<string, Permission> = {
  '/dashboard':'dashboard.view','/alarms':'alarms.view','/incidents':'incidents.view','/topology':'topology.view','/map':'topology.view',
  '/diagnosis':'diagnosis.view','/lab':'lab.use','/wallboard':'wallboard.view','/devices':'devices.view','/accounts':'access.manage','/settings':'access.manage',
};
export function hasPermission(role: Role | undefined, permission: Permission) { return Boolean(role && rolePermissions[role].includes(permission)); }
