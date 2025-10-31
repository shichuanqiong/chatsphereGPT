import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { CurrentRoomProvider } from './state/currentRoom';
import BackgroundRotator from './components/BackgroundRotator';
import Login from './pages/Login';
import Home from './pages/Home';
import Blog from './pages/Blog';
import Admin from './pages/Admin';
import Post from './pages/Post';

function Guard({children}:{children:any}){const {user,loading}=useAuth();if(loading)return null;return user?children:<Navigate to='/' replace/>}

export default function App(){
  return(
    <AuthProvider>
      <CurrentRoomProvider>
        <BackgroundRotator />
        <HashRouter>
          <Routes>
            <Route path='/' element={<Login/>}/>
            <Route path='/home' element={<Guard><Home/></Guard>}/>
            <Route path='/r/:roomId' element={<Guard><Home/></Guard>}/>
            <Route path='/blog' element={<Blog/>}/>
            <Route path='/blog/:slug' element={<Post/>}/>
            <Route path='/admin' element={<Admin/>}/>
            {/* 手误兜底：/admn → /admin */}
            <Route path='/admn' element={<Navigate to='/admin' replace/>}/>
            {/* 404 catch-all */}
            <Route path='*' element={<Navigate to='/' replace/>}/>
          </Routes>
        </HashRouter>
      </CurrentRoomProvider>
    </AuthProvider>
  )
}
