import { createContext, useContext, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentAuthUser,
  getGetCurrentAuthUserQueryKey,
  type AuthUser,
} from "@workspace/api-client-react";

interface AuthContextValue {
  authUser: AuthUser | null;
  isLoading: boolean;
  refreshAuth: () => Promise<void>;
  /**
   * Synchronously seed the auth cache with a known user (e.g. the envelope
   * returned by register/login) so `authUser` is non-null immediately. Without
   * this, navigating right after signup can run before the auth query refetch
   * lands, and the signed-out guard bounces the new user back to the marketing
   * page instead of into onboarding.
   */
  setAuthUser: (envelope: { user: AuthUser | null }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetCurrentAuthUser({
    query: {
      queryKey: getGetCurrentAuthUserQueryKey(),
      retry: false,
      staleTime: 0,
    },
  });

  const refreshAuth = async () => {
    await queryClient.invalidateQueries({
      queryKey: getGetCurrentAuthUserQueryKey(),
    });
  };

  const setAuthUser = (envelope: { user: AuthUser | null }) => {
    queryClient.setQueryData(getGetCurrentAuthUserQueryKey(), envelope);
  };

  return (
    <AuthContext.Provider
      value={{ authUser: data?.user ?? null, isLoading, refreshAuth, setAuthUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAccount(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAccount must be used within AuthProvider");
  return ctx;
}
