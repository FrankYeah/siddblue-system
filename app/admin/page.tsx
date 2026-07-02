import { isAuthenticated, adminPasswordSet } from "@/lib/auth";
import { listQuotes } from "@/lib/kv";
import { getInspirations, getTodos } from "@/lib/workspace-kv";
import AdminLogin from "./AdminLogin";
import AdminWorkspace from "./AdminWorkspace";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAuthenticated()) {
    return <AdminLogin />;
  }

  const [quotes, inspirations, todos] = await Promise.all([
    listQuotes(),
    getInspirations(),
    getTodos(),
  ]);

  return (
    <AdminWorkspace
      initialQuotes={quotes}
      initialInspirations={inspirations}
      initialTodos={todos}
      protectedMode={adminPasswordSet()}
    />
  );
}
