"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AnalystUser } from "@/lib/types";

interface AuthContextType {
  analyst: AnalystUser | null;
  loading: boolean;
  availableAnalysts: AnalystUser[];
  login: (params: { analystId?: string; email?: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [analyst, setAnalyst] = useState<AnalystUser | null>(null);
  const [availableAnalysts, setAvailableAnalysts] = useState<AnalystUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshSession = async () => {
    try {
      const res = await fetch("/api/auth", { cache: "no-store" });
      const data = await res.json();
      if (data.authenticated && data.analyst) {
        setAnalyst(data.analyst);
      } else {
        setAnalyst(null);
      }
      if (data.availableAnalysts) {
        setAvailableAnalysts(data.availableAnalysts);
      }
    } catch (e) {
      console.error("Failed to check auth session:", e);
      setAnalyst(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = async (params: { analystId?: string; email?: string; password?: string }) => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success && data.analyst) {
        setAnalyst(data.analyst);
        return { success: true };
      }
      return { success: false, error: data.error || "Authentication failed" };
    } catch (e: any) {
      return { success: false, error: e?.message || "Network error during authentication" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
      setAnalyst(null);
    } catch (e) {
      console.error("Failed to sign out:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        analyst,
        loading,
        availableAnalysts,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
