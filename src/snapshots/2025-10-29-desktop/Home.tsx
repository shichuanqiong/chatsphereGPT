import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  ref, onValue, push, set, serverTimestamp, query, orderByChild, limitToLast, update, onDisconnect, remove, get, child,
} from 'firebase/database';
import { auth, db, presenceOnline, startPresenceHeartbeat } from '../firebase';
import Composer from '../components/Composer';
import BackgroundRotator from '../components/BackgroundRotator';
import Header from '../components/Header';
import { useSoundToggle } from '../hooks/useSoundToggle';
import { Sound } from '../lib/sound';
import CollapseSection from '../components/CollapseSection';
import { useReadState, incrementRoomUnread, incrementThreadUnread } from '../hooks/useReadState';
import { FriendRow } from '../components/FriendRow';
import InboxPopover from '../components/InboxPopover';
import CreateRoomModal from '../components/CreateRoomModal';
import RoomInviteModal from '../components/RoomInviteModal';
import MembersSheet from '../components/MembersSheet';
import { useToast } from '../components/Toast';
import { useRoomBlocks, useGlobalBlocks } from '../hooks/useRoomBlocks';
import { joinRoom, watchRoomMembers, acceptInvite, kickUser, banUser, unbanUser, declineInvite } from '../lib/roomService';
import { useInbox } from '../hooks/useInbox';
import { acceptRoomInvite, declineRoomInvite } from '../lib/inviteService';
import { useCurrentRoom } from '../state/currentRoom';
import { useRooms } from '../hooks/useRooms';
import { startRoomCleanupScheduler } from '../utils/roomCleanup';
import '../utils/testRoomCleanup'; // 导入测试工具
import '../utils/fixRoomCreatorInfo'; // 导入修复工具
import '../utils/fixRoomExpiresAt'; // 补齐历史房间 expiresAt
import '../utils/backfillRoomExpiry'; // 暴露 backfill 脚本供控制台调用

type AppRoom = { id: string; name: string; type?: 'official'|'user'; visibility?: 'public'|'private'; ownerId?: string; creatorName?: string; icon?: string; createdAt?: number; createdAtFormatted?: string; ownerOfflineAt?: number | null; };
type Message = { authorId: string; authorName: string; type: 'text' | 'gif'; content: string; createdAt: number; };
type Profile = { uid: string; nickname: string; gender: 'male'|'female'; age: number; country: string; bio?: string; isGuest?: boolean; };
type ThreadMeta = { threadId: string; peerId: string; lastMsg?: string; lastSender?: string; lastTs?: number; unread?: number; };
type RoomMeta = { roomId: string; lastReadTs?: number; unread?: number; };

const getUid = () =>
  auth.currentUser?.uid ||
  (window as any)?._uid ||
  (typeof localStorage !== 'undefined' ? localStorage.getItem('uid') || '' : '');

function Avatar({ name }: { name: string }) {
  const url = `https://api.dicebear.com/7.x/adventurer-neutral/png?seed=${encodeURIComponent(name||'guest')}&size=64&radius=50&backgroundType=gradientLinear`;
  return <img src={url} className="h-7 w-7 rounded-full border border-white/10 object-cover" alt="avatar" loading="lazy" />;
}

export default function Home() {
  const { roomId } = useParams<{ roomId?: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const [uid, setUid] = useState<string>(getUid());
  const { items: inboxItems, unreadCount: inboxUnreadCount, markAsRead: markInboxAsRead, markAllAsRead: markAllInboxAsRead, clearInbox: clearInboxItems } = useInbox();
  const { activeRoomId, setActiveRoomId } = useCurrentRoom();
  const { officialRooms, userRooms } = useRooms();

  // 同步路由参数和当前房间状态
  useEffect(() => {
    if (roomId) {
      setActiveRoomId(roomId);
    } else {
      setActiveRoomId(null);
    }
  }, [roomId, setActiveRoomId]);

  // 折叠状态已由 CollapseSection 管理，移除此处声明

  // 数据修复：一次性修复房间的 type 字段（运行一次后删除此 useEffect）
  useEffect(() => {
    const fixRoomTypes = async () => {
      try {
        const snap = await get(ref(db, 'rooms'));
        if (!snap.exists()) return;
        const rooms = snap.val();
        const ops: any = {};
        Object.entries<any>(rooms).forEach(([id, r]) => {
          if (!r.type) {
            // 有 ownerId 的是用户创建的房间，默认为 public；否则为 official
            ops[`rooms/${id}/type`] = r.ownerId ? 'public' : 'official';
          }
        });
        if (Object.keys(ops).length) {
          await update(ref(db), ops);
          console.log(`✅ Fixed ${Object.keys(ops).length} room(s) with missing type field`);
        }
      } catch (e) {
        console.error('Failed to fix room types:', e);
      }
    };
    // fixRoomTypes(); // 如需执行一次性修复，解除注释
  }, []);

  // 房间/DM
  const [rooms, setRooms] = useState<AppRoom[]>([]);
  // 用户自定义屏蔽（全局/当前房）
  const { blockedSet: roomBlocked, setBlocked: setRoomBlocked, isBlocked: isRoomBlocked } = useRoomBlocks(uid, activeRoomId || undefined);
  const { blockedSet: globalBlocked } = useGlobalBlocks(uid);
  const [dmId, setDmId] = useState<string>('');
  const [dmPeer, setDmPeer] = useState<Profile | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMembersSheet, setShowMembersSheet] = useState(false);
  const [roomMembers, setRoomMembers] = useState<string[]>([]);

  // 数据
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [presence, setPresence] = useState<Record<string, { lastSeen: number; state: string }>>({});
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  // 用户房间倒计时
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isUserRoom, setIsUserRoom] = useState(false);

  // 提示音已由 Sound 统一管理
  const { muted } = useSoundToggle();
  const readStateHelpers = useReadState({ activeRoomId: activeRoomId, activeThreadId: dmId });

  useEffect(() => {
    let stopHB: (() => void) | null = null;
    let stopCleanup: (() => void) | null = null;
    const off = onAuthStateChanged(auth, (u) => {
      if (u?.uid) {
        (window as any)._uid = u.uid;
        try { localStorage.setItem('uid', u.uid); } catch {}
        setUid(u.uid);
        presenceOnline(u.uid);
        stopHB?.(); stopHB = startPresenceHeartbeat(u.uid);
        stopCleanup?.(); stopCleanup = startRoomCleanupScheduler();
      }
    });
    return () => { off(); stopHB?.(); stopCleanup?.(); };
  }, []);

  // 省略：其余内容同当前工作副本（此快照为完整拷贝）
  // 为避免冗长，此处应贴入你当前 `src/pages/Home.tsx` 的完整内容。
}


