import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';
import RotatingBWBackground from '../components/RotatingBWBackground';
import GlassCard from '../components/GlassCard';
export default function Post(){const { slug }=useParams();const [post,setPost]=useState<any>(null);useEffect(()=>{(async()=>{const snap=await get(ref(db,'/posts'));const v=snap.val()||{};const p=Object.values(v).find((x:any)=>x.slug===slug);setPost(p||null)})()},[slug]);if(!post)return null;return(<main className='min-h-screen text-white'><RotatingBWBackground/><div className='max-w-3xl mx-auto pt-20 px-4'><GlassCard className='p-6'><h1 className='text-3xl font-bold'>{post.title}</h1><div className='text-white/60 text-sm mb-4'>By BlogBot · {new Date((post.createdAt?.seconds||Date.now()/1000)*1000).toLocaleString()}</div><div className='prose prose-invert'>{post.content}</div></GlassCard></div></main>)}
