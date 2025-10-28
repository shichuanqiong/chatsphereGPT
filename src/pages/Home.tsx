import { useEffect, useMemo, useRef, useState } from 'react';
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

type Room = { id: string; name: string; type: 'official'|'public'|'private'; ownerId?: string; icon?: string; createdAt?: number; ownerOfflineAt?: number | null; };
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
    
    // 取消注释下面这行来运行数据修复（运行一次后删除此 useEffect）
    // fixRoomTypes();
  }, []); // 只运行一次

  // 房间/DM
  const [rooms, setRooms] = useState<Room[]>([]);
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

  // 登录态 & 心跳
  useEffect(() => {
    let stopHB: (() => void) | null = null;
    const off = onAuthStateChanged(auth, (u) => {
      if (u?.uid) {
        (window as any)._uid = u.uid;
        try { localStorage.setItem('uid', u.uid); } catch {}
        setUid(u.uid);
        presenceOnline(u.uid);
        stopHB?.(); stopHB = startPresenceHeartbeat(u.uid);
      }
    });
    return () => { off(); stopHB?.(); };
  }, []);

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
      const arr: Room[] = Object.keys(val).map((k) => {
        const room = val[k];
        
        // 根据实际数据结构处理：rooms/{roomId}: { name, isOfficial?, visibility?, ownerId? }
        const isOfficial = room.isOfficial === true;
        const visibility = room.visibility || 'public';
        
        return {
          id: k,
          name: room.name || 'Unnamed Room',
          type: isOfficial ? 'official' : visibility,
          ownerId: room.ownerId,
          icon: room.icon || '💬',
          createdAt: room.createdAt,
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
    
    const memberRef = ref(db, `rooms/${activeRoomId}/members/${uid}`);
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
  
  // 资料/在线/我的线程/房间元数据/朋友/屏蔽/静音
  useEffect(() => {
    const off1 = onValue(ref(db, '/presence'), (s) => setPresence(s.val() || {}));
    const off2 = onValue(ref(db, '/profiles'), (s) => setProfiles(s.val() || {}));
    const off3 = uid ? () => {} : () => {}; // DM threads now handled by useInbox hook
    const off4 = uid ? onValue(ref(db, `/roomsMeta/${uid}`), (s) => setRoomsMeta(s.val() || {})) : () => {};
    const off5 = uid ? onValue(ref(db, `/friends/${uid}`), (s) => setFriends(s.val() || {})) : () => {};
    const off6 = uid ? onValue(ref(db, `/blocks/${uid}`), (s) => setBlocks(s.val() || {})) : () => {};
    const off7 = uid ? onValue(ref(db, `/mutes/${uid}`), (s) => setMutes(s.val() || {})) : () => {};
    return () => { off1(); off2(); off3(); off4(); off5(); off6(); off7(); };
  }, [uid]);

  // 在线用户（5 分钟内活跃 + 性别过滤 + 排除自己）
  const onlineUsers = useMemo(() => {
    const now = Date.now();
    const alive = Object.keys(presence).filter((k) => now - (presence[k]?.lastSeen || 0) < 5 * 60 * 1000);
    const people = alive.map((k) => profiles[k]).filter(Boolean) as Profile[];
    return people.filter((p) => p.uid !== uid && (genderFilter === 'all' ? true : p.gender === genderFilter));
  }, [presence, profiles, genderFilter, uid]);

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
          if (last.authorId !== uid && (document.hidden || !dmId) && !muted) {
            Sound.play('ding');
          }
        }
        prevCountRef.current = arr.length;
        setMessages(arr);
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
      });
    } else {
      setMessages([]);
    }
    return () => { off && off(); };
  }, [activeRoomId, dmId, uid, muted]);

  // 消息列表滚动控制
  const listRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  // 监听滚动，判断是否在底部
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(gap < 120); // 小于 120px 认为在底部
    if (el.scrollTop <= 0) {
      // TODO: 这里触发加载更早的历史（分页），可按需实现
      // loadMore();
    }
  };

  // 新消息到达时，仅在 atBottom=true 时自动滚底
  useEffect(() => {
    if (!listRef.current) return;
    if (atBottom) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, atBottom]);

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
      // 自动切换到新加入的房间
      navigate(`/r/${roomId}`);
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

  const openDM = async (peer: Profile | null, threadId?: string) => {
    if (!peer && threadId) {
      const parts = threadId.split('__');
      const other = uid === parts[0] ? parts[1] : parts[0];
      peer = profiles[other] || null;
    }
    if (!peer || !uid || peer.uid === uid) return;
    const a = uid < peer.uid ? uid : peer.uid;
    const b = uid < peer.uid ? peer.uid : uid;
    const tId = `${a}__${b}`;
    setDmId(tId); setDmPeer(peer);
    await readStateHelpers.markThreadRead(tId);
  };

  const selectRoom = async (rid: string) => {
    setDmId('');
    setDmPeer(null);
    
    // 使用 navigate 而不是直接设置状态
    navigate(`/r/${rid}`);
    
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

  const isOfficial = (r: Room) => {
    // 统一使用 type 字段判断，与房间数据处理逻辑保持一致
    return r?.type === 'official';
  };

  // 进入房间前置校验（private 要求成员资格/邀请）
  const tryEnterRoom = async (r: Room) => {
    if (r.type !== 'private') return selectRoom(r.id);
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
    <div className="h-screen w-full text-white relative overflow-hidden flex flex-col">
      <BackgroundRotator />

      {/* 顶部横条 */}
      <Header
        unreadTotal={inboxUnreadCount}
        onToggleInbox={() => {}}
        currentProfile={myProfile ? { ...myProfile, uid } : undefined}
        onLogout={() => signOut(auth)}
        inboxContent={
          <InboxPopover
            inboxItems={inboxItems}
            profiles={profiles}
            rooms={rooms}
            onOpenDM={(peer, threadId) => openDM(peer, threadId)}
            onAcceptInvite={handleAcceptInvite}
            onDeclineInvite={handleDeclineInvite}
            onMarkAllRead={markAllInboxAsRead}
            onClearInbox={clearInboxItems}
          />
        }
      />

      <div className="flex-1">
        <div className="max-w-[1400px] mx-auto flex gap-4 pt-3 pb-3 h-[calc(100vh-6rem)] overflow-hidden">
        {/* 左侧栏 */}
        <aside className="w-[280px] shrink-0 h-full overflow-y-auto">
          {/* ① Official Rooms */}
          <CollapseSection id="official" title="Official Rooms">
            {officialRooms.map((r) => (
                  <button
                    key={r.id}
                onClick={() => selectRoom(r.id)}
                className="w-full h-[54px] rounded-2xl border border-white/10 bg-black/40 hover:bg-white/10
                            flex items-center gap-3 px-4 transition-all"
                style={!dmId && activeRoomId === r.id ? { background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.3), rgba(147, 51, 234, 0.3))', borderColor: 'rgba(129, 140, 248, 0.2)' } : {}}
              >
                <span className="text-lg">{r.icon || '💬'}</span>
                      <span className="font-medium">{r.name}</span>
              </button>
            ))}
          </CollapseSection>

          {/* ② User Created Rooms */}
          <CollapseSection id="userRooms" title="User Created Rooms">
            {userRooms.map((r) => (
                  <button
                    key={r.id}
                onClick={() => selectRoom(r.id)}
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

          {/* ③ Friends */}
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
                    onClick={() => openDM(f)}
                  />
                ))}
              </div>
            )}
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
                  onClick={() => openDM(p)}
                />
              ))}
              {!onlineUsers.length && <div className="text-sm text-white/60">Nobody online yet.</div>}
            </div>
          </CollapseSection>

          {/* Create Room Button */}
          <div className="px-3 mt-4">
            <button
              onClick={createRoom}
              disabled={auth.currentUser?.isAnonymous}
              title={auth.currentUser?.isAnonymous ? 'Only registered users can create rooms' : ''}
              className={`w-full h-11 rounded-2xl transition-all font-medium ${
                auth.currentUser?.isAnonymous
                  ? 'bg-white/10 cursor-not-allowed text-white/40'
                  : 'bg-gradient-to-r from-teal-500/70 to-indigo-500/70 hover:from-teal-500 hover:to-indigo-500'
              }`}
            >
              + Create Room
              </button>
          </div>
        </aside>

        {/* 中间聊天区 */}
        <section className="flex-1 min-w-0 rounded-2xl border border-white/10 bg-black/40 backdrop-blur flex flex-col h-full">
          {/* 标题行（房间或 DM 标题） */}
          <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between shrink-0 relative">
            {!dmId ? (
            <div className="flex items-center gap-2">
              <div className="text-lg">
                  {currentRoom?.icon || 
                   (currentRoom?.type === 'official' ? '🌙' :
                   currentRoom?.type === 'private' ? '🔒' : '💬')}
                </div>
                <div className="font-semibold">
                  {currentRoom?.name || 'ChatSphere'}
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

          {/* 消息滚动区（占满剩余空间） */}
          <div
            ref={listRef}
            onScroll={onScroll}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            data-chat-scroll="1"
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
              return (
                <div key={idx} className={`w-full flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`relative max-w-[70%] ${mine ? 'items-end text-right' : ''} group`}>
                    {!mine && <div className="text-xs text-white/60 mb-1">{m.authorName}</div>}
                {m.type === 'gif' ? (
                      <img src={m.content} alt="gif" className={`rounded-xl border border-white/10 max-h-[280px] ${mine ? 'ml-auto' : ''}`} />
                    ) : (
                      <div className={`px-3 py-2 rounded-2xl ${mine ? 'bg-gradient-to-r from-teal-500/70 to-indigo-500/70' : 'bg-white/10'}`}>
                        {m.content}
                      </div>
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
              </div>
                </div>
              );
            })}
          </div>

          {/* 底部输入框（不会再跑到中间） */}
          <div className="border-t border-white/10 px-3 py-3">
            <Composer target={!dmId ? { roomId: activeRoomId } : { dmId }} />
          </div>
        </section>

        {/* 右侧广告栏 */}
        <aside className="w-[300px] shrink-0 h-full overflow-y-auto space-y-4">
          <div className="h-[220px] rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white/60">Ad — Right Rail</div>
          <div className="h-[220px] rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white/60">Ad — Right Rail</div>
          <div className="h-[220px] rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white/60">Ad — Right Rail</div>
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
    </div>
  );
}
