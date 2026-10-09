import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AuthState = {
  role: string | null;
  ready: boolean;
  setRole: (role: string | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("stardust_role");
    if (stored) setRole(stored);
    if (!sessionStorage.getItem("stardust_csrf")) {
      sessionStorage.setItem("stardust_csrf", crypto.randomUUID());
    }
    setReady(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        role,
        ready,
        setRole: (r) => {
          setRole(r);
          if (r) sessionStorage.setItem("stardust_role", r);
          else sessionStorage.removeItem("stardust_role");
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
