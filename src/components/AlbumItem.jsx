// src/components/AlbumItem.jsx
import React, { useState, useEffect } from 'react';
import { Box, Image, Text, Button, Spinner, Icon, Checkbox, HStack, VStack, Tag, TagLabel, Wrap } from '@chakra-ui/react';
import { useGetPresignedUrl } from '../api/presignUrlService'; // For full size/video URL
import { LuFile, LuVideo, LuMusic, LuImage } from "react-icons/lu";

const AlbumItem = ({ item, onSelectItem, isSelected }) => {
  // displayableImageUrl will now come directly from item.presigned_thumbnail_url
  // or item.presigned_original_url for videos if no specific thumbnail URL
  const getFullUrlMutation = useGetPresignedUrl(); // For "View Full Image/Video" button
  const identifierForSelection = item.object_url;
  const itemType = item.type || 'unknown';
  const previewUrl = item.presigned_url_for_display;
  
  const handleViewFull = async () => {
    const keyForFullView = item.s3_key_original;
    if (!keyForFullView) {
      alert("Original file path missing for this item.");
      return;
    }
    try {
      const fullPresignedUrl = await getFullUrlMutation.mutateAsync({ s3_key: keyForFullView });
      if (fullPresignedUrl) {
        window.open(fullPresignedUrl, '_blank');
      } else {
        throw new Error("Failed to retrieve full media URL.");
      }
    } catch (error) {
      console.error("Error getting presigned URL for full view:", error);
      alert("Could not load full media: " + (error.message || "Unknown error"));
    }
  };

  //if (!item) return null;
  if (!item || !item.id) {
      console.warn("AlbumItem received invalid item data:", item);
      return null;
  }

  let fallbackIcon = LuFile; // Default fallback
  if (itemType === 'video') {
    fallbackIcon = LuVideo;
  } else if (itemType === 'audio') {
    fallbackIcon = LuMusic;
  } else if (itemType === 'image' && !previewUrl) { // Image type but no preview URL
    fallbackIcon = LuImage;
  }
  //const itemType = item.type || 'unknown';
  // Use presigned_thumbnail_url if available (for images, or video thumbs)
  // For videos, if no specific thumbnail, presigned_original_url might be used for a link
  //const previewUrl = item.presigned_url_for_display || (itemType === 'video' ? null : item.presigned_original_url);
  const isLoadingFullUrl = getFullUrlMutation.isPending &&
                           getFullUrlMutation.variables?.s3_key === item.s3_key_original;


  return (
    <Box
      key={item.id} // item.id is unique
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      boxShadow="md"
      position="relative"
      bg="white"
    >
      {onSelectItem && (
        <Checkbox
          position="absolute" top="10px" right="10px" size="lg" zIndex="1"
          isChecked={isSelected}
          onChange={() => {
                console.log("Checkbox in AlbumItem clicked for ID:", item.id); 
                if (item.id) { 
                onSelectItem(item.id);
                } else {
                  console.warn("Item is missing a selectable identifier URL:", item);
                }
            }}
          sx={{ /* ... checkbox styles ... */ }}
        />
      )}
      <Box height="200px" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={item.file_name || `Media ${item.id}`}
            width="80%" height="100%" objectFit="contain"
            //fallbackSrc="https://via.placeholder.com/200?text=Preview" // Fallback if presigned URL fails
            onError={(e) => {
                console.warn(`Failed to load image from presigned URL: ${previewUrl}`, e.target.error);
                // Optionally set a different fallback or state here
            }}
          />
        ) : (
          <Icon as={fallbackIcon} boxSize="60px" color="gray.400" />
        )}
      </Box>
      <VStack p={4} align="stretch" spacing={3}>
        {/* <Text fontSize="sm" fontWeight="semibold" noOfLines={1} title={item.file_name}>
          {item.file_name || 'Untitled'}
        </Text> */}
        {item.tags && Object.keys(item.tags).length > 0 && ( // Check if tags object is not empty
          <Wrap spacing={1} justify="flex-start" maxH="50px" overflowY="auto">
            {Object.entries(item.tags).slice(0,3).map(([label, count]) => ( // Iterate over object entries
              <Tag key={label} size="sm" variant="outline" colorScheme="gray">
                <TagLabel>{label.toUpperCase()} - {count}</TagLabel>
              </Tag>
            ))}
            {Object.keys(item.tags).length > 3 && <Tag size="sm">...</Tag>}
          </Wrap>
        )}
        <Button
          colorScheme={itemType === 'video' ? "green" : "red"}
          onClick={handleViewFull}
          isLoading={getFullUrlMutation.isPending} // Loading state for this specific action
          size="sm" // Making button a bit smaller
          width="full"
        >
          {itemType === 'video' ? "View Video" : "View Full Image"}
        </Button>
      </VStack>
    </Box>
  );
};

export default AlbumItem;