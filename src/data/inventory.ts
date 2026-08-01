import inventory from '../../inventory/device-inventory.json';
import type { Device, TopologyLink, TopologyNode } from '../types';

type InventoryDevice = Omit<Device, 'upstream'|'downstream'|'backup'>;
export const deviceIdAliases:Record<string,string>={'RTR-TP-XY-001':'RTR-TP-NG-BACKUP-001','RTR-TP-NG-CORE-001':'RTR-CORE-001','SW-TP-NG-DIST-001':'SW-TP-NG-001','OLT-TP-NG-ACCESS-001':'OLT-HC-001'};
export const canonicalDeviceId=(id:string)=>deviceIdAliases[id]??id;
export const topologyLinks:TopologyLink[]=inventory.links;
export const topologyNodes:TopologyNode[]=inventory.topology;
export const devices:Device[]=(inventory.devices as InventoryDevice[]).map(item=>{
 const upstream=topologyLinks.find(link=>link.target===item.id)?.source;
 const downstream=topologyLinks.filter(link=>link.source===item.id).map(link=>link.target);
 const backup=topologyLinks.find(link=>link.target===item.id&&link.backup)?.source;
 return {...item,upstream,downstream,backup};
});
export const deviceById=new Map(devices.map(device=>[device.id,device]));
