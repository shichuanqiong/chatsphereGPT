import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
const AuthCtx=createContext<{user:any|null;loading:boolean}>({user:null,loading:true});
export function AuthProvider({children}:{children:any}){const [user,setUser]=useState<any|null>(null);const [loading,setLoading]=useState(true);useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setLoading(false)}),[]);return <AuthCtx.Provider value={{user,loading}}>{children}</AuthCtx.Provider>}
export function useAuth(){return useContext(AuthCtx)}
