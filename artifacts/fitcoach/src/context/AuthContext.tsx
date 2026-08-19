import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentAuthUser,
  getGetCurrentAuthUserQueryKey,
  type AuthUser,
} from "@workspace/api-client-react";
import { initIap, resetIap } from "@/lib/iap";

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

  // Bind the App Store purchase identity to the signed-in account.
  //
  // Doing it here rather than at the login call site covers every way a session
  // begins — sign-up, sign-in, and a cold app launch restoring an existing
  // session — with one code path. The store's "app user id" is set to our own
  // user id, which is what lets Apple's receipt webhook map a purchase back to
  // an account with no extra lookup.
  //
  // No-op on web: initIap/resetIap return immediately when not running inside
  // the native shell, and the purchases SDK is never even imported there.
  const boundUserId = useRef<string | null>(null);
  const userId = data?.user?.id ?? null;
  useEffect(() => {
    if (userId === boundUserId.current) return;
    boundUserId.current = userId;
    if (userId) void initIap(userId);
    else void resetIap();
  }, [userId]);

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
