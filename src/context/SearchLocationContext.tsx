// src/context/SearchLocationContext.tsx
import React, { createContext, useState, useContext } from 'react';

interface SearchLocation {
  latitude: number;
  longitude: number;
}

interface SearchLocationContextType {
  location: SearchLocation | null;
  setLocation: (location: SearchLocation) => void;
}

const SearchLocationContext = createContext<SearchLocationContextType>({
  location: null,
  setLocation: () => {},
});

export const useSearchLocation = () => useContext(SearchLocationContext);

export const SearchLocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [location, setLocation] = useState<SearchLocation | null>(null);

  return (
    <SearchLocationContext.Provider value={{ location, setLocation }}>
      {children}
    </SearchLocationContext.Provider>
  );
};
