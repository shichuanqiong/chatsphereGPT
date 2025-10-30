export async function createOrGetDMRoom(peerId: string): Promise<{ roomId: string }> {
  const res = await fetch('/api/rooms/dm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ peerId }),
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to open DM');
  }

  return res.json();
}

