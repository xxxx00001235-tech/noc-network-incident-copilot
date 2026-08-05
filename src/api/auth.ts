import { apiRequest } from '../lib/apiClient';
import type { Role } from '../types';

export interface ApiUser {
  id:number; employee_id:string|null; username:string; name:string|null; email:string;
  teams:string|null; phone:string|null; department:string|null; role:Role; status:string;
  created_at:string; updated_at:string; last_login_at:string|null; deleted_at:string|null;
}
export interface LoginResponse { access_token:string; token_type:string; user:ApiUser }
export const loginApi=(username:string,password:string)=>apiRequest<LoginResponse>('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
export const fetchUsers=(query='')=>apiRequest<ApiUser[]>(`/api/users${query?`?${query}`:''}`);
export const updateUser=(id:number,body:Partial<Pick<ApiUser,'role'|'status'>>)=>apiRequest<ApiUser>(`/api/users/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
export const reviewUser=(id:number,action:'approve'|'reject'|'disable'|'restore')=>apiRequest<ApiUser>(`/api/admin/users/${id}/${action}`,{method:'POST'});
export const deleteUser=(id:number)=>apiRequest<void>(`/api/users/${id}`,{method:'DELETE'});
