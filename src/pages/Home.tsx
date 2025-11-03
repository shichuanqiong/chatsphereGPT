import { useEffect, useMemo, useRef, useState, useLayoutEffect, useCallback } from 'react';
import Logo from '../components/Logo';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  ref, onValue, push, set, serverTimestamp, query, orderByChild, limitToLast, update, onDisconnect, remove, get, child,
} from 'firebase/database';
import { auth, db, presenceOnline, startPresenceHeartbeat } from '../firebase';
import Composer, { type ComposerRef } from '../components/Composer';
import Header from '../components/Header';
import { useSoundToggle } from '../hooks/useSoundToggle';
import { useOnlineUsers, useOnlineCount } from '../hooks/useOnlineUsers';
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
import { useOpenDM } from '@/hooks/useOpenDM';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { useKeyboardOffset } from '../hooks/useKeyboardOffset';
import { useIOSKeyboardVar } from '../hooks/useIOSKeyboard';
import { startRoomCleanupScheduler } from '../utils/roomCleanup';
import '../utils/testRoomCleanup'; // 导入测试工具
import '../utils/fixRoomCreatorInfo'; // 导入修复工具
import '../utils/fixRoomExpiresAt'; // 补齐历史房间 expiresAt
import '../utils/backfillRoomExpiry'; // 暴露 backfill 脚本供控制台调用

type AppRoom = { id: string; name: string; type?: 'official'|'user'; visibility?: 'public'|'private'; ownerId?: string; creatorName?: string; icon?: string; createdAt?: number; createdAtFormatted?: string; ownerOfflineAt?: number | null; };
type Message = { authorId: string; authorName: string; type: 'text' | 'gif'; content: string; createdAt: number; };
type Profile = { uid: string; nickname: string; gender: 'male'|'female'; age: number; country: string; bio?: string; isGuest?: boolean; avatarUrl?: string; };
type ThreadMeta = { threadId: string; peerId: string; lastMsg?: string; lastSender?: string; lastTs?: number; unread?: number; };
type RoomMeta = { roomId: string; lastReadTs?: number; unread?: number; };

