// src/components/Navbar.jsx
import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
} from '@chakra-ui/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IconHome,
  IconBellRinging,
  IconPhotoUp,
  IconPhotoSearch,
  IconLogout,
} from '@tabler/icons-react';
import { signOut } from './authService';

const data = [
  { link: '/home', label: 'Home', icon: IconHome },
  { link: '/upload', label: 'Upload Image', icon: IconPhotoUp },
  { link: '/search', label: 'Search by Image', icon: IconPhotoSearch },
  { link: '/notifications', label: 'Notifications', icon: IconBellRinging },
];

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  //const bgHover = useColorModeValue('gray.100', 'gray.600');
  //const bgActive = useColorModeValue('gray.200', 'gray.700');

  const handleLogout = async () => { 
    try {
      await signOut(); 
      navigate('/login');
    } catch (error) {
      console.error("Error during logout:", error);
      alert("An error occurred during logout. Please try again.");
     
      sessionStorage.removeItem('accessToken');
      navigate('/login');
    }
  };

  return (
    <Box h="100%" display="flex" flexDirection="column">
      <Box flex="1" overflowY="auto">
        <VStack align="stretch" spacing={1}>
          {data.map((item) => {
            const isActive = location.pathname === item.link;
            return (
              <HStack
                as={Link}
                to={item.link}
                key={item.label}
                spacing={3}
                px={3}
                py={2}
                borderRadius="md"
                //bg={isActive ? bgActive : 'transparent'}
                //_hover={{ bg: bgHover }}
              >
                <Box>
                  <item.icon size="18px" />
                </Box>
                <Text fontSize="md">{item.label}</Text>
              </HStack>
            );
          })}
        </VStack>
      </Box>

      <Box>
        <HStack
          spacing={3}
          px={3}
          py={2}
          cursor="pointer"
          //_hover={{ bg: bgHover }}
          onClick={handleLogout}
        >
          <Box>
            <IconLogout size="18px" />
          </Box>
          <Text fontSize="md">Logout</Text>
        </HStack>
      </Box>
    </Box>
  );
};
