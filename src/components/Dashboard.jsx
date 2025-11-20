// src/components/Dashboard.jsx
import React from 'react';
import {
  Box,
  Flex,
  IconButton,
  Image,
  Text,
  useDisclosure,
  useBreakpointValue,

} from '@chakra-ui/react';
import { FiMenu, FiX } from 'react-icons/fi';
import { Outlet } from 'react-router-dom';
import logo from '../assets/logo2.png'; 
import { Navbar } from './Navbar';

export const Dashboard = () => {
  const { isOpen, onOpen, onClose } = useDisclosure(); // Chakra UI hook for open/close state
  const isDesktop = useBreakpointValue({ base: false, lg: true }); 

  return (
    <Flex direction="column" h="100vh" bg="gray.50"> 


      <Flex
        as="header"
        align="center"
        justify="space-between"
        px={{ base: 4, md: 6 }}
        h="60px"
        bg="white"
        borderBottomWidth="1px"
        borderColor="gray.200"
        flexShrink={0} 
      >

        <Flex align="center">
      
          {!isDesktop && (
            <IconButton
              aria-label="Open sidebar"
              icon={<FiMenu />}
              variant="ghost"
              onClick={onOpen}
              mr={2}
            />
          )}
          <Image src={logo} alt="BirdTag Logo" boxSize="32px" objectFit="contain" mr={3} />
          <Text
            color="pink.500"
            fontWeight="600"
            fontSize={{ base: 'lg', md: 'xl' }}
            whiteSpace="nowrap"
          >
            BirdTag
          </Text>
        </Flex>

        {isDesktop && <Box w="40px" />} 

      </Flex>

      <Flex
        flex="1" 
        overflow="hidden" 
      >
        {isDesktop && (
          <Box
            as="aside"
            w="240px"
            h="100%"
            bg="white"
            borderRightWidth="1px"
            borderColor="gray.200"
            p={{ base: 4, md: 5 }}
            overflowY="auto"
            flexShrink={0} 
          >
            <Navbar />
          </Box>
        )}

        <Box
          as="main"
          flex="1" 
          h="100%" 
          p={{ base: 4, md: 6 }}
          overflowY="auto" 
          bg="white" 
        >
          <Outlet /> 
        </Box>
      </Flex>

      {!isDesktop && isOpen && (
        <>
          {/* Overlay */}
          <Box
            position="fixed"
            top="0"
            left="0"
            w="100vw"
            h="100vh"
            bg="blackAlpha.500" 
            zIndex="overlay"
            onClick={onClose}
          />
          <Box
            position="fixed"
            top="0"
            left="0"
            w="280px" 
            h="100vh"
            bg="white"
            boxShadow="lg"
            p={4}
            zIndex="modal"
            overflowY="auto"
          >
            <Flex justify="flex-end" mb={4}>
              <IconButton
                aria-label="Close sidebar"
                icon={<FiX />}
                variant="ghost"
                onClick={onClose}
              />
            </Flex>
            <Navbar />
          </Box>
        </>
      )}
    </Flex>
  );
};