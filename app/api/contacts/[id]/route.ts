import { makeItemRoutes } from "@/lib/crud-routes";
import { deleteContact, getContact, updateContact } from "@/lib/contacts-kv";
import type { Contact, ContactInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET / PUT / DELETE /api/contacts/[id] — 單筆聯絡人 (需驗證)
const routes = makeItemRoutes<Contact, ContactInput>({
  get: getContact,
  update: updateContact,
  remove: deleteContact,
  singular: "contact",
  label: "聯絡人",
});

export const GET = routes.GET;
export const PUT = routes.PUT;
export const DELETE = routes.DELETE;
