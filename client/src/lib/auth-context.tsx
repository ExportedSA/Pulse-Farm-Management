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
    const user: User | null = snapshot ? JSON.parse(snapshot) : null;
    // Drop the fake user an earlier build stored when login failed
    if (user?.id === "offline-dev") {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

// apiRequest errors look like "401: {json body}"
function getStatus(err: unknown): number | null {
  const match = err instanceof Error ? /^(\d{3}):/.exec(err.message) : null;
  return match ? Number(match[1]) : null;
}

function signInErrorMessage(err: unknown): string {
  const status = getStatus(err);
  if (status === 401) return "Invalid email or password";
  if (status === 429) return "Too many sign-in attempts. Please wait a minute and try again.";
  if (status === null) return "Can't reach the Pulse server. Check your connection and try again.";
  return "Sign-in failed. Please try again.";
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

  const { data: authData, isLoading, error: authError } = useQuery<{ user: User }>({
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

  // The server says the session is gone, so the cached user must not keep the UI signed in.
  // Other failures (offline, server down) keep the cached user for offline use.
  useEffect(() => {
    if (getStatus(authError) === 401) {
      setUserSnapshot(null);
      setOfflineUser(null);
    }
  }, [authError]);

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
      } catch (err) {
        throw new Error(signInErrorMessage(err));
      }
      // Wait for the user query to refetch and complete before returning
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
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
