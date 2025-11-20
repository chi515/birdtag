// main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChakraProvider  } from "@chakra-ui/react";
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import LoginPage from './components/Login';
import ConfirmUserPage from './components/ConfirmUserPage';
import { Dashboard } from './components/Dashboard';
import Home from './components/Home';
import Upload from './components/Upload';
import SearchByImages from './components/SearchByImages';
import SubscriptionManager from './components/SubscriptionManager';

import './index.css';

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    element: <App />, 
    children: [
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "confirm",
        element: <ConfirmUserPage />,
      },
      {
        path: "/", 
        element: <Dashboard />, 
        children: [
          
          {
            path: "home",
            element: <Home />,
          },
          {
            path: "upload",
            element: <Upload />,
          },
          {
            path: "search",
            element: <SearchByImages />,
          },
          {
            path: "notifications",
            element: <SubscriptionManager />,
          },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChakraProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>      
    </ChakraProvider>
  </StrictMode>
);