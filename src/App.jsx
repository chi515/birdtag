// App.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import LoginPage from './components/Login'; 

const App = () => {
  const location = useLocation();

  const isAuthenticated = () => {
    const accessToken = sessionStorage.getItem('accessToken');
    return !!accessToken;
  };


  const publicPaths = ['/login', '/confirm'];
  if (publicPaths.includes(location.pathname)) {
    if (isAuthenticated() && location.pathname === '/login') {
        return <Navigate to="/home" replace />;
    }
    return <Outlet />; 
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default App;