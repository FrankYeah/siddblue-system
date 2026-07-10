import { makeItemRoutes } from "@/lib/crud-routes";
import { deleteNote, getNote, updateNote } from "@/lib/notes-kv";
import type { Note, NoteInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET / PUT / DELETE /api/notes/[id] — 單筆筆記 (後台用，需驗證；
// 對外分享走 /shared/note/[token])。欄位清理交給 notes-kv 的 cleanInput。
const routes = makeItemRoutes<Note, NoteInput>({
  get: getNote,
  update: updateNote,
  remove: deleteNote,
  singular: "note",
  label: "筆記",
});

export const GET = routes.GET;
export const PUT = routes.PUT;
export const DELETE = routes.DELETE;
