import React, { createContext, useContext, useState } from 'react';

interface VigiaCreationContextType {
  isCreatingVigia: boolean;
  setIsCreatingVigia: (value: boolean) => void;
}

const VigiaCreationContext = createContext<VigiaCreationContextType>({
  isCreatingVigia: false,
  setIsCreatingVigia: () => {},
});

export function VigiaCreationProvider({ children }: { children: React.ReactNode }) {
  const [isCreatingVigia, setIsCreatingVigia] = useState(false);

  return (
    <VigiaCreationContext.Provider value={{ isCreatingVigia, setIsCreatingVigia }}>
      {children}
    </VigiaCreationContext.Provider>
  );
}

export function useVigiaCreation() {
  return useContext(VigiaCreationContext);
}
