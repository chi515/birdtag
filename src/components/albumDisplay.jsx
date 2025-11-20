// src/components/AlbumDisplay.jsx
import React from 'react';
import { Box, SimpleGrid, Heading, Text, Spinner, Flex } from '@chakra-ui/react';
import AlbumItem from './AlbumItem';

const AlbumDisplay = ({ items, isLoading, onSelectItem, selectedItemsSet }) => {
  // isLoading now refers to the search operation itself
  if (isLoading && (!items || items.length === 0)) {
    return <Flex justify="center" align="center" minH="200px"><Spinner size="xl" /></Flex>;
  }

  if (!items || items.length === 0) {
    return <Text textAlign="center" mt={10}>No items found matching your criteria.</Text>;
  }

  return (
    <Box w="full" mt={8}>
      <Heading as="h2" size="lg" mb={6}>Album</Heading>
      <SimpleGrid
        columns={{ base: 1, sm: 2, md: 3, lg: 4 }}
        spacing={{ base: 4, md: 6 }}
      >
        {items.map((item) => ( // 'items' should be the 'results' array from search_lambda
          <AlbumItem
            key={item.id} // Use the unique ID from your search results
            item={item}
            onSelectItem={onSelectItem}
            isSelected={selectedItemsSet && selectedItemsSet.has(item.id)}
          />
        ))}
      </SimpleGrid>
    </Box>
  );
};

export default AlbumDisplay;