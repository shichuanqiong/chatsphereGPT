import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, set, serverTimestamp, onDisconnect, update } from 'firebase/database';
const firebaseConfig={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,databaseURL:import.meta.env.VITE_FIREBASE_DATABASE_URL,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,storageBucket:import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID};
export const app=initializeApp(firebaseConfig);export const auth=getAuth(app);export const db=getDatabase(app);
export function presenceOnline(uid:string){const userStatusRef=ref(db,`/presence/${uid}`);onDisconnect(userStatusRef).set({state:'offline',lastChanged:serverTimestamp()});set(userStatusRef,{state:'online',lastChanged:serverTimestamp()});}
export async function bumpRoomUpdated(roomId:string){const r=ref(db,`/rooms/${roomId}`);await update(r,{updatedAt:serverTimestamp()});}
