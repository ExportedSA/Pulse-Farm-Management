import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface UnreadCounts {
  [channelId: string]: number;
}

interface ChatContextType {
  unreadCounts: UnreadCounts;
  setUnreadCounts: (counts: UnreadCounts) => void;
  incrementUnreadCount: (channelId: string) => void;
  clearUnreadCount: (channelId: string) => void;
  getTotalUnreadCount: () => number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});

  const incrementUnreadCount = useCallback((channelId: string) => {
    setUnreadCounts(prev => ({
      ...prev,
      [channelId]: (prev[channelId] || 0) + 1
    }));
  }, []);

  const clearUnreadCount = useCallback((channelId: string) => {
    setUnreadCounts(prev => ({
      ...prev,
      [channelId]: 0
    }));
  }, []);

  const getTotalUnreadCount = useCallback(() => {
    return Object.values(unreadCounts).reduce((total, count) => total + count, 0);
  }, [unreadCounts]);

  const value: ChatContextType = {
    unreadCounts,
    setUnreadCounts,
    incrementUnreadCount,
    clearUnreadCount,
    getTotalUnreadCount,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
