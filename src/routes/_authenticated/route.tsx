import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/gmos/app-shell";
import { WorkspaceProvider } from "@/components/gmos/workspace-context";
import { AuthzProvider } from "@/components/gmos/authz-context";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <AuthzProvider>
      <WorkspaceProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </WorkspaceProvider>
    </AuthzProvider>
  ),
});
