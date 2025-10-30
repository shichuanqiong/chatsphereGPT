import { useEffect, useState } from 'react';
import { isFriend, addFriend, removeFriend } from '../lib/friends';

export function FriendToggle({ userId }: { userId: string }) {
  const [fri, setFri] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    isFriend(userId).then(v => {
      setFri(v);
      setLoading(false);
    });
  }, [userId]);

  const toggle = async () => {
    setLoading(true);
    if (fri) await removeFriend(userId);
    else await addFriend(userId);
    setFri(!fri);
    setLoading(false);
  };

  return (
    <button
      disabled={loading}
      onClick={toggle}
      className={`px-3 h-8 rounded-xl text-sm border transition-all ${
        fri 
          ? 'bg-red-500/70 border-red-400 text-white hover:bg-red-500' 
          : 'bg-teal-500/70 border-teal-400 text-white hover:bg-teal-500'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={fri ? 'Remove friend' : 'Add friend'}
    >
      {fri ? 'Friend ✓' : 'Add Friend +'}
    </button>
  );
}

