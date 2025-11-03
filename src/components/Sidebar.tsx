import Section from './Section';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue, push, serverTimestamp, set } from 'firebase/database';
import { useOnlineUsers, useFilteredOnlineUsers } from '../hooks/useOnlineUsers';
import { createRoomAndEnter } from '../lib/rooms';
import { paths } from '../utils/db';
import Avatar from './Avatar';

export default function Sidebar({ currentRoom, onSelectRoom, onUserSelected }: { currentRoom?: string, onSelectRoom: (id: string) => void, onUserSelected?: (user: any) => void }) {
  const uid = (window as any)._uid;
  const [rooms, setRooms] = useState<any[]>([]);
  const [friends, setFriends] = useState<any>({});
  // ★ 修复：确保 genderFilter 初始值总是有效的 ('all' | 'male' | 'female')
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>(
    (localStorage.getItem('genderFilter') as 'all' | 'male' | 'female') || 'all'
  );

  // ★ 使用统一的在线用户数据源 Hook（与 Desktop 完全相同）
  const { users: allOnlineUsers, loading: onlineUsersLoading } = useOnlineUsers();
  const onlineUsers = useFilteredOnlineUsers(allOnlineUsers, genderFilter, uid);
  const onlineCount = allOnlineUsers.length;

  console.log('[Sidebar] onlineUsers length =', onlineUsers.length, 'allOnlineUsers.length:', allOnlineUsers.length, 'genderFilter:', genderFilter, 'uid:', uid);

  useEffect(() => {
    const offRooms = onValue(ref(db, paths.rooms), snap => {
      const v = snap.val() || {};
      const roomList = Object.entries(v).map(([id, roomData]: [string, any]) => {
        // 根据实际数据结构处理：rooms/{roomId}: { name, isOfficial?, visibility?, ownerId? }
        const isOfficial = roomData.type === 'official' || roomData.isOfficial === true;
        const visibility = roomData.visibility || 'public';
        
        return {
          id,
          name: roomData.name || 'Unnamed Room',
          icon: roomData.icon || '💬',
          visibility: visibility,
          type: isOfficial ? 'official' : visibility,
          isOfficial: isOfficial,
          ownerId: roomData.ownerId,
          createdAt: roomData.createdAt,
          expiresAt: roomData.expiresAt
        };
      });
      const now = Date.now();
      // 分组：官方/用户（仅展示未过期的用户房间），用户房按创建时间倒序（最新在上）
      const officialRooms = roomList.filter(r => r.isOfficial);
      const userRooms = roomList
        .filter(r => !r.isOfficial && (!r.expiresAt || r.expiresAt > now))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRooms([...officialRooms, ...userRooms]);
    });
    const offFriends = onValue(ref(db, paths.friends(uid)), snap => setFriends(snap.val() || {}));
    return () => {
      offRooms();
      offFriends();
    };
  }, [uid]);

  function toggleFilter(v: string) {
    setGenderFilter(v as 'all' | 'male' | 'female');
    localStorage.setItem('genderFilter', v);
  }

  async function createRoom() {
    const name = prompt('Room name');
    if (!name) return;
    const visibility = (prompt('Visibility: public/private', 'public') || 'public').toLowerCase() as 'public'|'private';
    const icon = prompt('Emoji icon (e.g., ☕, 💬, 🌿, 💻, ✈️)', '💬') || '💬';
    const id = await createRoomAndEnter({ name, visibility, icon });
    onSelectRoom(id);
  }

  return (
    <div className='w-80 shrink-0 border-r border-white/10 p-3 bg-black/30'>
      <div className='px-2 text-white/70 text-sm mb-3'>Online: {onlineCount} users</div>
      
      <Section id='rooms' title='Rooms'>
        <div className='space-y-2'>
          {/* 官方房间分组 */}
          <div>
            <div className='px-2 text-xs uppercase tracking-wider text-white/50 mb-1'>Official Rooms</div>
            <div className='space-y-1'>
              {rooms.filter((r:any)=>r.isOfficial).map(r => (
                <button
                  key={r.id}
                  onClick={() => onSelectRoom(r.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 ${currentRoom === r.id ? 'bg-white/10' : ''} text-white flex items-center gap-2`}
                >
                  <span>{r.icon}</span>
                  <span className='truncate'>{r.name}</span>
                  <span className='ml-auto text-[11px] px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200'>Official</span>
                </button>
              ))}
            </div>
          </div>

          {/* 用户房间分组 */}
          <div className='mt-2'>
            <div className='px-2 text-xs uppercase tracking-wider text-white/50 mb-1'>User Created Rooms</div>
            <div className='space-y-1'>
              {rooms.filter((r:any)=>!r.isOfficial).map(r => {
                const now = Date.now();
                const left = typeof r.expiresAt === 'number' ? r.expiresAt - now : undefined;
                let label = '';
                let warn = false;
                if (left && left > 0) {
                  const mins = Math.floor(left / 60000);
                  if (mins >= 60) {
                    const h = Math.floor(mins/60);
                    const m = mins % 60;
                    label = `${h}h${m>0?` ${m}m`:''}`;
                  } else {
                    label = `${mins}m`;
                  }
                  warn = mins <= 10;
                }
                return (
                  <button
                    key={r.id}
                    onClick={() => onSelectRoom(r.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 ${currentRoom === r.id ? 'bg-white/10' : ''} text-white flex items-center gap-2`}
                  >
                    <span>{r.icon}</span>
                    <span className='truncate'>{r.name}</span>
                    {label && (
                      <span className={`ml-auto text-[11px] px-2 py-0.5 rounded ${warn ? 'bg-red-500/30 text-red-200' : 'bg-white/10 text-white/70'}`}>
                        {warn ? '⚠ ' : ''}{label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={createRoom} className='w-full mt-2 py-2 rounded-lg bg-white/10 text-white'>
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
                <button 
                  className='text-xs px-2 py-1 bg-white/10 rounded hover:bg-white/20 transition' 
                  onClick={() => onUserSelected?.(u)} 
                  title="Open DM"
                >
                  💬
                </button>
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