// 将 Inbox + Bell 移到中间锚点（仅移动端），桌面复原
function useMoveControlsOnMobile() {
  useEffect(() => {
    const inbox = document.getElementById('btnInbox');
    const bell = document.getElementById('btnBell');
    const mid = document.getElementById('midControlsAnchor');
    const right = document.getElementById('rightControls');
    if (!inbox || !bell || !mid || !right) return;
    const mql = window.matchMedia('(max-width: 768px)');
    const place = () => {
      if (mql.matches) {
        if (inbox.parentElement !== mid) mid.appendChild(inbox);
        if (bell.parentElement !== mid) mid.appendChild(bell);
      } else {
        if (inbox.parentElement !== right) right.insertBefore(inbox, right.firstChild);
        if (bell.parentElement !== right) right.insertBefore(bell, inbox.nextSibling);
      }
    };
    place();
    mql.addEventListener?.('change', place);
    return () => mql.removeEventListener?.('change', place);
  }, []);
}

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
    
    // 取消注释下面这行来运行数据修复（运行一次后删除此 useEffect）
    // fixRoomTypes();
  }, []); // 只运行一次

  // 房间/DM
  const [rooms, setRooms] = useState<AppRoom[]>([]);
  // 用户自定义屏蔽（全局/当前房）
  const { blockedSet: roomBlocked, setBlocked: setRoomBlocked, isBlocked: isRoomBlocked } = useRoomBlocks(uid, activeRoomId || undefined);
  const { blockedSet: globalBlocked } = useGlobalBlocks(uid);
  // 移除房间头部“Block”目标选择，改为消息/成员行内操作
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
  const [viewedProfile, setViewedProfile] = useState<Profile | null>(null);

  // 移动端控件重排（Inbox + Bell 移到侧栏按钮旁）
  useMoveControlsOnMobile();

  useEffect(() => {
    welcomeShownRef.current = false;
  }, [uid]);

  useEffect(() => {
    if (welcomeShownRef.current) return;

    const currentUid = uid || 'guest';
    const key = `cs_welcome_notice_v103_${currentUid}`;
    const message = "👋 Welcome to TalkiSphere — a place to connect, share, and have real conversations.\nPlease be respectful to others and help keep this space friendly.\nIf you ever encounter spam or inappropriate messages, you can use the Block or Kick options to protect yourself and the community.\nEnjoy your chat!";

    try {
      const already = sessionStorage.getItem(key);
      if (!already) {
        show(message, 'info', 6000);
        sessionStorage.setItem(key, '1');
        welcomeShownRef.current = true;
      }
    } catch {
      show(message, 'info', 6000);
      welcomeShownRef.current = true;
    }
  }, [show, uid]);

  // Inbox - DM threads (replaced by useInbox hook)
  // const [threads, setThreads] = useState<Record<string, ThreadMeta>>({});
  
  // Inbox - Room metadata (for unread tracking)
  const [roomsMeta, setRoomsMeta] = useState<Record<string, RoomMeta>>({});
  
  // 屏蔽和静音列表
  const [blocks, setBlocks] = useState<Record<string, boolean>>({});
  const [mutes, setMutes] = useState<Record<string, boolean>>({});

  // 已移除用户菜单状态（改为直接显示 Block 按钮）
  
  // 未读总数计算（已由 useInbox hook 处理）
  // const unreadTotal = useMemo(() => {
  //   // DM 未读数：排除当前活跃的 DM
  //   const dmUnread = Object.values(threads).reduce((s, t) => {
  //     if (t.threadId === dmId) return s;
  //     return s + (t.unread || 0);
  //   }, 0);
  //   
  //   // 房间未读数：排除当前活跃的房间
  //   const roomUnread = Object.values(roomsMeta).reduce((s, r: RoomMeta) => {
  //     if (r.roomId === currentRoomId) return s;
  //     return s + (r.unread || 0);
  //   }, 0);
  //   
  //   return dmUnread + roomUnread;
  // }, [threads, roomsMeta, dmId, currentRoomId]);
  

  // 提示音已由 Sound 统一管理
  const { muted } = useSoundToggle();
  
  // 已读状态管理
  const readStateHelpers = useReadState({ 
    activeRoomId: activeRoomId, 
    activeThreadId: dmId 
  });

  const focusComposerInput = useCallback(() => {
    composerControlRef.current?.focus();
  }, []);

  const closeSideSheet = useCallback(() => {
    document.documentElement.removeAttribute('data-sidebar');
  }, []);

  const handleDmOpened = useCallback(async (roomId: string, peer: { id: string; nickname?: string; profile?: Profile }) => {
    const profileFromList = peer.profile;
    const profileFromStore = profiles[peer.id];
    const resolvedProfile: Profile = profileFromStore
      || profileFromList
      || {
        uid: peer.id,
        nickname: peer.nickname || 'User',
        gender: 'male',
        age: 0,
        country: '',
      };

    setActiveRoomId(null);
    setDmId(roomId);
    setDmPeer(resolvedProfile);
    await readStateHelpers.markThreadRead(roomId);
  }, [profiles, readStateHelpers, setActiveRoomId]);

  const openDMViaHook = useOpenDM({
    onOpened: handleDmOpened,
    closeSideSheet,
    focusInput: focusComposerInput,
  });

  // 登录态 & 心跳
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
        
        // 启动房间清理调度器
        stopCleanup?.(); stopCleanup = startRoomCleanupScheduler();
      } else {
        // 用户登出：清理内存态，避免复用上一个用户的 profile
        setProfiles({});
      }
    });
    return () => { 
      off(); 
      stopHB?.(); 
      stopCleanup?.();
    };
  }, []);

  // Step 4: 严格按 uid 监听当前用户的 profile，避免跨用户污染
  useEffect(() => {
    if (!uid) return;
    
    const unsub = onValue(ref(db, `/profiles/${uid}`), (snap) => {
      const profileData = snap.val();
      if (profileData) {
        // 仅更新当前用户的 profile，不污染其他用户数据
        setProfiles(prev => ({ ...prev, [uid]: profileData }));
      }
    });
    
    return unsub;
  }, [uid]);

  // 房主在线状态绑定
  useEffect(() => {
    if (!uid) return;
    
    // 为当前用户作为房主的房间绑定在线状态
    const bindings = new Map<string, () => void>();
    
    const unsub = onValue(ref(db, '/rooms'), (snap) => {
      const val = snap.val() || {};
      
      // 清理旧的绑定
      bindings.forEach((cancel) => cancel());
      bindings.clear();
      
      // 为每个房间创建绑定
      Object.entries(val).forEach(([roomId, room]: [string, any]) => {
        // 检查房间 meta 中的 ownerId
        if (room.meta?.ownerId === uid && room.meta?.visibility !== 'official') {
          const roomRef = ref(db, `rooms/${roomId}/meta`);
          
          // 在线：清空 ownerOfflineAt
          update(roomRef, { ownerOfflineAt: null }).catch(() => {});
          
          // 断开：记录下线时间
          const disconnectHandlers = onDisconnect(roomRef);
          disconnectHandlers.update({ ownerOfflineAt: serverTimestamp() }).catch(() => {});
          
          const cleanup = () => {
            try { disconnectHandlers.cancel(); } catch {}
          };
          bindings.set(roomId, cleanup);
        }
      });
    });
    
    return () => {
      unsub();
      bindings.forEach((cancel) => cancel());
    };
  }, [uid]);

  // 房间列表
  useEffect(() => {
    const r = ref(db, '/rooms');
    return onValue(r, (snap) => {
      const val = snap.val() || {};
      const arr: AppRoom[] = Object.keys(val).map((k) => {
        const room = val[k];
        
        // 根据实际数据结构处理：rooms/{roomId}: { name, isOfficial?, visibility?, ownerId? }
        const isOfficial = room.isOfficial === true;
        const visibility = room.visibility || 'public';
        
        return {
          id: k,
          name: room.name || 'Unnamed Room',
          type: room.type || (isOfficial ? 'official' : 'user'),
          visibility: visibility,
          ownerId: room.ownerId,
          creatorName: room.creatorName,
          icon: room.icon || '💬',
          createdAt: room.createdAt,
          createdAtFormatted: room.createdAtFormatted,
          ownerOfflineAt: room.ownerOfflineAt
        };
      });
      arr.sort((a, b) => {
        const ra = a.type === 'official' ? 0 : 1;
        const rb = b.type === 'official' ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
      setRooms(arr);
    });
  }, [dmId]); // 移除 currentRoomId 依赖，避免循环

  // 房间成员列表 - 使用增量更新
  useEffect(() => {
    if (!activeRoomId || !uid) return;
    
    const stop = watchRoomMembers(activeRoomId, (members) => {
      setRoomMembers(members.map(m => m.uid));
    });
    
    return stop;
  }, [activeRoomId, uid]);

  // 入场控制监听：只在当前房间监听成员身份和封禁状态 + 去抖
  const leftOnceRef = useRef(false);
  
  useEffect(() => {
    if (!activeRoomId || !uid || dmId) return; // 不在房间视图时跳过
    
    // 重置防重复触发标志
    leftOnceRef.current = false;
    
    const memberRef = ref(db, `roomMembers/${activeRoomId}/${uid}`);
    const banRef = ref(db, `rooms/${activeRoomId}/bans/${uid}`);

    // 只在"从在场 -> 不在场 / 被ban"时提示并退出
    let prevIsMember = true;

    const off1 = onValue(memberRef, snap => {
      const isMember = !!snap.val();
      if (prevIsMember && !isMember && !leftOnceRef.current) {
        leftOnceRef.current = true;
        show('You have been removed from this room.', 'error', 2000);
        navigate('/home'); // 离开房间
        setMessages([]); // 清空消息
      }
      prevIsMember = isMember;
    });

    const off2 = onValue(banRef, snap => {
      if (snap.exists() && !leftOnceRef.current) {
        leftOnceRef.current = true;
        show('You have been banned from this room.', 'error', 2000);
        navigate('/home'); // 离开房间
        setMessages([]); // 清空消息
      }
    });

    return () => { off1(); off2(); };
  }, [activeRoomId, uid, dmId, show, navigate]);

  // 屏蔽和静音列表
  useEffect(() => {
    if (!uid) return;
    const blocksRef = ref(db, `blocks/${uid}`);
    const mutesRef = ref(db, `mutes/${uid}`);
    
    const offBlocks = onValue(blocksRef, (snap) => {
      setBlocks(snap.val() || {});
    });
    
    const offMutes = onValue(mutesRef, (snap) => {
      setMutes(snap.val() || {});
    });
    
    return () => {
      offBlocks();
      offMutes();
    };
  }, [uid]);

  // 管理员权限检查
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    if (!uid) return;
    
    const checkAdmin = async () => {
      try {
        const rolesSnap = await get(ref(db, `roles/${uid}/isAdmin`));
        setIsAdmin(rolesSnap.exists() && rolesSnap.val() === true);
      } catch (e) {
        setIsAdmin(false);
      }
    };
    
    checkAdmin();
    
    const unsub = onValue(ref(db, `roles/${uid}/isAdmin`), (snap) => {
      setIsAdmin(snap.exists() && snap.val() === true);
    });
    
    return () => unsub();
  }, [uid]);

  // 定期检查并自动关闭离线超过1小时的房间（管理员权限）
  useEffect(() => {
    if (!isAdmin) return;
    
    const OFF_MS = 60 * 60 * 1000; // 1 小时
    const roomsRef = ref(db, 'rooms');
    
    const checkInterval = setInterval(async () => {
      try {
        const snap = await get(roomsRef);
        if (!snap.exists()) return;
        
        const now = Date.now();
        const rooms = snap.val() || {};
        
        for (const [roomId, r] of Object.entries<any>(rooms)) {
          // 跳过官方房间
          if (r.type === 'official' || !r.ownerId || !r.ownerOfflineAt) continue;
          
          // 解析 ownerOfflineAt
          let offlineAt = 0;
          if (typeof r.ownerOfflineAt === 'number') {
            offlineAt = r.ownerOfflineAt;
          } else if (r.ownerOfflineAt?.seconds) {
            offlineAt = r.ownerOfflineAt.seconds * 1000;
          } else if (r.ownerOfflineAt?._seconds) {
            offlineAt = r.ownerOfflineAt._seconds * 1000;
          }
          
          if (!offlineAt) continue;
          
          const expired = now - offlineAt > OFF_MS;
          
          // 检查房主是否仍然在线
          let isOwnerOnline = false;
          try {
            const ownerPresenceSnap = await get(ref(db, `presence/${r.ownerId}/state`));
            isOwnerOnline = ownerPresenceSnap.exists() && ownerPresenceSnap.val() === 'online';
          } catch {}
          
          if (expired && !isOwnerOnline) {
            // 发送系统通知给所有成员
            try {
              const memSnap = await get(ref(db, `roomMembers/${roomId}`));
              const members = memSnap.exists() ? Object.keys(memSnap.val()) : [];
              const text = `Room "${r.name}" was auto-closed (owner offline > 1h).`;
              
              await Promise.all(members.map(uid =>
                push(ref(db, `notifications/${uid}`), {
                  type: 'system',
                  text,
                  ts: Date.now(),
                })
              ));
            } catch {}
            
            // 删除房间及相关数据
            await remove(ref(db, `rooms/${roomId}`));
            await remove(ref(db, `messages/${roomId}`));
            await remove(ref(db, `roomMembers/${roomId}`));
            
            console.log(`Admin: Deleted room "${r.name}" (owner offline > 1h)`);
          }
        }
      } catch (e) {
        console.error('Auto-cleanup error:', e);
      }
    }, 60 * 1000); // 每分钟检查一次
    
    return () => clearInterval(checkInterval);
  }, [isAdmin]);

  // 朋友列表
  const [friends, setFriends] = useState<Record<string, true>>({});
  
  const subscribedUsersRef = useRef<Set<string>>(new Set());

  // 清理已订阅用户列表（当切换账号时）
  useEffect(() => {
    subscribedUsersRef.current.clear();
  }, [uid]);

  // Step 4b: 为在线用户和朋友加载 profiles（避免全局订阅污染，但保证用户信息完整）
  useEffect(() => {
    const onlineUserIds = Object.keys(presence).filter(
      k => presence[k]?.state === 'online' && k !== uid
    );
    const friendIds = Object.keys(friends);
    
    // 合并要加载的用户 ID（去重）
    const userIdsToLoad = Array.from(new Set([...onlineUserIds, ...friendIds]));

    if (userIdsToLoad.length === 0) return;

    // 批量加载这些用户的 profile
    const unsubscribes: Array<() => void> = [];
    
    userIdsToLoad.forEach(userId => {
      // 只订阅还没有缓存的用户（用 ref 追踪，避免重复订阅）
      if (!subscribedUsersRef.current.has(userId)) {
        subscribedUsersRef.current.add(userId);
        
        // Step 1: 快速初始加载 (get) - 立即拿到数据，避免 fallback
        (async () => {
          try {
            const snap = await get(ref(db, `/profiles/${userId}`));
            if (snap.exists()) {
              setProfiles(prev => ({ ...prev, [userId]: snap.val() }));
            }
          } catch (e) {
            console.warn(`Failed to fetch profile ${userId}:`, e);
          }
        })();
        
        // Step 2: 订阅后续变化 (onValue) - 持续监听更新
        const unsub = onValue(ref(db, `/profiles/${userId}`), (snap) => {
          const profileData = snap.val();
          if (profileData) {
            setProfiles(prev => ({ ...prev, [userId]: profileData }));
          }
        });
        unsubscribes.push(unsub);
      }
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [presence, friends, uid]);
  
  // 资料/在线/我的线程/房间元数据/朋友/屏蔽/静音
  useEffect(() => {
    const off1 = onValue(ref(db, '/presence'), (s) => setPresence(s.val() || {}));
    // Step 4修复: 删除全局 /profiles 订阅，改由专门的 useEffect 按 uid 监听
    // const off2 = onValue(ref(db, '/profiles'), (s) => setProfiles(s.val() || {}));
    const off2 = () => {}; // 不再订阅全局 profiles
    const off3 = uid ? () => {} : () => {}; // DM threads now handled by useInbox hook
    const off4 = uid ? onValue(ref(db, `/roomsMeta/${uid}`), (s) => setRoomsMeta(s.val() || {})) : () => {};
    const off5 = uid ? onValue(ref(db, `/friends/${uid}`), (s) => setFriends(s.val() || {})) : () => {};
    const off6 = uid ? onValue(ref(db, `/blocks/${uid}`), (s) => setBlocks(s.val() || {})) : () => {};
    const off7 = uid ? onValue(ref(db, `/mutes/${uid}`), (s) => setMutes(s.val() || {})) : () => {};
    return () => { off1(); off2(); off3(); off4(); off5(); off6(); off7(); };
  }, [uid]);

  // ★ 使用共享逻辑计算在线用户列表（Desktop 和 Mobile 统一）
  const onlineUsers = useOnlineUsers(presence, profiles, genderFilter, uid);
  const _onlineCount = useOnlineCount(presence, uid);

  // 朋友列表（从 profiles 中筛选）
  const friendsList = useMemo(() => {
    return Object.keys(friends).map(friendId => profiles[friendId]).filter(Boolean) as Profile[];
  }, [friends, profiles]);

  // 活跃会话 ID（用于排除未读计数）
  const activeThreadId = dmId;
  
  // 订阅消息 + 声音 + 自动滚底 + 未读计数
  const prevCountRef = useRef<number>(0);
  const lastMsgIdRef = useRef<string>('');
  
  useEffect(() => {
    let off: (() => void) | null = null;
    if (dmId) {
      const q = query(ref(db, `/dmMessages/${dmId}`), orderByChild('createdAt'), limitToLast(200));
      off = onValue(q, async (snap) => {
        const val = snap.val() || {};
        const arr: Message[] = Object.keys(val).map((k) => val[k]).sort((a,b) => (a.createdAt||0)-(b.createdAt||0));
        
        // 检查新消息并增加未读数（仅对当前用户，且非活跃会话）
        if (arr.length > 0 && arr[arr.length-1].authorId !== uid && dmId !== '' && dmId !== activeThreadId) {
          // 检查基线：只统计 lastReadTs 之后的消息
          try {
            const tMeta = await get(ref(db, `dmThreads/${uid}/${dmId}`));
            const lastReadTs = tMeta.exists() && tMeta.val()?.lastMsgTs 
              ? (typeof tMeta.val().lastMsgTs === 'number' ? tMeta.val().lastMsgTs : Date.now())
              : Date.now();
            
            const lastMsg = arr[arr.length-1];
            if (lastMsg.createdAt && lastMsg.createdAt <= lastReadTs) {
              // 旧消息不计未读
              return;
            }
          } catch {}
          
          const lastMsgId = Object.keys(val).sort((a, b) => (val[a].createdAt || 0) - (val[b].createdAt || 0))[arr.length-1];
          if (lastMsgId !== lastMsgIdRef.current) {
            await incrementThreadUnread(dmId, arr[arr.length-1].createdAt);
            lastMsgIdRef.current = lastMsgId;
          }
        }
        
        if (prevCountRef.current && arr.length > prevCountRef.current) {
          const last = arr[arr.length-1];
          if (last.authorId !== uid && !muted) {
            Sound.play('ding');
          }
        }
        prevCountRef.current = arr.length;
        setMessages(arr);

        // 正在查看该 DM：持续将未读与 Inbox 聚合清零
        try {
          if (dmId) {
            await readStateHelpers.markThreadRead(dmId);
          }
        } catch {}
      });
    } else if (activeRoomId) {
      const q = query(ref(db, `/messages/${activeRoomId}`), orderByChild('createdAt'), limitToLast(200));
      off = onValue(q, async (snap) => {
        const val = snap.val() || {};
        const arr: Message[] = Object.keys(val).map((k) => val[k]).sort((a,b) => (a.createdAt||0)-(b.createdAt||0));
        
        // 检查新消息并增加未读数（仅对当前用户，且非活跃会话）
        if (arr.length > 0 && arr[arr.length-1].authorId !== uid && activeRoomId) {
          // 检查基线：只统计 lastReadTs 之后的消息
          try {
            const rMeta = await get(ref(db, `roomsMeta/${uid}/${activeRoomId}`));
            const lastReadTs = rMeta.exists() && rMeta.val()?.lastReadTs 
              ? (typeof rMeta.val().lastReadTs === 'number' ? rMeta.val().lastReadTs : Date.now())
              : Date.now();
            
            const lastMsg = arr[arr.length-1];
            if (lastMsg.createdAt && lastMsg.createdAt <= lastReadTs) {
              // 旧消息不计未读
              return;
            }
          } catch {}
          
          const lastMsgId = Object.keys(val).sort((a, b) => (val[a].createdAt || 0) - (val[b].createdAt || 0))[arr.length-1];
          if (lastMsgId !== lastMsgIdRef.current) {
            await incrementRoomUnread(activeRoomId);
            lastMsgIdRef.current = lastMsgId;
          }
        }
        
        setMessages(arr);

        // 新消息提示音（房间内）
        try {
          if (prevCountRef.current && arr.length > prevCountRef.current) {
            const last = arr[arr.length-1];
            if (last.authorId !== uid && !muted) {
              Sound.play('ding');
            }
          }
        } catch {}
      });
    } else {
      setMessages([]);
    }
    return () => { off && off(); };
  }, [activeRoomId, dmId, uid, muted]);

  // 消息列表滚动控制（移动端稳固回底部）
  const listRef = useRef<HTMLDivElement | null>(null);
  const composerWrapRef = useRef<HTMLDivElement | null>(null);
  const composerControlRef = useRef<ComposerRef | null>(null);
  const endAnchorRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [composerHeight, setComposerHeight] = useState(64);
  useKeyboardInset();
  useKeyboardOffset();
  useIOSKeyboardVar();
  const padBottom = useMemo(() => `calc(${composerHeight}px + var(--kb, 0px) + var(--sab, 0px) + 12px)`, [composerHeight]);
  const welcomeShownRef = useRef(false);

  // 监听滚动，判断是否接近底部（阈值 80px）
  const isNearBottom = (el: HTMLElement) => {
    const st = Math.max(0, el.scrollTop);
    const gap = Math.max(0, el.scrollHeight - st - el.clientHeight);
    return gap < 120; // 提高容差，避免轻微抖动导致误判
  };

  const scrollToBottomHard = () => {
    const el = listRef.current;
    if (!el) return;
    const doScroll = () => { el.scrollTop = el.scrollHeight; };
    // 多次触发确保在布局与图片加载后仍能到达底部
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 0);
    setTimeout(doScroll, 50);
  };
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setStickToBottom(isNearBottom(el));
    if (el.scrollTop <= 0) {
      // 这里可触发历史分页
    }
  };

  // 新消息到达时：若“黏底”或是我自己发的，就滚到底（避免打断查看历史）
  // 热修复：无条件把滚动条拉到底，先消除“向上滚”的现象
  useEffect(() => {
    scrollToBottomHard();
  }, [messages.length]);

  useLayoutEffect(() => {
    const update = () => {
      const next = composerWrapRef.current?.offsetHeight ?? 64;
      setComposerHeight(next);
      if (stickToBottom) scrollToBottomHard();
    };
    update();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && composerWrapRef.current) {
      ro = new ResizeObserver(update);
      ro.observe(composerWrapRef.current);
    }

    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [stickToBottom]);

  // 针对图片/GIF延迟加载导致高度变化，补一次滚动
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const imgs = el.querySelectorAll<HTMLImageElement>('img');
    let pending = 0;
    const tryScroll = () => {
      if (pending === 0 && stickToBottom) scrollToBottomHard();
    };
    imgs.forEach((img) => {
      if (!img.complete) {
        pending++;
        img.addEventListener('load', () => { pending--; tryScroll(); }, { once: true });
        img.addEventListener('error', () => { pending--; tryScroll(); }, { once: true });
      }
    });
    if (pending === 0 && stickToBottom) scrollToBottomHard();
  }, [messages.length, stickToBottom]);

  // iOS 键盘弹起：使用 visualViewport 变化时保持黏底
  useEffect(() => {
    const vv: any = (window as any).visualViewport;
    if (!vv) return;
    const onResize = () => {
      const el = listRef.current;
      if (!el) return;
      if (stickToBottom) scrollToBottomHard();
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize); };
  }, [stickToBottom]);

  // 移除重复滚动逻辑，避免与主滚动策略互相干扰

  const formatMsgTime = (timestamp?: number | string) => {
    if (!timestamp) return '';
    const numeric = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
    if (!numeric || Number.isNaN(numeric)) return '';
    const d = dayjs(numeric);
    if (!d.isValid()) return '';
    const now = dayjs();
    if (d.isSame(now, 'day')) return d.format('HH:mm');
    if (d.isSame(now.subtract(1, 'day'), 'day')) return `昨天 ${d.format('HH:mm')}`;
    return d.format('MM/DD HH:mm');
  };

  // 房间/DM 操作
  const createRoom = () => {
    setShowCreateModal(true);
  };

  // 处理房间邀请
  const handleAcceptInvite = async (roomId: string, inviteId: string) => {
    try {
      // 使用原子操作接受邀请并删除 inbox 消息
      await acceptInvite(roomId, uid, inviteId);
      show('Joined room successfully', 'success', 1500);
      
      // 使用 selectRoom 函数来切换到新加入的房间
      // selectRoom 会自动清理DM状态并加入房间
      await selectRoom(roomId);
    } catch (e: any) {
      if (e.message === 'banned') {
        show('You are banned from this room', 'error', 2000);
      } else {
        show('Failed to join room', 'error', 1500);
      }
    }
  };

  const handleDeclineInvite = async (roomId: string, inviteId: string) => {
    try {
      // 使用原子操作拒绝邀请并删除 inbox 消息
      await declineInvite(roomId, uid, inviteId);
      show('Invitation declined', 'info', 1000);
    } catch (e) {
      console.error('Failed to decline invite:', e);
    }
  };

  const handleRoomCreated = (roomId: string) => {
    setDmId('');
    setDmPeer(null);
    navigate(`/r/${roomId}`);
  };

  const openDM = useCallback(async (peer: Profile | null, threadId?: string) => {
    try {
      let target = peer;

      if (!target && threadId) {
      const parts = threadId.split('__');
        const otherId = uid === parts[0] ? parts[1] : parts[0];
        const fetched = profiles[otherId];
        target = fetched || {
          uid: otherId,
          nickname: fetched?.nickname || otherId,
          gender: (fetched?.gender as 'male' | 'female') || 'male',
          age: fetched?.age ?? 0,
          country: fetched?.country ?? '',
        };
      }

      if (!target || !uid || target.uid === uid) return;

      const threadKey = target.uid < uid ? `${target.uid}__${uid}` : `${uid}__${target.uid}`;
      const success = await openDMViaHook({
        id: target.uid,
        nickname: target.nickname,
        profile: target,
      });
      if (success) return;

      closeSideSheet();
      setActiveRoomId(null);
      setDmId(threadKey);
      setDmPeer(target);
      await readStateHelpers.markThreadRead(threadKey);
      focusComposerInput();
    } catch (e) {
      console.error('Failed to open DM:', e);
    }
  }, [openDMViaHook, profiles, uid, closeSideSheet, setActiveRoomId, readStateHelpers, focusComposerInput]);

  const handleOpenProfile = useCallback((userId: string) => {
    const profile = profiles[userId];
    if (!profile) {
      show('User profile not found.', 'info', 1200);
      return;
    }
    closeSideSheet();
    setViewedProfile(profile);
  }, [profiles, closeSideSheet, show]);

  // 进入房间时：读取房间类型与过期时间；仅对用户房间启用拦截
  useEffect(() => {
    if (!activeRoomId) return;
    const r = ref(db, `rooms/${activeRoomId}`);
    const off = onValue(r, (snap) => {
      const v = snap.val();
      if (!v) { show('This room was removed.', 'info'); navigate('/home', { replace: true }); return; }
      const isUser = v?.type === 'user';
      setIsUserRoom(!!isUser);
      if (isUser && typeof v.expiresAt === 'number') {
        setRemaining(v.expiresAt - Date.now());
      } else {
        setRemaining(null);
      }
      const expired = isUser && typeof v.expiresAt === 'number' && Date.now() >= v.expiresAt;
      if (v.status === 'expired' || expired) {
        show('This user-created room has expired.', 'warning');
        navigate('/home', { replace: true });
      }
    });
    return () => off();
  }, [activeRoomId, navigate, show]);

  // 每秒刷新倒计时
  useEffect(() => {
    if (!isUserRoom) return;
    const timer = window.setInterval(() => {
      setRemaining((prev) => (prev === null ? null : prev - 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isUserRoom]);

  // 到期自动退出
  useEffect(() => {
    if (!isUserRoom) return;
    if (remaining !== null && remaining <= 0) {
      show('Room expired. Returning to home...', 'info');
      navigate('/home', { replace: true });
    }
  }, [isUserRoom, remaining, navigate, show]);

  // 简易移动端侧栏开关（不侵入现有状态）
  useEffect(() => {
    const btn = document.getElementById('mobile-open-sidebar');
    if (!btn) return;

    const open = () => document.documentElement.setAttribute('data-sidebar', 'open');
    const close = (ev: MouseEvent) => {
      if (document.documentElement.getAttribute('data-sidebar') !== 'open') return;
      const sidebar = document.getElementById('sidebar');
      const target = ev.target as Node | null;
      if (!target) return;
      const isBtn = (ev.target as HTMLElement).id === 'mobile-open-sidebar';
      const insideSidebar = !!sidebar && sidebar.contains(target);
      if (!isBtn && !insideSidebar) {
        document.documentElement.removeAttribute('data-sidebar');
      }
    };

    btn.addEventListener('click', open);
    document.addEventListener('click', close);

    return () => {
      btn.removeEventListener('click', open);
      document.removeEventListener('click', close);
    };
  }, []);

  const confirmLeaveIfAboutToExpire = (cb: () => void) => {
    if (!isUserRoom || remaining === null) return cb();
    if (remaining < 5 * 60 * 1000) {
      const ok = window.confirm(`This room will close in ${Math.ceil(remaining / 60000)} minutes.\nDo you still want to leave?`);
      if (!ok) return;
    }
    cb();
  };

  // Step 6: 登出时清理缓存
  const handleLogout = async () => {
    // 清理所有 cs.profile.* 缓存
    Object.keys(localStorage)
      .filter(k => k.startsWith('cs.profile.'))
      .forEach(k => localStorage.removeItem(k));
    
    // 清理其他全局缓存
    try { localStorage.removeItem('nickname'); } catch {}
    try { localStorage.removeItem('guestName'); } catch {}
    
    // 执行登出
    await signOut(auth);
  };

  const selectRoom = async (rid: string) => {
    setDmId('');
    setDmPeer(null);
    
    // 使用 navigate 而不是直接设置状态（切换前二次确认）
    confirmLeaveIfAboutToExpire(() => navigate(`/r/${rid}`));
    
    // 确保用户加入房间成员列表
    if (uid && rid) {
      try {
        await joinRoom(rid, uid);
        await readStateHelpers.markRoomRead(rid);
      } catch (e: any) {
        if (e.message === 'banned') {
          show('You are banned from this room.', 'error', 2000);
          navigate('/home'); // 被ban时回到首页
        } else {
          console.error('Failed to join room:', e);
        }
      }
    }
  };

  // 判定函数更健壮：基于名称白名单 + 类型标记
  const OFFICIAL_NAMES = new Set([
    'coffee corner',
    'global traveler',
    'late night talk',
    'wellness hub',
    'developer lab',
  ]);

  const isOfficial = (r: AppRoom) => {
    // 统一使用 type 字段判断，与房间数据处理逻辑保持一致
    return r?.type === 'official';
  };

  // 进入房间前置校验（private 要求成员资格/邀请）
  const tryEnterRoom = async (r: AppRoom) => {
    // 进入用户房间时，自动收起官方和用户房间菜单
    if (r.type !== 'official') {
      try {
        window.dispatchEvent(new CustomEvent('cs:set', { detail: { id: 'official', open: false } }));
        window.dispatchEvent(new CustomEvent('cs:set', { detail: { id: 'userRooms', open: false } }));
        window.dispatchEvent(new CustomEvent('cs:set', { detail: { id: 'friends', open: false } }));
        window.dispatchEvent(new CustomEvent('cs:set', { detail: { id: 'online', open: false } }));
      } catch {}
    }

    if (r.visibility !== 'private') return selectRoom(r.id);
    if (!auth.currentUser) { show('Please log in to join private rooms.', 'warning', 1400); return; }
    try {
      const mem = await get(ref(db, `roomMembers/${r.id}/${uid}`));
      if (!mem.exists()) { show('Private room: invitation required.', 'info', 1400); return; }
      await selectRoom(r.id);
    } catch (e) {
      console.error('Failed to check room membership:', e);
    }
  };

  // 我的资料（供 Header / Modal 用）
  const myProfile = profiles[uid];

  // 检查是否是当前房间的房主
  const currentRoom = rooms.find(r => r.id === activeRoomId);
  const isRoomOwner = currentRoom && currentRoom.ownerId === uid;

  return (
    <div className="h-[100svh] w-full text-white relative overflow-hidden flex flex-col">
      <Header
        unreadTotal={inboxUnreadCount}
        onToggleInbox={() => {}}
        currentProfile={myProfile ? { ...myProfile, uid } : undefined}
        onLogout={handleLogout}
        inboxContent={
          <InboxPopover
            inboxItems={inboxItems}
            profiles={profiles}
            rooms={rooms as any}
            onOpenDM={(peer, threadId) => openDM(peer, threadId)}
            onAcceptInvite={handleAcceptInvite}
            onDeclineInvite={handleDeclineInvite}
            onMarkAllRead={markAllInboxAsRead}
            onClearInbox={clearInboxItems}
          />
        }
      />

      {/* 移动端广告条 —— 只在手机显示 */}
      <div className="block md:hidden w-full bg-black/30 px-3 py-2">
        <div className="h-11 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_6px_24px_rgba(0,0,0,.25)] flex items-center justify-center">
          <span className="text-sm text-zinc-200/90">Ad — Top Banner</span>
        </div>
      </div>

      <div id="app-shell" className="flex-1 flex flex-col min-h-0">
        <div className="max-w-[1400px] mx-auto flex gap-4 pt-2 md:pt-3 pb-3 flex-1 min-h-0 w-full">
        {/* 左侧栏（桌面常驻） */}
        <aside id="sidebar" className="w-[280px] shrink-0 h-full overflow-y-auto">
          <div id="sidebar-brand" className="sidebar-brand px-4 py-4 flex items-center gap-3">
            <Logo size={30} />
            <span className="text-lg font-semibold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300">TalkiSphere</span>
          </div>
          {/* Online统计 - 在OFFICIAL ROOMS之前 */}
          <div className="px-4 py-2 text-white/70 text-sm mb-2">
            Online: {onlineUsers.length} users
            </div>

          {/* ① Official Rooms */}
          <CollapseSection id="official" title="Official Rooms">
            {officialRooms.map((r) => (
                  <button
                    key={r.id}
                onClick={() => tryEnterRoom(r as any)}
                className="w-full h-[54px] rounded-2xl border border-white/10 bg-black/40 hover:bg-white/10
                            flex items-center gap-3 px-4 transition-all"
                style={!dmId && activeRoomId === r.id ? { background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.3), rgba(147, 51, 234, 0.3))', borderColor: 'rgba(129, 140, 248, 0.2)' } : {}}
              >
                <span className="text-lg">{r.icon || '💬'}</span>
                      <span className="font-medium">{r.name}</span>
              </button>
            ))}
          </CollapseSection>

          {/* ② Friends */}
          <CollapseSection id="friends" title={`Friends (${friendsList.length})`} defaultOpen={false}>
            {friendsList.length === 0 ? (
              <div className="text-white/60 mt-2 text-sm px-1">No friends yet. Add people from the Online Users list.</div>
            ) : (
              <div className="space-y-2">
                {friendsList.map((f) => (
                  <FriendRow
                    key={f.uid}
                    user={{
                      uid: f.uid,
                      nickname: f.nickname,
                      age: f.age,
                      gender: f.gender,
                      country: f.country,
                    }}
                    onOpenDM={(user) => {
                      const profile = profiles[user.uid] || {
                        uid: user.uid,
                        nickname: user.nickname,
                        age: user.age ?? 0,
                        gender: (user.gender as 'male' | 'female') ?? 'male',
                        country: user.country ?? '',
                      };
                      openDM(profile);
                      // Close sidebar on mobile after selecting user
                      document.documentElement.removeAttribute('data-sidebar');
                      // Close Online Users menu after selecting user
                      // Use setTimeout to ensure event is dispatched after openDM
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('cs:set', { detail: { id: 'online', open: false } }));
                      }, 0);
                    }}
                    onOpenProfile={handleOpenProfile}
                  />
                ))}
              </div>
            )}
          </CollapseSection>

          {/* ③ User Created Rooms */}
          <CollapseSection id="userRooms" title="User Created Rooms">
            {userRooms.map((r) => (
                  <button
                    key={r.id}
                onClick={() => tryEnterRoom(r as any)}
                className="w-full h-[54px] rounded-2xl border border-white/10 bg-black/30 hover:bg-white/10
                            flex items-center justify-between px-4 transition-all"
                style={!dmId && activeRoomId === r.id ? { background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.3), rgba(147, 51, 234, 0.3))', borderColor: 'rgba(129, 140, 248, 0.2)' } : {}}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{r.icon || (r.visibility === 'private' ? '🔒' : '💬')}</span>
                      <span className="font-medium">{r.name}</span>
                    </div>
                <span className="text-[11px] text-white/50">{r.visibility}</span>
                  </button>
                ))}
          </CollapseSection>

          {/* ④ Online Users */}
          <CollapseSection id="online" title={`Online: ${onlineUsers.length} users`}>
            <div className="flex gap-2">
              <button className={`px-2 py-1 rounded ${genderFilter === 'all' ? 'bg-white/20' : 'bg-white/10'}`} onClick={() => setGenderFilter('all')}>all</button>
              <button className={`px-2 py-1 rounded ${genderFilter === 'male' ? 'bg-white/20' : 'bg-white/10'}`} onClick={() => setGenderFilter('male')}>male</button>
              <button className={`px-2 py-1 rounded ${genderFilter === 'female' ? 'bg-white/20' : 'bg-white/10'}`} onClick={() => setGenderFilter('female')}>female</button>
            </div>
            <div className="space-y-2">
                  {onlineUsers.map((p) => (
                <FriendRow
                  key={p.uid}
                  user={{
                    uid: p.uid,
                    nickname: p.nickname,
                    age: p.age,
                    gender: p.gender,
                    country: p.country,
                  }}
                  onOpenDM={(user) => {
                    const profile = profiles[user.uid] || {
                      uid: user.uid,
                      nickname: user.nickname,
                      age: user.age ?? 0,
                      gender: (user.gender as 'male' | 'female') ?? 'male',
                      country: user.country ?? '',
                    };
                    openDM(profile);
                    // Close sidebar on mobile after selecting user
                    document.documentElement.removeAttribute('data-sidebar');
                    // Close Online Users menu after selecting user
                    // Use setTimeout to ensure event is dispatched after openDM
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('cs:set', { detail: { id: 'online', open: false } }));
                    }, 0);
                  }}
                  onOpenProfile={handleOpenProfile}
                />
              ))}
              {!onlineUsers.length && <div className="text-sm text-white/60">Nobody online yet.</div>}
            </div>
          </CollapseSection>

          {/* Create Room Button */}
          <div className="px-3 mt-4">
            {auth.currentUser?.isAnonymous ? (
              <button
                disabled
                title="Only registered users can create rooms"
                className="w-full h-11 rounded-2xl bg-neutral-900/70 border border-white/10 text-white/85 cursor-not-allowed"
              >
                + Create Room
              </button>
            ) : (
                <button
                  onClick={createRoom}
                className="w-full h-11 rounded-2xl transition-all font-medium bg-gradient-to-r from-teal-500/70 to-indigo-500/70 hover:from-teal-500 hover:to-indigo-500"
                >
                  + Create Room
                </button>
            )}
              </div>
        </aside>

        {/* 移动抽屉已移除以恢复桌面布局稳定 */}

        {/* 中间聊天区 */}
        <section id="chat-main" className="flex-1 min-w-0 min-h-0 rounded-2xl border border-white/10 bg-black/40 backdrop-blur flex flex-col h-full">
          {/* 标题行（房间或 DM 标题） */}
          <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between shrink-0 relative">
            {!dmId ? (
            <div className="flex items-center gap-2">
              <div className="text-lg">
                  {currentRoom?.icon || 
                   (currentRoom?.type === 'official' ? '🌙' :
                   (currentRoom as any)?.visibility === 'private' ? '🔒' : '💬')}
                </div>
                <div className="flex flex-col">
                  <div className="font-semibold">
                    {currentRoom?.name || 'TalkiSphere'}
                  </div>
                  {currentRoom && (
                    <div className="text-xs text-white/60">
                      Created by {(currentRoom as any).creatorName || 'Unknown'} • {(currentRoom as any).createdAtFormatted || ((currentRoom as any).createdAt ? new Date((currentRoom as any).createdAt).toLocaleString() : 'Unknown time')}
                    </div>
                  )}
          </div>
            </div>
                   ) : (
                     <>
                       <div className="flex items-center gap-2">
                         <div className="text-lg">💬</div>
                         <div className="font-semibold">DM with {dmPeer?.nickname || 'User'}</div>
                         <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/30 text-white/70">Private</span>
                       </div>
                       {/* Block 按钮（直接显示） */}
                       {dmPeer && (
                  <button
                           onClick={async () => {
                             if (blocks[dmPeer.uid]) {
                               const { unblockUser } = await import('../lib/social');
                               await unblockUser(dmPeer.uid);
                               show('Unblocked', 'success', 900);
                             } else {
                               const { blockUser } = await import('../lib/social');
                               await blockUser(dmPeer.uid);
                               show('Blocked', 'info', 900);
                             }
                           }}
                           className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition 
                             ${blocks[dmPeer.uid]
                               ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25'
                               : 'bg-white/10 hover:bg-white/20 text-white'}`}
                           title={blocks[dmPeer.uid] ? 'Unblock this user' : 'Block this user'}
                         >
                           {blocks[dmPeer.uid] ? '🔓' : '🚫'}
                           {blocks[dmPeer.uid] ? 'Unblock' : 'Block'}
                  </button>
                       )}
                     </>
                   )}

            {/* Actions (only for rooms, not DMs) */}
            {!dmId && activeRoomId && (
              <div className="flex gap-2 items-center">
                  <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-sm text-white transition-colors"
                  title="Invite users to this room"
                  >
                  Invite
                  </button>
                {isRoomOwner && (
                  <button
                    onClick={() => setShowMembersSheet(true)}
                    className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-400 text-sm text-white transition-all hover:from-cyan-500 hover:to-violet-500"
                    title="Manage members"
                  >
                    Members
                  </button>
                  )}
                </div>
            )}
          </div>

          {/* 用户房间剩余时间提示条 */}
          {isUserRoom && remaining !== null && remaining > 0 && (
            <div
              className="text-center text-xs sm:text-sm py-1.5 border-b border-white/10 bg-white/10 text-white/90"
            >
              {`This room will close in ${Math.ceil(remaining / 60000)} minutes`}
            </div>
          )}

          {/* 消息滚动区（占满剩余空间） */}
          <div
            id="chat-scroll"
            className="chat-scroll messages-container flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3 pr-2 pb-[120px]"
            ref={listRef}
            onScroll={onScroll}
            data-chat-scroll="1"
            style={{ scrollPaddingBottom: padBottom }}
          >
            {messages
              .filter((m) => {
                if (m.authorId === uid) return true;
                if (globalBlocked.has(m.authorId)) return false; // 全局屏蔽
                if (roomBlocked.has(m.authorId)) return false;   // 本房屏蔽
                if (blocks[m.authorId]) return false;            // 旧版 blocks 兼容
                if (mutes[m.authorId]) return false;
                return true;
              })
              .map((m, idx) => {
              const mine = m.authorId === uid;
              const timeLabel = formatMsgTime(m.createdAt);
              return (
                <div key={idx} className={`w-full flex ${mine ? 'justify-end' : 'justify-start'} mb-2.5`}>
                  <div className={`relative max-w-[70%] ${mine ? 'items-end text-right' : ''} group`}>
                    {!mine && <div className="text-xs text-white/60 mb-1">{m.authorName}</div>}
                {m.type === 'gif' ? (
                      <div className={`relative inline-block ${mine ? 'ml-auto' : ''}`}>
                        <img
                          src={m.content}
                          alt="gif"
                          className="rounded-2xl max-h-[280px]"
                          onLoad={() => {
                            setTimeout(() => {
                              const el = listRef.current as HTMLElement | null;
                              if (!el) return;
                              const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
                              if (dist <= 120) el.scrollTop = el.scrollHeight;
                            }, 30);
                          }}
                        />
                        {timeLabel && (
                          <span className="absolute bottom-2 right-3 text-[10px] text-white/80 bg-black/40 backdrop-blur px-2 py-0.5 rounded-full">
                            {timeLabel}
                          </span>
                        )}
                      </div>
                    ) : (
                      mine ? (
                        <div className="px-3 py-2 rounded-2xl bg-gradient-to-r from-violet-400/30 to-sky-400/30 text-white flex flex-col gap-1 max-w-full break-words">
                          <span className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</span>
                          {timeLabel && (
                            <span className="text-[10px] text-white/80 self-end">{timeLabel}</span>
                          )}
            </div>
                      ) : (
                        <div className="px-3 py-2 rounded-2xl bg-white/10 flex flex-col gap-1 max-w-full break-words">
                          <span className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</span>
                          {timeLabel && (
                            <span className="text-[10px] text-white/70 self-start">{timeLabel}</span>
                          )}
                        </div>
                      )
                )}
                    {!mine && (
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={async () => {
                            const blocked = isRoomBlocked(m.authorId);
                            await setRoomBlocked(m.authorId, !blocked);
                            show(blocked ? `Unblocked ${m.authorName} in this room` : `Blocked ${m.authorName} in this room`, blocked ? 'success' : 'info', 1000);
                          }}
                          className="rounded-md px-2 py-0.5 text-[11px] bg-zinc-800/80 hover:bg-zinc-700"
                          title={isRoomBlocked(m.authorId) ? 'Unblock in this room' : 'Block in this room'}
                        >
                          {isRoomBlocked(m.authorId) ? 'Unblock' : 'Block'}
              </button>
            </div>
            )}
            <div id="messagesEndRef" className="chat-anchor messages-end-anchor" ref={endAnchorRef} />
          </div>
              </div>
              );
            })}
          </div>

          {/* 底部输入框（sticky，不会再跑到中间） */}
          <div
            id="input-bar"
            ref={composerWrapRef}
            className="chat-input-bar sticky bottom-0 z-10 bg-black/40 backdrop-blur-xl border-t border-white/10 px-3 py-3"
            style={{
              paddingBottom: `max(12px, env(safe-area-inset-bottom), var(--kb-offset, 0px))`
            }}
          >
            <Composer
              ref={composerControlRef}
              target={!dmId ? { roomId: activeRoomId } : { dmId }}
            />
          </div>
        </section>

        {/* 右侧广告栏 */}
        <aside id="sponsor-rail" data-slot="right-rail" className="w-[300px] shrink-0 h-full overflow-y-auto space-y-4" style={{ flex: '0 0 300px' }}>
          <div className="h-[220px] rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white/60">Right Rail</div>
          <div className="h-[220px] rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white/60">Right Rail</div>
          <div className="h-[220px] rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white/60">Right Rail</div>
        </aside>
      </div>
      </div>

      {/* Create Room Modal */}
      <CreateRoomModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleRoomCreated}
      />

      {/* Room Invite Modal */}
      <RoomInviteModal
        roomId={activeRoomId}
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        friends={friendsList.map(f => ({
          uid: f.uid,
          name: f.nickname,
          age: f.age,
          gender: f.gender,
          country: f.country,
        }))}
        onlineUsers={onlineUsers.map(u => ({
          uid: u.uid,
          name: u.nickname,
          age: u.age,
          gender: u.gender,
          country: u.country,
        }))}
      />

      {/* Members Sheet */}
      <MembersSheet
        roomId={activeRoomId}
        open={showMembersSheet}
        onClose={() => setShowMembersSheet(false)}
        members={roomMembers}
      />

      {viewedProfile && (
        <div
          className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setViewedProfile(null)}
        >
          <div
            className="w-[min(420px,100%)] rounded-2xl bg-zinc-900 border border-white/10 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img
                  src={viewedProfile.avatarUrl || `https://api.dicebear.com/7.x/adventurer-neutral/png?seed=${encodeURIComponent(viewedProfile.nickname || viewedProfile.uid)}&size=64&radius=50&backgroundType=gradientLinear`}
                  alt={viewedProfile.nickname}
                  className="w-12 h-12 rounded-full border border-white/20 object-cover"
                />
                <div className="text-lg font-semibold text-white">{viewedProfile.nickname || 'User'}</div>
              </div>
              <button
                onClick={() => setViewedProfile(null)}
                className="text-white/60 hover:text-white text-lg"
                aria-label="Close profile"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm text-white/80">
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <div className="text-xs text-white/40 uppercase">Gender</div>
                <div className="mt-1 capitalize">{viewedProfile.gender || 'Unknown'}</div>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <div className="text-xs text-white/40 uppercase">Age</div>
                <div className="mt-1">{viewedProfile.age ?? '--'}</div>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2 col-span-2">
                <div className="text-xs text-white/40 uppercase">Country</div>
                <div className="mt-1">{viewedProfile.country || 'Unknown'}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs text-white/40 uppercase mb-1">Bio</div>
              <div className="rounded-xl bg-white/5 px-3 py-3 text-sm text-white/80 min-h-[72px]">
                {viewedProfile.bio ? viewedProfile.bio : 'No bio yet.'}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setViewedProfile(null)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
