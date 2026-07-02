import { isAuthenticated, adminPasswordSet } from "@/lib/auth";
import { listQuotes } from "@/lib/kv";
import { getInspirations, getTodos } from "@/lib/workspace-kv";
import { getAllNotes } from "@/lib/notes-kv";
import AdminLogin from "./AdminLogin";
import AdminWorkspace from "./AdminWorkspace";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAuthenticated()) {
    return <AdminLogin />;
  }

  const [quotes, inspirations, todos, notes] = await Promise.all([
    listQuotes(),
    getInspirations(),
    getTodos(),
    getAllNotes(),
  ]);

  return (
    <AdminWorkspace
      initialQuotes={quotes}
      initialInspirations={inspirations}
      initialTodos={todos}
      initialNotes={notes}
      protectedMode={adminPasswordSet()}
    />
  );
}
