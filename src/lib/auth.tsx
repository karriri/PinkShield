import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Ctx = { session: Session | null; userId: string | null; ready: boolean };
const AuthCtx = createContext<Ctx>({ session: null, userId: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setReady(true);
      if (event === "SIGNED_OUT") qc.clear();
      else if (event === "SIGNED_IN" || event === "USER_UPDATED") qc.invalidateQueries();
    });
    supabase.auth.getSession().then(({ data: d }) => { setSession(d.session); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  return <AuthCtx.Provider value={{ session, userId: session?.user.id ?? null, ready }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export function useMyProfile() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsAdmin() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: userId!, _role: "admin" });
      if (error) throw error;
      return !!data;
    },
  });
}

export function useMyRestriction() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: ["restriction", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("account_restrictions").select("*").eq("user_id", userId!).maybeSingle();
      if (!data) return null;
      return !data.until || new Date(data.until) > new Date() ? data : null;
    },
  });
}

/** Keep the profile timezone in sync with the browser so reminders fire at local times. */
export function useTimezoneSync() {
  const { data } = useMyProfile();
  const qc = useQueryClient();
  useEffect(() => {
    if (!data) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== data.timezone) {
      supabase.from("profiles").update({ timezone: tz }).eq("id", data.id).then(() => qc.invalidateQueries({ queryKey: ["profile"] }));
    }
  }, [data, qc]);
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}
