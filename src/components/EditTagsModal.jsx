// src/components/EditTagsModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  Button, FormControl, FormLabel, Input, RadioGroup, Radio, Stack, Text, useToast,
  HStack, VStack, Tag, TagLabel, IconButton, NumberInput, NumberInputField, NumberInputStepper,
  NumberIncrementStepper, NumberDecrementStepper, Wrap, Divider, Box, Heading,
  TagCloseButton  
  // IconPlus, // Assuming you might want this for "Add to List" button
} from '@chakra-ui/react';
import { IconX } from '@tabler/icons-react';

const EditTagsModal = ({
  isOpen,
  onClose,
  onSubmit,
  selectedItems, // Array of selected media item objects (MUST contain their current 'tags' map)
  isLoading,
}) => {
  const [operation, setOperation] = useState("1"); // "1" for add/update, "0" for remove
  const toast = useToast();

  // --- States for "Add/Update Tags" mode ---
  const [addTagLabelInput, setAddTagLabelInput] = useState('');
  const [addTagQuantityInput, setAddTagQuantityInput] = useState(1); // Default quantity for new tags
  const [pendingAddUpdateTags, setPendingAddUpdateTags] = useState([]); // [{label: 'crow', quantity: 1}, ...]

  // --- States for "Remove Tags" mode ---
  const [tagsAvailableForRemoval, setTagsAvailableForRemoval] = useState([]);
  const [tagsSelectedForRemoval, setTagsSelectedForRemoval] = useState(new Set()); // Set of labels to remove

  // Calculate available tags for removal based on the intersection of tags from selected items
  useEffect(() => {
    if (operation === "0" && isOpen && selectedItems && selectedItems.length > 0) {
      const allLabelsInSelection = new Set();
      selectedItems.forEach(item => {
        if (item.tags && typeof item.tags === 'object') {
          Object.keys(item.tags).forEach(
            label => allLabelsInSelection.add(label.toLowerCase())
        );
        }
      });
      setTagsAvailableForRemoval(Array.from(allLabelsInSelection));
      setTagsSelectedForRemoval(new Set());
    } else {
      setTagsAvailableForRemoval([]); // Clear if not in remove mode or no items
    }
  }, [operation, selectedItems, isOpen]);

  const handleAddTagToList = () => {
    const label = addTagLabelInput.trim().toLowerCase();
    if (!label) {
      toast({ title: "Tag label cannot be empty.", status: "warning", duration: 2000, isClosable: true });
      return;
    }
    // Ensure quantity is a number (it should be from NumberInput)
    const quantity = Number.isFinite(addTagQuantityInput) ? addTagQuantityInput : 1;

    // Check if tag already in the pending list to avoid visual duplicates before submit
    // If it is, update its quantity. If not, add it.
    const existingPendingTagIndex = pendingAddUpdateTags.findIndex(t => t.label === label);

    if (existingPendingTagIndex > -1) {
      // Tag already in list, update its quantity
      const updatedList = pendingAddUpdateTags.map((tag, index) =>
        index === existingPendingTagIndex ? { ...tag, quantity: quantity } : tag
      );
      setPendingAddUpdateTags(updatedList);
      toast({ title: `Tag '${label}' quantity updated to ${quantity}.`, status: "info", duration: 2000, isClosable: true });
    } else {
      // Add new tag to the list
      setPendingAddUpdateTags([...pendingAddUpdateTags, { label, quantity: quantity }]);
    }

    // Reset input fields after adding to the list
    setAddTagLabelInput('');
    setAddTagQuantityInput(1); // Reset quantity to default
  };

  const handleAddTagToPendingList = () => {
    const label = addTagLabelInput.trim().toLowerCase();
    if (!label) {
      toast({ title: "Tag label cannot be empty.", status: "warning", duration: 2000, isClosable: true });
      return;
    }
    // Quantity from NumberInput (default is 1, min is 1 as per NumberInput below)
    const quantity = Number.isFinite(addTagQuantityInput) ? addTagQuantityInput : 1;

    // If quantity is 0 (or less, though NumberInput min should prevent < 1), don't add.
    if (quantity <= 0) {
        toast({ title: "Tag quantity must be at least 1.", status: "warning", duration: 3000, isClosable: true });
        return;
    }

    const existingPendingTagIndex = pendingAddUpdateTags.findIndex(t => t.label === label);

    if (existingPendingTagIndex > -1) {
      // Tag already in list, OVERWRITE its quantity
      const updatedList = [...pendingAddUpdateTags];
      updatedList[existingPendingTagIndex].quantity = quantity;
      setPendingAddUpdateTags(updatedList);
      toast({ title: `Tag '${label}' quantity updated to ${quantity}.`, status: "info", duration: 2000, isClosable: true });
    } else {
      // Add new tag to the list
      setPendingAddUpdateTags([...pendingAddUpdateTags, { label, quantity }]);
    }

    setAddTagLabelInput('');
    setAddTagQuantityInput(1); // Reset quantity to default 1
  };

  const handleRemoveFromPendingAddList = (labelToRemove) => {
    setPendingAddUpdateTags(pendingAddUpdateTags.filter(t => t.label !== labelToRemove));
  };

  const handleToggleTagForRemoval = (label) => {
    setTagsSelectedForRemoval(prev => {
      const newSet = new Set(prev);
      if (newSet.has(label)) newSet.delete(label);
      else newSet.add(label);
      return newSet;
    });
  };

  const handleSubmitInternal = () => {
  let tagsPayloadForApi;
  if (operation === "1") { // Add/Update
    if (pendingAddUpdateTags.length === 0) {
      toast({ 
        title: "No tags to add/update.", 
        status: "info", 
        duration: 3000, 
        isClosable: true 
    });
      return; // No action if list is empty
    }
    tagsPayloadForApi = pendingAddUpdateTags.map(t => `${t.label},${t.quantity}`);
  } else { // Remove (operation === "0")
    if (tagsSelectedForRemoval.size === 0) {
      toast({ 
        title: "No tags selected for removal.", 
        status: "info", 
        duration: 3000, 
        isClosable: true 
    });
      return; // No action if nothing selected
    }
    tagsPayloadForApi = Array.from(tagsSelectedForRemoval).map(label => `${label},0`); // Send "label,0" for removal
  }

  console.log("EditTagsModal: Calling onSubmit with:", { 
    operation: parseInt(operation, 10),
    tagsToManage: tagsPayloadForApi
  });


  onSubmit({ operation: parseInt(operation, 10), tagsToManage: tagsPayloadForApi });
};

  // Clear modal state when it closes or operation changes
  useEffect(() => {
    if (!isOpen) {
      setPendingAddUpdateTags([]);
      setTagsSelectedForRemoval(new Set());
      setAddTagLabelInput('');
      setAddTagQuantityInput(1);
      setOperation("1"); // Reset to "Add" mode
    }
  }, [isOpen]);


  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Manage Tags for {selectedItems?.length || 0} Item(s)</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} align="stretch">
            <FormControl as="fieldset">
              <FormLabel as="legend">Operation:</FormLabel>
              <RadioGroup onChange={setOperation} value={operation}>
                <HStack spacing={5}>
                  <Radio value="1">Add / Update Tags</Radio>
                  <Radio value="0">Remove Tags</Radio>
                </HStack>
              </RadioGroup>
            </FormControl>

            <Divider />

            {operation === "1" && (
              <Box>
                <Heading size="sm" mb={3}>Add or Update Tags:</Heading>
                <HStack mb={4}>
                  <FormControl flex={3} isRequired>
                    <FormLabel htmlFor="add-tag-label-modal" fontSize="sm">Tag Label</FormLabel>
                    <Input
                      id="add-tag-label-modal"
                      value={addTagLabelInput}
                      onChange={(e) => setAddTagLabelInput(e.target.value)}
                      placeholder="e.g., crow"
                    />
                  </FormControl>
                  <FormControl flex={1}>
                    <FormLabel htmlFor="add-tag-quantity-modal" fontSize="sm">Count</FormLabel>
                    <NumberInput
                      id="add-tag-quantity-modal"
                      value={addTagQuantityInput}
                      // onChange receives (valueAsString: string, valueAsNumber: number)
                      onChange={(valueString, valueAsNumber) =>
                        setAddTagQuantityInput(isNaN(valueAsNumber) ? 1 : Math.max(1, Math.min(10, valueAsNumber))) // Ensure quantity is between 1-10
                      }
                      min={1} 
                      max={10} 
                      defaultValue={1}
                      size="md"
                    >
                      <NumberInputField />
                      <NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                  <Button onClick={handleAddTagToList} colorScheme="green" variant="outline" alignSelf="flex-end" size="md">
                    Add to List
                  </Button>
                </HStack>
                {pendingAddUpdateTags.length > 0 && <Text fontWeight="medium" fontSize="sm">Tags to be applied:</Text>}
                <Wrap spacing={2}>
                  {pendingAddUpdateTags.map(tag => (
                    <Tag key={tag.label} size="md" variant="solid" colorScheme="blue">
                      <TagLabel>{tag.label} - {tag.quantity}</TagLabel>
                      <TagCloseButton onClick={() => handleRemoveFromPendingAddList(tag.label)} />
                    </Tag>
                  ))}
                </Wrap>
                 <Text fontSize="xs" color="gray.500" mt={2}>
                    If a tag label already exists in this list or on the items, its count will be updated to the new value. Tag counts must be between 1 and 10.
                </Text>
              </Box>
            )}


            {operation === "0" && (
              <Box>
                <Heading size="sm" mb={3}>Select Tags to Remove from Selected Items:</Heading>
                {tagsAvailableForRemoval.length === 0 ? (
                  <Text color="gray.500">No common tags found in selected items to remove, or no items selected.</Text>
                ) : (
                  <Wrap spacing={2}>
                    {tagsAvailableForRemoval.map(label => (
                      <Button
                        key={label}
                        onClick={() => handleToggleTagForRemoval(label)}
                        colorScheme={tagsSelectedForRemoval.has(label) ? "red" : "gray"}
                        variant={tagsSelectedForRemoval.has(label) ? "solid" : "outline"}
                        size="sm"
                        leftIcon={tagsSelectedForRemoval.has(label) ? <IconX size="14px" /> : undefined}
                      >
                        {label}
                      </Button>
                    ))}
                  </Wrap>
                )}
              </Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} mr={3} variant="ghost" isDisabled={isLoading}>Cancel</Button>
          <Button
            colorScheme="blue"
            onClick={handleSubmitInternal}
            isLoading={isLoading}
            isDisabled={ // Disable if no valid pending operations
                isLoading ||
                (operation === "1" && pendingAddUpdateTags.length === 0) ||
                (operation === "0" && tagsSelectedForRemoval.size === 0)
            }
          >
            Apply Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EditTagsModal;