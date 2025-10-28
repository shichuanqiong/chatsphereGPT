import { useState } from "react";
import { db, auth } from "../firebase";
import { push, ref, set, serverTimestamp } from "firebase/database";
import { PASTEL_ICONS as ICONS } from "./icons/pastelIcons";
import { useToast } from "./Toast";

export default function CreateRoomModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (roomId: string) => void }) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public"|"private">("public");
  const [icon, setIcon] = useState(ICONS[0]);
  const [busy, setBusy] = useState(false);
  const { show } = useToast();

  if (!open) return null;

  async function handleCreate() {
    if (!name.trim()) return;
    const owner = auth.currentUser?.uid;
    if (!owner) return;

    setBusy(true);
    try {
      const roomRef = push(ref(db, "rooms"));
      const roomId = roomRef.key!;

      await set(roomRef, {
        id: roomId,
        name: name.trim(),
        type: visibility, // 'public' | 'private'
        ownerId: owner,
        icon,
        createdAt: serverTimestamp(),
      });

      // 建立者加入成员表，角色 owner
      await set(ref(db, `roomMembers/${roomId}/${owner}`), {
        role: "owner",
        joinedAt: serverTimestamp(),
      });

      // 给自己建一个 roomsMeta 方便未读计数（可选）
      await set(ref(db, `roomsMeta/${owner}/${roomId}`), {
        roomId,
        unread: 0,
        lastReadTs: serverTimestamp(),
      });

      onClose();
      // 清空表单
      setName("");
      setIcon(ICONS[0]);
      setVisibility("public");
      
      // 通知父组件选中新房间
      onCreated?.(roomId);
    } catch (e) {
      console.error("Failed to create room:", e);
      show("Failed to create room. Please try again.", "error", 1200);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[520px] rounded-2xl bg-neutral-900/95 p-6 shadow-2xl border border-white/10">
        <h3 className="text-xl font-semibold mb-4 text-white">Create a Room</h3>

        <label className="block text-sm mb-1 text-white/80">Room name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Coffee Corner"
          className="w-full rounded-lg bg-neutral-800 px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-cyan-400 text-white"
          autoFocus
        />

        <label className="block text-sm mb-1 text-white/80">Visibility</label>
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setVisibility("public")}
            className={`px-4 py-2 rounded-full text-sm transition-all ${
              visibility === "public" ? "bg-cyan-600 text-white" : "bg-neutral-800 text-white/70 hover:bg-neutral-700"
            }`}
          >
            Public
          </button>
          <button
            onClick={() => setVisibility("private")}
            className={`px-4 py-2 rounded-full text-sm transition-all ${
              visibility === "private" ? "bg-violet-600 text-white" : "bg-neutral-800 text-white/70 hover:bg-neutral-700"
            }`}
          >
            Private
          </button>
        </div>

        <label className="block text-sm mb-2 text-white/80">Icon</label>
        <div className="grid grid-cols-8 gap-2 max-h-[140px] overflow-auto mb-5 p-1">
          {ICONS.map(it => (
            <button
              key={it}
              onClick={() => setIcon(it)}
              className={`h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 ${
                icon === it ? "ring-2 ring-cyan-300 scale-110" : "ring-0"
              } bg-white/10 hover:bg-white/15`}
            >
              <span className="text-lg">{it}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={busy || !name.trim()}
            onClick={handleCreate}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-medium hover:from-cyan-600 hover:to-violet-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Creating..." : "Create Room"}
          </button>
        </div>
      </div>
    </div>
  );
}

