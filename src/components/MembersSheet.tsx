import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { onValue, ref, remove, update, get } from "firebase/database";
import { UserActionMenu } from "./UserActionMenu";
import { useToast } from "./Toast";

type Member = { uid: string; role: string; joinedAt?: number };
type Profile = { uid: string; nickname: string; gender: 'male' | 'female'; age: number; country: string };

export default function MembersSheet({ 
  roomId, 
  open, 
  onClose,
  members: memberUids 
}: {
  roomId: string;
  open: boolean;
  onClose: () => void;
  members: string[];
}) {
  const { show } = useToast();
  const [bans, setBans] = useState<Record<string, boolean>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  useEffect(() => {
    if (!open || !roomId) return;

    const off1 = onValue(ref(db, `rooms/${roomId}/bans`), (s) => {
      setBans(s.val() || {});
    });

    const off2 = onValue(ref(db, 'profiles'), (s) => {
      setProfiles(s.val() || {});
    });

    return () => { off1(); off2(); };
  }, [open, roomId]);

  async function kick(uid: string) {
    const profile = profiles[uid];
    const name = profile?.nickname || uid.slice(0, 8);
    
    try {
      await remove(ref(db, `rooms/${roomId}/members/${uid}`));
      show(`Kicked ${name} from the room`, 'info', 1500);
    } catch (e) {
      console.error('Failed to kick user:', e);
      show('Failed to kick user', 'error', 1500);
    }
  }

  async function ban(uid: string) {
    const profile = profiles[uid];
    const name = profile?.nickname || uid.slice(0, 8);
    
    try {
      await update(ref(db), {
        [`rooms/${roomId}/bans/${uid}`]: true,
      });
      // 顺便移出成员
      await remove(ref(db, `rooms/${roomId}/members/${uid}`)).catch(() => {});
      show(`Banned ${name} from the room`, 'info', 1500);
    } catch (e) {
      console.error('Failed to ban user:', e);
      show('Failed to ban user', 'error', 1500);
    }
  }

  async function unban(uid: string) {
    const profile = profiles[uid];
    const name = profile?.nickname || uid.slice(0, 8);
    
    try {
      await remove(ref(db, `rooms/${roomId}/bans/${uid}`));
      show(`Unbanned ${name}`, 'success', 1500);
    } catch (e) {
      console.error('Failed to unban user:', e);
      show('Failed to unban user', 'error', 1500);
    }
  }

  const handleRightClick = (e: React.MouseEvent, profile: Profile) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setSelectedUser(profile);
    setShowMenu(true);
  };

  if (!open) return null;

  const currentUserUid = auth.currentUser?.uid;
  const memberProfiles = memberUids.map(uid => ({ uid, profile: profiles[uid] })).filter(p => p.profile);

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <aside className="w-[380px] h-full bg-neutral-900/95 p-5 backdrop-blur overflow-y-auto border-l border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Members</h3>
          <button onClick={onClose} className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white">
            Close
          </button>
        </div>

        <div className="space-y-2 mb-6">
          {memberProfiles.length === 0 ? (
            <div className="text-white/60 text-sm text-center py-4">No members yet</div>
          ) : (
            memberProfiles.map(({ uid, profile }) => (
              <div 
                key={uid} 
                className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors"
                onContextMenu={(e) => handleRightClick(e, profile)}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={`https://api.dicebear.com/7.x/adventurer-neutral/png?seed=${encodeURIComponent(profile.nickname)}&size=64&radius=50&backgroundType=gradientLinear`}
                    className="w-9 h-9 rounded-full object-cover border border-white/10"
                    alt=""
                  />
                  <div>
                    <div className="text-sm font-medium text-white">{profile.nickname}</div>
                    <div className="text-xs text-white/60">{profile.age} · {profile.gender} · {profile.country}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {uid !== currentUserUid && (
                    <button
                      onClick={() => kick(uid)}
                      className="px-2 py-1 rounded text-xs bg-neutral-800 hover:bg-neutral-700 text-white"
                    >
                      Kick
                    </button>
                  )}
                  {uid !== currentUserUid && (
                    bans[uid] ? (
                      <button
                        onClick={() => unban(uid)}
                        className="px-2 py-1 rounded text-xs bg-green-600 hover:bg-green-700 text-white"
                      >
                        Unban
                      </button>
                    ) : (
                      <button
                        onClick={() => ban(uid)}
                        className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white"
                      >
                        Ban
                      </button>
                    )
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {Object.keys(bans).length > 0 && (
          <>
            <h4 className="text-sm font-semibold text-white/70 mb-2">Banned Users</h4>
            <div className="space-y-2">
              {Object.keys(bans).map(uid => {
                const profile = profiles[uid];
                return (
                  <div key={uid} className="flex items-center justify-between bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://api.dicebear.com/7.x/adventurer-neutral/png?seed=${encodeURIComponent(profile?.nickname || uid)}&size=64&radius=50&backgroundType=gradientLinear`}
                        className="w-9 h-9 rounded-full object-cover border border-red-500/30"
                        alt=""
                      />
                      <div>
                        <div className="text-sm font-medium text-white">{profile?.nickname || uid.slice(0, 8)}</div>
                        <div className="text-xs text-white/60">Banned</div>
                      </div>
                    </div>
                    {uid !== currentUserUid && (
                      <button
                        onClick={() => unban(uid)}
                        className="px-2 py-1 rounded text-xs bg-green-600 hover:bg-green-700 text-white"
                      >
                        Unban
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </aside>
      
      {selectedUser && (
        <UserActionMenu
          user={selectedUser}
          isOpen={showMenu}
          onClose={() => {
            setShowMenu(false);
            setSelectedUser(null);
          }}
          position={menuPosition}
        />
      )}
    </div>
  );
}

