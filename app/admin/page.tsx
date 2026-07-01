import { isAuthenticated, adminPasswordSet } from "@/lib/auth";
import { listQuotes } from "@/lib/kv";
import AdminLogin from "./AdminLogin";
import AdminEditor from "./AdminEditor";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAuthenticated()) {
    return <AdminLogin />;
  }

  const quotes = await listQuotes();
  return (
    <AdminEditor initialQuotes={quotes} protectedMode={adminPasswordSet()} />
  );
}
