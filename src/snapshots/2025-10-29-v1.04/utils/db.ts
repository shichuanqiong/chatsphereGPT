export const paths = {
  profiles: (uid: string) => `/profiles/${uid}`,
  roles: (uid: string) => `/roles/${uid}`,
  rooms: '/rooms',
  room: (roomId: string) => `/rooms/${roomId}`,
  roomMeta: (roomId: string) => `/rooms/${roomId}/meta`,
  roomMembers: (roomId: string) => `/rooms/${roomId}/members`,
  roomBans: (roomId: string) => `/rooms/${roomId}/bans`,
  roomInvites: (roomId: string) => `/rooms/${roomId}/invites`,
  messages: (roomId: string) => `/messages/${roomId}`,
  dmTid: (a: string, b: string) => [a, b].sort().join('__'),
  dmMessages: (tid: string) => `/dmMessages/${tid}`,
  inbox: (uid: string) => `/inbox/${uid}`,
  friends: (uid: string) => `/friends/${uid}`,
  presence: (uid: string) => `/presence/${uid}`,
  ads: '/ads',
  posts: '/posts'
}
