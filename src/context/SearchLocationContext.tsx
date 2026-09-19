// src/context/SearchLocationContext.tsx
import React, { createContext, useState, useContext } from 'react';

interface SearchLocation {
  latitude: number;
  longitude: number;
}

interface SearchLocationContextType {
  location: SearchLocation | null;
  setLocation: (location: SearchLocation | null) => void;
  searchMode: boolean;
  setSearchMode: (mode: boolean) => void;
  userCity: string | null;
  setUserCity: (city: string | null) => void;
  searchedCity: string | null;
  setSearchedCity: (city: string | null) => void;
}

const SearchLocationContext = createContext<SearchLocationContextType>({
  location: null,
  setLocation: () => {},
  searchMode: false,
  setSearchMode: () => {},
  userCity: null,
  setUserCity: () => {},
  searchedCity: null,
  setSearchedCity: () => {},
});

export const useSearchLocation = () => useContext(SearchLocationContext);

export const SearchLocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [location, setLocation] = useState<SearchLocation | null>(null);
  const [searchMode, setSearchMode] = useState<boolean>(false);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [searchedCity, setSearchedCity] = useState<string | null>(null);

  return (
    <SearchLocationContext.Provider 
      value={{ 
        location, setLocation, 
        searchMode, setSearchMode, 
        userCity, setUserCity, 
        searchedCity, setSearchedCity 
      }}
    >
      {children}
    </SearchLocationContext.Provider>
  );
};
