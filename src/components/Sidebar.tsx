import Section from './Section';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue, push, serverTimestamp, set } from 'firebase/database';
import { paths } from '../utils/db';
import Avatar from './Avatar';

export default function Sidebar({ currentRoom, onSelectRoom }: { currentRoom?: string, onSelectRoom: (id: string) => void }) {
  const uid = (window as any)._uid;
  const [rooms, setRooms] = useState<any[]>([]);
  const [online, setOnline] = useState<any>({});
  const [profiles, setProfiles] = useState<any>({});
  const [friends, setFriends] = useState<any>({});
  const [genderFilter, setGenderFilter] = useState(localStorage.getItem('genderFilter') || 'all');

  useEffect(() => {
    const offRooms = onValue(ref(db, paths.rooms), snap => {
      const v = snap.val() || {};
      const roomList = Object.entries(v).map(([id, roomData]: [string, any]) => {
        // 根据实际数据结构处理：rooms/{roomId}: { name, isOfficial?, visibility?, ownerId? }
        const isOfficial = roomData.isOfficial === true;
        const visibility = roomData.visibility || 'public';
        
        return {
          id,
          name: roomData.name || 'Unnamed Room',
          icon: roomData.icon || '💬',
          visibility: visibility,
          type: isOfficial ? 'official' : visibility,
          isOfficial: isOfficial,
          ownerId: roomData.ownerId,
          createdAt: roomData.createdAt
        };
      });
      setRooms(roomList);
    });
    const offPresence = onValue(ref(db, '/presence'), snap => setOnline(snap.val() || {}));
    const offProfiles = onValue(ref(db, '/profiles'), snap => setProfiles(snap.val() || {}));
    const offFriends = onValue(ref(db, paths.friends(uid)), snap => setFriends(snap.val() || {}));
    return () => {
      offRooms();
      offPresence();
      offProfiles();
      offFriends();
    };
  }, [uid]);

  const onlineUsers = useMemo(() => {
    const arr = Object.keys(online)
      .filter(k => online[k].state === 'online')
      .map(k => ({ uid: k, ...profiles[k] }))
      .filter(Boolean);
    return arr.filter(u => genderFilter === 'all' ? true : (u?.gender === genderFilter));
  }, [online, profiles, genderFilter]);

  const onlineCount = useMemo(() => 
    Object.keys(online).filter(k => online[k].state === 'online').length, 
    [online]
  );

  function toggleFilter(v: string) {
    setGenderFilter(v);
    localStorage.setItem('genderFilter', v);
  }

  async function createRoom() {
    const name = prompt('Room name');
    if (!name) return;
    const visibility = (prompt('Visibility: public/private', 'public') || 'public').toLowerCase();
    const icon = prompt('Emoji icon (e.g., ☕, 💬, 🌿, 💻, ✈️)', '💬') || '💬';
    
    const r = push(ref(db, paths.rooms));
    const id = r.key!;
    
    // 根据实际数据结构写入：rooms/{roomId}: { name, isOfficial?, visibility?, ownerId? }
    await set(ref(db, `${paths.rooms}/${id}`), {
      name: name,
      visibility: visibility,
      ownerId: uid,
      icon: icon,
      createdAt: serverTimestamp()
    });
    
    // 房主自动成为成员
    await set(ref(db, `roomMembers/${id}/${uid}`), true);
    
    onSelectRoom(id);
  }

  return (
    <div className='w-80 shrink-0 border-r border-white/10 p-3 bg-black/30'>
      <div className='px-2 text-white/70 text-sm'>Online: {onlineCount} users</div>
      
      <Section id='rooms' title='Rooms'>
        <div className='space-y-1'>
          {rooms.sort((a, b) => (b.isOfficial ? 1 : 0) - (a.isOfficial ? 1 : 0)).map(r => (
            <button
              key={r.id}
              onClick={() => onSelectRoom(r.id)}
              className={`w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 ${
                currentRoom === r.id ? 'bg-white/10' : ''
              } text-white flex items-center gap-2`}
            >
              <span>{r.icon}</span>
              <span className='truncate'>{r.name}</span>
              {r.isOfficial && <span className='badge ml-auto'>Official</span>}
              {!r.isOfficial && <span className='badge ml-auto'>{r.visibility}</span>}
            </button>
          ))}
          <button onClick={createRoom} className='w-full mt-1 py-2 rounded-lg bg-white/10 text-white'>
            + Create Room
          </button>
        </div>
      </Section>

      <Section id='online' title='Online Users'>
        <div className='flex gap-2 px-2 mb-2'>
          {['all', 'male', 'female'].map(g => (
            <button
              key={g}
              onClick={() => toggleFilter(g)}
              className={`px-2 py-1 rounded ${genderFilter === g ? 'bg-indigo-500/70' : 'bg-white/10'}`}
            >
              {g}
            </button>
          ))}
        </div>
        <div className='space-y-2 max-h-64 overflow-auto pr-1'>
          {onlineUsers.map(u => (
            <div key={u.uid} className='flex items-center gap-2 text-white/90'>
              <Avatar uid={u.uid} gender={u.gender || 'unknown'} />
              <div className='flex-1 truncate'>
                <div className='text-sm truncate'>{u.nickname || u.uid.slice(0, 6)}</div>
                <div className='text-xs text-white/60'>
                  {u.age ? u.age + ' · ' : ''}{u.gender || 'unknown'} · {u.country || '--'}
                </div>
              </div>
              {u.uid !== uid && (
                <button className='text-xs px-2 py-1 bg-white/10 rounded' onClick={() => {}} />
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section id='friends' title='Friends'>
        <div className='text-white/60 text-sm px-2'>Manage in profile menu (top bar)</div>
      </Section>

      <Section id='inbox' title='Inbox'>
        <div className='text-white/60 text-sm px-2'>Notifications appear in top bar bell.</div>
      </Section>
    </div>
  );
}