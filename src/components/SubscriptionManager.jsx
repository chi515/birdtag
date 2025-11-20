// src/components/SubscriptionManager.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Heading, Text, Input, Button, HStack, VStack, Wrap, Tag, TagLabel,
  TagCloseButton, Spinner, useToast, FormControl, FormLabel, FormHelperText, Icon,
  InputGroup, InputRightElement, // For adding an icon or button to the input
  Flex
} from '@chakra-ui/react';
import { IconPlus, IconDeviceFloppy, IconTag } from '@tabler/icons-react'; // IconTag for input
import { useGetUserSubscriptions, useUpdateUserSubscriptions } from '../api/subscriptionService';
import { isAuthenticated as checkAuthStatusFromService, getCurrentUser as getUserFromService } from './authService'; // Assuming path

const SubscriptionManager = () => {
  const toast = useToast();
  const { user, userId, isAuthenticated, loadingAuth: initialAuthLoading } = useAuthStatus(); // Custom hook for auth state

  const [currentTagInput, setCurrentTagInput] = useState('');
  const [subscribedTagsUI, setSubscribedTagsUI] = useState([]); // Tags displayed and managed in UI

  const inputRef = useRef(null); // Ref for the tag input

  // Fetch current subscriptions
  const {
    data: fetchedSubscriptionData, // API now returns { subscribed_tags: ["tag1"] }
    isLoading: isLoadingSubscriptions,
    error: fetchSubscriptionsError,
    isSuccess: fetchSubscriptionsSuccess,
  } = useGetUserSubscriptions(userId); // userId from useAuthStatus

  // Mutation to update subscriptions
  const updateSubscriptionsMutation = useUpdateUserSubscriptions();
  
  // Effect to sync fetched subscription data to local UI state
  useEffect(() => {
    console.log('[EFFECT] Checking subscription data:', { 
        fetchSubscriptionsSuccess, 
        fetchedSubscriptionData 
    });

    if (fetchSubscriptionsSuccess && fetchedSubscriptionData) {
        console.log('[EFFECT] Is fetchedSubscriptionData.subscribed_tags an array?', Array.isArray(fetchedSubscriptionData.subscribed_tags));
        if (Array.isArray(fetchedSubscriptionData.subscribed_tags)) {
        console.log('[EFFECT] SUCCESS! Calling setSubscribedTagsUI with:', fetchedSubscriptionData.subscribed_tags);
        setSubscribedTagsUI(fetchedSubscriptionData.subscribed_tags.map(tag => tag.toLowerCase()));
        } else {
        console.warn('[EFFECT] FAILURE! API call succeeded, but data format is wrong.');
        }
    }
    
  }, [fetchSubscriptionsSuccess, fetchedSubscriptionData]);

  const handleAddTag = () => {
    const newTag = currentTagInput.trim().toLowerCase();
    if (!newTag) { // Prevent adding empty tags
      setCurrentTagInput(''); // Clear input even if empty to avoid confusion
      return;
    }
    if (!subscribedTagsUI.includes(newTag)) {
      setSubscribedTagsUI([...subscribedTagsUI, newTag]);
    } else {
      toast({ title: `Tag "${newTag}" is already in your subscription list.`, status: "info", duration: 2500, isClosable: true });
    }
    setCurrentTagInput(''); // Clear input after adding
    inputRef.current?.focus(); // Keep focus on input for easy multi-add
  };

  const handleRemoveTag = (tagToRemove) => {
    setSubscribedTagsUI(subscribedTagsUI.filter(tag => tag !== tagToRemove));
  };

  const handleSubmitSubscriptions = async () => {
    if (!userId) { toast({ title: "User not identified.", status: "error" }); return; }

    try {
      await updateSubscriptionsMutation.mutateAsync({
        tags: subscribedTagsUI, // Send the current full list of tags from UI state
        userId: userId, // For query invalidation or if lambda needs it
      });
      toast({ title: "Subscriptions updated successfully!", status: "success" });
    } catch (error) {
      toast({ title: "Failed to update subscriptions", description: error.message, status: "error" });
    }
  };

  // --- Render Logic ---
  // Custom hook for auth state (example)
  function useAuthStatus() {
    const [userId, setUserIdState] = useState(null);
    const [isAuthenticated, setIsAuthenticatedState] = useState(false);
    const [loadingAuth, setLoadingAuthState] = useState(true);
    const [user, setUserState] = useState(null); 
    //const [userObject, setUserObject] = useState(null);


    useEffect(() => {
    setLoadingAuthState(true);
    const authStatus = checkAuthStatusFromService();
    setIsAuthenticatedState(authStatus);
    if (authStatus) {
      const currentUserData = getUserFromService(); 
      console.log("useAuthStatus - currentUserData:", currentUserData);
      if (currentUserData && currentUserData.id) {
        setUserIdState(currentUserData.id);
        setUserState(currentUserData); 
      } else {
        console.warn("useAuthStatus: currentUserData is invalid or missing id.");
        setIsAuthenticatedState(false);
        setUserIdState(null);
        setUserState(null);
      }
    } else {
      console.log("useAuthStatus: Not authenticated.");
      setUserIdState(null);
      setUserState(null);
    }
    setLoadingAuthState(false);
  }, []);
    return { user, userId, isAuthenticated, loadingAuth };
  }


  if (initialAuthLoading || (isAuthenticated && isLoadingSubscriptions)) {
    return <Flex justify="center" align="center" minH="300px"><Spinner size="xl" /></Flex>;
  }
  if (!isAuthenticated) {
    return <Box p={6} textAlign="center"><Text>Please log in to manage subscriptions.</Text></Box>;
  }
  if (fetchSubscriptionsError) {
    return <Box p={6} textAlign="center"><Text color="red.500">Error loading subscriptions: {fetchSubscriptionsError.message}</Text></Box>;
  }


  return (
    <Box p={6} borderWidth="1px" borderRadius="lg" shadow="base" maxW="container.sm" mx="auto"> {/* Adjusted maxW */}
      <VStack spacing={5} align="stretch">
        <Heading as="h1" size="lg" textAlign="center">Manage Subscriptions</Heading>
        <Text textAlign="center" color="gray.600" fontSize="md">
          Add or remove tags you want to be notified about.
        </Text>

        <FormControl id="email-display" >
          <FormLabel fontSize="sm">Email for Notifications</FormLabel>
          <Input
            type="email"
            value={user && user.email ? user.email : (initialAuthLoading ? 'Loading email...' : 'N/A')} // Get email from useAuth().user
            isReadOnly
            focusBorderColor="transparent"
            bg="gray.50"
          />
        </FormControl>

        <FormControl id="tag-input-area">
          <FormLabel fontSize="sm">Subscribed Tags</FormLabel>
          <Box
            borderWidth="1px"
            borderRadius="md"
            p={2}
            minH="80px" // Minimum height for the tag area
            onClick={() => inputRef.current?.focus()} // Focus input when area is clicked
            cursor="text"
          >
            <Wrap spacing={2} align="center">
              {subscribedTagsUI.map(tag => (
                <Tag
                  key={tag}
                  size="md" // Medium size tags
                  variant="solid"
                  colorScheme="blue" // Or another scheme like 'gray', 'teal'
                  borderRadius="md" // Slightly less round than 'full'
                >
                  <TagLabel>{tag}</TagLabel>
                  <TagCloseButton onClick={() => handleRemoveTag(tag)} />
                </Tag>
              ))}
              {/* Input for new tags, inline with existing tags */}
              <Input
                ref={inputRef}
                variant="unstyled" // To make it look like part of the tag area
                placeholder={subscribedTagsUI.length === 0 ? "Enter a tag..." : "Enter another tag..."}
                value={currentTagInput}
                onChange={(e) => setCurrentTagInput(e.target.value)}
                onKeyDown={(e) => { // Handle Enter and Backspace
                  if (e.key === 'Enter' && currentTagInput.trim() !== '') {
                    e.preventDefault();
                    handleAddTag();
                  } else if (e.key === 'Backspace' && currentTagInput === '' && subscribedTagsUI.length > 0) {
                    // Remove last tag on backspace if input is empty
                    e.preventDefault();
                    handleRemoveTag(subscribedTagsUI[subscribedTagsUI.length - 1]);
                  }
                }}
                size="sm"
                flex="1" // Allow input to grow
                minW="120px" // Minimum width for usability
                py={1} // Adjust padding if needed
              />
            </Wrap>
          </Box>
          <FormHelperText>Type a tag and press Enter.</FormHelperText>
        </FormControl>

        <Button
          colorScheme="green"
          leftIcon={<Icon as={IconDeviceFloppy} boxSize="1.2em" />}
          isLoading={updateSubscriptionsMutation.isPending}
          onClick={handleSubmitSubscriptions}
          size="lg"
          width="full" // Make update button full width
          mt={2}
          isDisabled={updateSubscriptionsMutation.isPending || initialAuthLoading || isLoadingSubscriptions}
        >
          Update Subscriptions
        </Button>
      </VStack>
    </Box>
  );
};

export default SubscriptionManager;