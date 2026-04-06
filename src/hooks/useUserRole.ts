import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "basic" | "premium" | "admin";

export function useUserRole() {
  const [role, setRole] = useState<UserRole>("basic");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!error && data && data.length > 0) {
        // Pick highest priority role
        const roles = data.map((r: any) => r.role as UserRole);
        if (roles.includes("admin")) setRole("admin");
        else if (roles.includes("premium")) setRole("premium");
        else setRole("basic");
      }
      setIsLoading(false);
    };

    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { role, isLoading, isAdmin: role === "admin", isPremium: role === "premium" || role === "admin" };
}
