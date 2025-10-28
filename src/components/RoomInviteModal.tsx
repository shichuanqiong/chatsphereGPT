import { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase";
import { useToast } from "./Toast";
import { inviteToRoom } from "../lib/inviteService";

type UserLite = { uid: string; name: string; age?: number; gender?: string; country?: string; avatarUrl?: string };

export default function RoomInviteModal({ roomId, open, onClose, friends, onlineUsers }: {
  roomId: string;
  open: boolean;
  onClose: () => void;
  friends: UserLite[];
  onlineUsers: UserLite[];
}) {
  const [users, setUsers] = useState<UserLite[]>([]);
  const [q, setQ] = useState("");
  const current = auth.currentUser?.uid;
  const { show } = useToast();

  useEffect(() => {
    if (!open) return;
    // 合并好友和在线用户列表，去重
    const allUsers = [...friends, ...onlineUsers];
    const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.uid, u])).values());
    setUsers(uniqueUsers);
  }, [open, friends, onlineUsers]);

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return users;
    return users.filter(u => (u.name || "").toLowerCase().includes(k));
  }, [q, users]);

  if (!open) return null;

  async function invite(uid: string) {
    const owner = auth.currentUser?.uid;
    if (!owner) return;

    try {
      await inviteToRoom(roomId, owner, uid);
      show("Invitation sent", "success", 900);
    } catch (e: any) {
      console.error("Failed to invite user:", e);
      if (e.message === 'banned') {
        show("User is banned from this room", "error", 1200);
      } else {
        show("Failed to invite user. Please try again.", "error", 1200);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[560px] rounded-2xl bg-neutral-900/95 p-6 shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Invite users</h3>
          <button onClick={onClose} className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors">
            Close
          </button>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name..."
          className="w-full mb-4 rounded-lg bg-neutral-800 px-3 py-2 outline-none focus:ring-2 focus:ring-cyan-400 text-white"
          autoFocus
        />

        <div className="max-h-[320px] overflow-auto space-y-2 pr-2">
          {list.length === 0 ? (
            <div className="text-white/60 text-sm text-center py-8">No users found</div>
          ) : (
            list.map(u => (
              <div key={u.uid} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <img
                    src={u.avatarUrl || `https://api.dicebear.com/7.x/adventurer-neutral/png?seed=${encodeURIComponent(u.name)}&size=64&radius=50&backgroundType=gradientLinear`}
                    className="w-8 h-8 rounded-full object-cover border border-white/10"
                    alt=""
                  />
                  <div>
                    <div className="text-sm font-medium text-white">{u.name}</div>
                    <div className="text-xs text-white/60">{u.age ?? "--"} · {u.gender ?? "--"} · {u.country ?? "--"}</div>
                  </div>
                </div>
                <button
                  onClick={() => invite(u.uid)}
                  className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-white text-sm font-medium hover:from-cyan-600 hover:to-violet-600 transition-all"
                >
                  Invite
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

