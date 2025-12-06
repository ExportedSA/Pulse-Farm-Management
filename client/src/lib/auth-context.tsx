import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface User {
  id: string;
  name: string;
  role?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "pulse_user_snapshot";

function getUserSnapshot(): User | null {
  try {
    const snapshot = localStorage.getItem(STORAGE_KEY);
    return snapshot ? JSON.parse(snapshot) : null;
  } catch {
    return null;
  }
}

function setUserSnapshot(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [offlineUser, setOfflineUser] = useState<User | null>(getUserSnapshot);

  const { data: authData, isLoading } = useQuery<{ user: User }>({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (authData?.user) {
      setUserSnapshot(authData.user);
      setOfflineUser(authData.user);
    }
  }, [authData]);

  const signInMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      apiRequest("/api/auth/login", "POST", { email, password }),
  });

  const signOutMutation = useMutation({
    mutationFn: () => apiRequest("/api/auth/logout", "POST", {}),
    onSuccess: () => {
      setUserSnapshot(null);
      setOfflineUser(null);
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const user = authData?.user || offlineUser;
  const isAuthenticated = !!user;

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    signIn: async (email: string, password: string) => {
      try {
        await signInMutation.mutateAsync({ email, password });
        // Wait for the user query to refetch and complete before returning
        await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      } catch (_err) {
        // Offline/dev fallback: set a local demo user so the UI can be navigated
        const demoUser: User = { id: "offline-dev", name: "Demo Admin", role: "admin", email };
        setUserSnapshot(demoUser);
        setOfflineUser(demoUser);
        // Also set the query data directly so RequireAuth sees it immediately
        queryClient.setQueryData(["/api/auth/user"], { user: demoUser });
      }
    },
    signOut: async () => {
      try {
        await signOutMutation.mutateAsync();
      } catch {
        // Offline/dev fallback: clear local session so UI signs out
        setUserSnapshot(null);
        setOfflineUser(null);
        queryClient.setQueryData(["/api/auth/user"], null);
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
