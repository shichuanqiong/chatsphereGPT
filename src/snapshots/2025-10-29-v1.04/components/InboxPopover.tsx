import { auth, db } from '../firebase';
import { ref, get, update, remove } from 'firebase/database';

type InboxItem = {
  id: string;
  type: 'dm' | 'room_invite';
  unread: boolean;
  ts: number;
  count?: number;
  // DM fields
  peerId?: string;
  lastMsg?: string;
  lastSender?: string;
  // Room invite fields
  roomId?: string;
  inviterUid?: string;
};

type Profile = { uid: string; nickname: string; gender: 'male'|'female'; age: number; country: string; bio?: string; isGuest?: boolean; };
type Room = { id: string; name: string; type: 'official'|'public'|'private'; ownerId?: string; icon?: string; createdAt?: number; ownerOfflineAt?: number | null; };

export default function InboxPopover({
  inboxItems,
  profiles,
  rooms,
  onOpenDM,
  onAcceptInvite,
  onDeclineInvite,
  onMarkAllRead,
  onClearInbox,
}: {
  inboxItems: InboxItem[];
  profiles: Record<string, Profile>;
  rooms: Room[];
  onOpenDM: (peer: Profile | null, threadId?: string) => void;
  onAcceptInvite: (roomId: string, inviteId: string) => void;
  onDeclineInvite: (roomId: string, inviteId: string) => void;
  onMarkAllRead?: () => void;
  onClearInbox?: () => void;
}) {
  const getRoomName = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    return room?.name || 'Unknown Room';
  };

  const getInviterName = (inviterUid: string) => {
    const profile = profiles[inviterUid];
    return profile?.nickname || inviterUid.slice(0, 8);
  };

  return (
    <>
      {/* 一键已读 + 清空 Inbox 按钮 */}
      <div className="p-2 border-b border-white/10">
        <div className="flex gap-2">
          <button
            onClick={onMarkAllRead}
            className="flex-1 h-8 rounded-lg bg-white/15 hover:bg-white/20 text-sm"
          >
            Mark All as Read
          </button>
          <button
            onClick={onClearInbox}
            className="flex-1 h-8 rounded-lg bg-white/15 hover:bg-white/20 text-sm"
          >
            Clear Inbox
          </button>
        </div>
      </div>
      
      {inboxItems.length === 0 && (
        <div className="p-3 text-white/60 text-sm">No messages yet.</div>
      )}
      
      {inboxItems
        .sort((a, b) => b.ts - a.ts)
        .map((item) => {
          if (item.type === 'dm') {
            const peer = profiles[item.peerId!];
            return (
              <button
                key={item.id}
                onClick={() => onOpenDM(peer || null)}
                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2"
              >
                <img
                  src={`https://api.dicebear.com/7.x/adventurer-neutral/png?seed=${encodeURIComponent(peer?.nickname || 'User')}&size=64&radius=50&backgroundType=gradientLinear`}
                  className="h-7 w-7 rounded-full border border-white/10"
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate flex items-center gap-2">
                    <span>{peer?.nickname || item.peerId}</span>
                    <span className="text-[10px] text-white/40">{new Date(item.ts).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-white/50 truncate">{item.lastMsg || ''}</div>
                </div>
                {item.unread && (
                  <span className="ml-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                    {item.count || 1}
                  </span>
                )}
              </button>
            );
          } else if (item.type === 'room_invite') {
            const inviterProfile = item.inviterUid ? profiles[item.inviterUid] : undefined;
            const inviterName = getInviterName(item.inviterUid!);
            const inviterAvatar = `https://api.dicebear.com/7.x/adventurer-neutral/png?seed=${encodeURIComponent(inviterProfile?.nickname || inviterName)}&size=64&radius=50&backgroundType=gradientLinear`;
            const roomName = getRoomName(item.roomId!);
            return (
              <div
                key={item.id}
                className="px-3 py-2 hover:bg-white/10 flex items-center gap-2"
              >
                <img
                  src={inviterAvatar}
                  alt="inviter"
                  className="h-7 w-7 rounded-full border border-white/10 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{inviterName} invited you to</div>
                  <div className="text-xs text-white/50 truncate">{roomName}</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onAcceptInvite(item.roomId!, item.id)}
                    className="px-2 py-1 rounded text-xs bg-green-600 hover:bg-green-700 text-white"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onDeclineInvite(item.roomId!, item.id)}
                    className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white"
                  >
                    Decline
                  </button>
                </div>
                {item.unread && (
                  <span className="ml-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                    1
                  </span>
                )}
              </div>
            );
          }
          return null;
        })}
    </>
  );
}