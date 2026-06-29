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

  return (
    <AuthContext.Provider
      value={{ authUser: data?.user ?? null, isLoading, refreshAuth }}
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
