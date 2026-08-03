import { apiRequest } from '../lib/apiClient';
import type { Role } from '../types';

export interface ApiUser { id:number; username:string; email:string; role:Role; status:string }
export interface LoginResponse { access_token:string; token_type:string; user:ApiUser }
export const loginApi=(username:string,password:string)=>apiRequest<LoginResponse>('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
