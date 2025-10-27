
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';

export default function RoomList({ current, onSelect }:{ current?:string, onSelect:(id:string)=>void }){
  const [rooms,setRooms] = useState<any[]>([]);
  useEffect(()=>{
    const off = onValue(ref(db, '/rooms'), snap=>{
      const v = snap.val()||{}; setRooms(Object.entries(v).map(([id,val])=>({id, ...(val as any)})));
    }); return ()=>off();
  },[]);
  return (
    <div className="w-72 border-r border-white/10 p-3 space-y-1 bg-black/30">
      <div className="text-white/70 px-2 text-sm">Rooms</div>
      {rooms.map(r=>(
        <button key={r.id} onClick={()=>onSelect(r.id)}
          className={`w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 ${current===r.id?'bg-white/10':''} text-white`}>
          {r.name}
        </button>
      ))}
    </div>
  );
}
