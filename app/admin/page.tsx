import { isAuthenticated, adminPasswordSet } from "@/lib/auth";
import { listQuotes } from "@/lib/kv";
import { getInspirationsView, getTodosView } from "@/lib/workspace-kv";
import { getAllNotes } from "@/lib/notes-kv";
import { getAllCases } from "@/lib/cases-kv";
import { getContactsView } from "@/lib/contacts-kv";
import { getAllExpenses } from "@/lib/expenses-kv";
import AdminLogin from "./AdminLogin";
import AdminWorkspace from "./AdminWorkspace";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAuthenticated()) {
    return <AdminLogin />;
  }

  const [quotes, inspirations, todos, notes, cases, contactsView, expenses] =
    await Promise.all([
      listQuotes(),
      getInspirationsView(),
      getTodosView(),
      getAllNotes(),
      getAllCases(),
      getContactsView(),
      getAllExpenses(),
    ]);

  return (
    <AdminWorkspace
      initialQuotes={quotes}
      initialInspirations={inspirations.board}
      initialInspirationsRev={inspirations.rev}
      initialTodos={todos.board}
      initialTodosRev={todos.rev}
      initialNotes={notes}
      initialCases={cases}
      initialContacts={contactsView.contacts}
      initialContactsOrdered={contactsView.ordered}
      initialExpenses={expenses}
      protectedMode={adminPasswordSet()}
    />
  );
}
