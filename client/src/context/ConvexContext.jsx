import React, { createContext, useContext, useEffect, useState } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

// Get Convex URL from environment variables
const convexUrl = import.meta.env.VITE_CONVEX_URL || 'https://happy-animal-123.convex.cloud';
const convexClient = new ConvexReactClient(convexUrl);

export const ConvexContext = createContext();

export function AppConvexProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Convex automatically handles connection state
    setIsConnected(true);
  }, []);

  return (
    <ConvexProvider client={convexClient}>
      <ConvexContext.Provider value={{ isConnected }}>
        {children}
      </ConvexContext.Provider>
    </ConvexProvider>
  );
}

export function useConvexState() {
  return useContext(ConvexContext);
}
