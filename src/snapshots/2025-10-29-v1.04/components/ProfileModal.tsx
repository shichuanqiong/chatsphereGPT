import { useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';

type Profile = {
  uid: string;
  nickname: string;
  gender: 'male' | 'female';
  age: number;
  country: string;
  bio?: string;
};

export default function ProfileModal({
  open,
  onClose,
  profile
}: {
  open: boolean;
  onClose: () => void;
  profile?: Profile | null;
}) {
  const [bio, setBio] = useState(profile?.bio || '');

  if (!open) return null;

  const handleSave = async () => {
    if (!profile?.uid) return;
    try {
      await update(ref(db, `/profiles/${profile.uid}`), { bio });
      onClose();
    } catch (e) {
      console.error('Failed to update bio:', e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-[480px] rounded-2xl bg-zinc-900 border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Profile</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            ✕
          </button>
        </div>

        {profile ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/70">Nickname</label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-white/5 text-white">
                {profile.nickname}
              </div>
            </div>

            <div>
              <label className="text-sm text-white/70">Gender</label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-white/5 text-white capitalize">
                {profile.gender}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-white/70">Age</label>
                <div className="mt-1 px-3 py-2 rounded-lg bg-white/5 text-white">
                  {profile.age}
                </div>
              </div>
              <div>
                <label className="text-sm text-white/70">Country</label>
                <div className="mt-1 px-3 py-2 rounded-lg bg-white/5 text-white">
                  {profile.country}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm text-white/70">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 text-white border border-white/10 focus:border-white/30 outline-none resize-none"
                rows={4}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 transition-all text-white font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="text-white/60">No profile data available.</div>
        )}
      </div>
    </div>
  );
}
