// Home.jsx
import React, { useState, useEffect } from 'react';
import {
  Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon,
  Box, Button, Flex, HStack, VStack, Input, InputGroup, InputRightElement,
  InputLeftElement, Text, Tag, TagLabel, TagCloseButton, NumberInput,
  NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper,
  FormControl, FormLabel, FormErrorMessage, IconButton, Wrap, Heading, Spinner, useDisclosure,
  AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay,
  useToast
} from '@chakra-ui/react';
import { IconFilter, IconTag, IconX } from '@tabler/icons-react';
import { FaTag } from "react-icons/fa";

import { useSearchMedia } from '../api/searchImage'; 
import { useManageTags } from '../api/mediaActions'; 
import { useDeleteFiles } from '../api/mediaActions';
import AlbumDisplay from './AlbumDisplay';
import EditTagsModal from './EditTagsModal';
import { isAuthenticated as checkAuthStatusFromService, getCurrentUser as getUserFromService } from './authService';


function Home() {
  const toast = useToast();
  const cancelRef = React.useRef(); // For AlertDialog
  
  // --- State for filter tags ---
  const [tags, setTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [newTagError, setNewTagError] = useState('');

  // --- State for search results and album selection ---
  const [searchResults, setSearchResults] = useState([]);
  const [selectedAlbumItems, setSelectedAlbumItems] = useState(new Set());

  // --- Auth State ---
  const [userId, setUserId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  

  useEffect(() => {
    const authStatus = checkAuthStatusFromService();
    setIsAuthenticated(authStatus);
    if (authStatus) {
      const currentUser = getUserFromService();
      if (currentUser && currentUser.id) { setUserId(currentUser.id); }
      else { console.warn("Home.jsx: User ID not found..."); setIsAuthenticated(false); }
    }
    setAuthLoading(false);
  }, []);

  // --- API Mutations ---
  const searchMediaMutation = useSearchMedia(); // Hook from your searchImage.js or searchMedia.js
  const manageTagsMutation = useManageTags();   // Hook for managing tags
  const deleteFilesMutation = useDeleteFiles(); // Hook for deleting files

  // --- Modal States ---
  const { isOpen: isEditTagsModalOpen, onOpen: onEditTagsModalOpen, onClose: onEditTagsModalClose } = useDisclosure();
  const { isOpen: isDeleteAlertOpen, onOpen: onDeleteAlertOpen, onClose: onDeleteAlertClose } = useDisclosure();
  
  // --- Filter Tag Handlers ---
  const clearTags = () => { setTags([]); setNewTagError(''); };
  const handleAddTagSubmit = (e) => { 
    e.preventDefault(); /* ... */
    const trimmedInput = newTagInput.trim().toLowerCase();
    if (!trimmedInput) { setNewTagError("Tag cannot be empty."); return; }
    if (tags.some(tag => tag.label === trimmedInput)) { setNewTagError("This tag already exists."); return; }
    setTags([...tags, { id: Date.now(), label: trimmedInput, quantity: 1 }]); // Default quantity to 1 for search
    setNewTagInput(''); setNewTagError('');
  };
  const removeTag = (tagIdToRemove) => { setTags(tags.filter(tag => tag.id !== tagIdToRemove)); };
  const updateTagQuantity = (tagIdToUpdate, valueAsString, valueAsNumber) => {
    let newQuantity = isNaN(valueAsNumber) ? (valueAsString === '' ? 0 : 1) : valueAsNumber;
    newQuantity = Math.max(0, Math.min(10, newQuantity)); // Clamp between 0-10
    setTags(tags.map(tag => tag.id === tagIdToUpdate ? { ...tag, quantity: newQuantity } : tag ));
  };

  // --- Search Handler ---
  const handleSearchImages = async () => {
    if (authLoading) { alert("Authentication loading..."); return; }
    if (!isAuthenticated || !userId) { alert("Please log in to search."); return; }
    if (tags.length === 0 && !searchMediaMutation.isPending) {
      alert("Please add tags to search for.");
      return;
    }

    setSearchResults([]); // Clear previous results before new search

    try {
      const tagsForApi = {};
      tags.forEach(tag => {
        tagsForApi[tag.label] = tag.quantity > 0 ? tag.quantity : 1;
      });


      const searchParams = {
        tags: tagsForApi, // an object like {"crow": 1, "pigeon": 2} or an array
        userId: userId,
      };

      const apiResponse = await searchMediaMutation.mutateAsync(searchParams);

      console.log("Search API Full Response from Home:", apiResponse);

      // Assuming backend returns { results: [ {id, type, file_name, s3_key_thumbnail, ... presigned_thumbnail_url, ...}, ... ] }
      if (apiResponse && Array.isArray(apiResponse.results)) {
        if (apiResponse.results.length === 0) {
          alert("No media found matching your criteria.");
        }
        setSearchResults(apiResponse.results);
      } else {
        alert("Search successful, but data from API is not in the expected format (expected 'results' array).");
        console.error("Unexpected search API response format:", apiResponse);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search failed in Home.jsx:", error);
      alert(`Search failed: ${error.message || "An unknown error occurred."}`);
      setSearchResults([]);
    }
  };

  // --- Album Item Selection Handler ---
  const handleAlbumItemSelect = (itemId) => {
    setSelectedAlbumItems(prev => { 
      const newSet = new Set(prev); 
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      } 
      console.log("Updated selectedAlbumItems (Set):", newSet); 
      console.log("Number of selected items:", newSet.size); 
      return newSet; });
  };

  const getSelectedItemsData = () => {
    if (!searchResults || searchResults.length === 0 || selectedAlbumItems.size === 0) {
      return []; // Return empty array if no search results or no selection
    }
    // Filter the searchResults array to get only the items whose IDs are in selectedAlbumItems Set
    return searchResults.filter(item => item && item.id && selectedAlbumItems.has(item.id));
  };

  // --- Batch Action Handlers ---
  const handleManageTagsSubmit = async ({ operation, tagsToManage }) => {
    console.log("Home.jsx: handleManageTagsSubmit called with:", { 
    operation,
    tagsToManage,
    selectedItemIds: Array.from(selectedAlbumItems) 
  });
    if (selectedAlbumItems.size === 0) {
      alert("No items selected to manage tags.");
      return;
    }
    if (!userId) { alert("User not identified."); return;}
    
    //const fileIds = Array.from(selectedAlbumItems);
    const selectedIds = Array.from(selectedAlbumItems);

    const urlsToSendToLambda = selectedIds.map(id => {
      const selectedItemData = searchResults.find(item => item.id === id);
      // Ensure searchResults contains 'identifier_url_for_batch_ops' from your search_lambda
      return selectedItemData ? selectedItemData.object_url : null;
    }).filter(url => url !== null);
    try {
      await manageTagsMutation.mutateAsync({
        s3Urls: urlsToSendToLambda,
        operation: operation, // 0 for remove, 1 for add
        tags: tagsToManage,   // Array of "label,count" strings
        userId: userId,       // Pass userId if lambda needs it in body (better from authorizer)
      });
      alert("Tags updated successfully!");
      onEditTagsModalClose();
      setSelectedAlbumItems(new Set()); // Clear selection
      handleSearchImages();
    } catch (error) {
      console.error("Home.jsx: Failed to update tags:", error);
      toast({
        title: "Failed to update tags",
        description: error.message || "An unknown error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      
    }
  };

  const handleDeleteSelectedFiles = async () => {
    if (selectedAlbumItems.size === 0) {
      alert("No items selected for deletion.");
      return;
    }
    if (!userId) { alert("User not identified."); return;}

    const selectedIds = Array.from(selectedAlbumItems);
    
    const fileIdsToDelete = selectedIds.map(id => {
      const selectedItemData = searchResults.find(item => item.id === id);
      // Ensure searchResults contains 'identifier_url_for_batch_ops' from your search_lambda
      return selectedItemData ? selectedItemData.object_url : null;
    }).filter(url => url !== null);
    try {
      await deleteFilesMutation.mutateAsync({
        s3Urls: fileIdsToDelete,
        //fileIds: fileIdsToDelete, 
        userId: userId,
      });
      alert("Selected files deleted successfully!");
      onDeleteAlertClose();
      setSelectedAlbumItems(new Set()); // Clear selection
      handleSearchImages(); // Or a more targeted refetch/invalidation
    } catch (error) {
      alert(`Failed to delete files: ${error.message}`);
    }
  };

  return (
    <Box p={4} maxW="container.lg" mx="auto"> {/* Wider container */}
      <Accordion allowToggle defaultIndex={[0]} borderWidth="1px" borderRadius="md" mb={6}>
        <AccordionItem>
          <h2>
            <AccordionButton py={3} _expanded={{ bg: "gray.100" }}>
              <HStack flex="1" spacing={3}>
                <IconFilter size={20} />
                <Text fontWeight="semibold">Filter</Text>
              </HStack>
              <AccordionIcon />
            </AccordionButton>
          </h2>
          <AccordionPanel pb={4}>
            <VStack spacing={4} align="stretch">
              <form onSubmit={handleAddTagSubmit}>
                <HStack>
                  <FormControl isInvalid={!!newTagError} flex="1">
                    <InputGroup>
                      <InputLeftElement pointerEvents="none"><FaTag color="gray.400" /></InputLeftElement>
                      <Input
                        placeholder="Press enter to add a tag.."
                        value={newTagInput}
                        onChange={(e) => { setNewTagInput(e.target.value); if (newTagError) setNewTagError('');}}
                      />
                    </InputGroup>
                    {newTagError && <FormErrorMessage>{newTagError}</FormErrorMessage>}
                  </FormControl>
                   <Button type="submit" colorScheme="blue" size="md" variant="outline">Add</Button>
                </HStack>
              </form>

              {tags.length > 0 && (
                <VStack align="stretch" spacing={2} mt={3}>
                  <Text fontWeight="medium">Tags:</Text>
                  <Wrap spacing={2}>
                    {tags.map((tag) => (
                      <Tag key={tag.id} size="lg" variant="subtle" colorScheme="cyan" borderRadius="full">
                        <TagLabel>{tag.label}</TagLabel>
                        <Box ml={2} width="70px">
                          <NumberInput
                            size="xs" value={tag.quantity} min={0} max={10}
                            onChange={(valStr, valNum) => updateTagQuantity(tag.id, valStr, valNum)} // Pass both
                            allowMouseWheel
                          >
                            <NumberInputField />
                            <NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
                          </NumberInput>
                        </Box>
                        <TagCloseButton onClick={() => removeTag(tag.id)} />
                      </Tag>
                    ))}
                  </Wrap>
                </VStack>
              )}

              <HStack justifyContent="flex-end" spacing={3} mt={4}>
                <Button variant="ghost" colorScheme="red" onClick={clearTags} isDisabled={tags.length === 0 || searchMediaMutation.isPending}>
                  Clear Filter
                </Button>
                <Button
                  colorScheme="blue"
                  onClick={handleSearchImages}
                  isDisabled={tags.length === 0 || searchMediaMutation.isPending || authLoading || !isAuthenticated}
                  isLoading={searchMediaMutation.isPending}
                  loadingText="Searching..."
                >
                  Search by tags
                </Button>
              </HStack>
            </VStack>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>


      {/* --- Batch Action Buttons --- */}
      {selectedAlbumItems.size > 0 && !authLoading && isAuthenticated && ( // Show only if items are selected and user is authenticated
        <HStack spacing={4} mb={6} justifyContent="flex-start">
          <Text fontWeight="medium">{selectedAlbumItems.size} item(s) selected</Text>
          <Button
            colorScheme="yellow"
            onClick={onEditTagsModalOpen}
            isDisabled={manageTagsMutation.isPending || deleteFilesMutation.isPending}
          >
            Edit Selected Tags
          </Button>
          <Button
            colorScheme="red"
            onClick={onDeleteAlertOpen}
            isDisabled={manageTagsMutation.isPending || deleteFilesMutation.isPending}
            isLoading={deleteFilesMutation.isPending}
          >
            Delete Selected
          </Button>
        </HStack>
      )}

      {/* --- Album Display --- */}
      <AlbumDisplay
        items={searchResults}
        isLoading={searchMediaMutation.isPending && searchResults.length === 0}
        onSelectItem={handleAlbumItemSelect}
        selectedItemsSet={selectedAlbumItems}
      />

      {/* --- Edit Tags Modal --- */}
      {isAuthenticated && ( // Only mount modal if authenticated, or control isOpen more strictly
        <EditTagsModal
            isOpen={isEditTagsModalOpen}
            onClose={onEditTagsModalClose}
            onSubmit={handleManageTagsSubmit}
            selectedItemCount={selectedAlbumItems.size}
            selectedItems={getSelectedItemsData()}
            isLoading={manageTagsMutation.isPending}
        />
      )}


      {/* --- Delete Confirmation Dialog --- */}
      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteAlertClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Selected Files
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete {selectedAlbumItems.size} selected item(s)? This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteAlertClose} isDisabled={deleteFilesMutation.isPending}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteSelectedFiles} ml={3} isLoading={deleteFilesMutation.isPending}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

export default Home;