import { ipcMain } from "electron";
import { z } from "zod";
import { workspace } from "../db/queries";
import type { WorkspaceLoadResult, WorkspaceSaveResult } from "../../shared/workspace";

const workspaceItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["folder", "doc", "project"]),
  name: z.string(),
  parentId: z.string().nullable(),
  sortOrder: z.number().finite(),
  collapsed: z.boolean().optional(),
  projectKind: z.literal("dummy").optional(),
});

const workspaceMainViewSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chat") }),
  z.object({ type: z.literal("workspace-item"), itemId: z.string().min(1) }),
]);

const workspaceSnapshotSchema = z.object({
  items: z.record(z.string(), workspaceItemSchema),
  docContentById: z.record(z.string(), z.string()),
  rootIds: z.array(z.string()),
  selectedId: z.string().nullable(),
  editingId: z.string().nullable(),
  mainView: workspaceMainViewSchema,
});

const saveDocSchema = z.object({
  docId: z.string().min(1),
  markdown: z.string(),
});

const saveUiSchema = z.object({
  selectedId: z.string().nullable(),
  mainView: workspaceMainViewSchema,
});

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

ipcMain.handle("workspace:load", async () => {
  try {
    const snapshot = workspace.loadSnapshot();
    const result: WorkspaceLoadResult = { ok: true, snapshot };
    return result;
  } catch (error) {
    const result: WorkspaceLoadResult = {
      ok: false,
      error: toErrorMessage(error),
    };
    return result;
  }
});

ipcMain.handle("workspace:replaceSnapshot", async (_event, payload: unknown) => {
  try {
    const parsed = workspaceSnapshotSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; "),
      } satisfies WorkspaceSaveResult;
    }

    workspace.replaceSnapshot(parsed.data);
    return { ok: true } satisfies WorkspaceSaveResult;
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    } satisfies WorkspaceSaveResult;
  }
});

ipcMain.handle("workspace:saveDoc", async (_event, payload: unknown) => {
  try {
    const parsed = saveDocSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; "),
      } satisfies WorkspaceSaveResult;
    }

    workspace.saveDoc(parsed.data.docId, parsed.data.markdown);
    return { ok: true } satisfies WorkspaceSaveResult;
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    } satisfies WorkspaceSaveResult;
  }
});

const toggleCollapsedSchema = z.object({
  id: z.string().min(1),
  collapsed: z.boolean(),
});

const renameItemSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
});

const sortOrderPairSchema = z.object({
  id: z.string().min(1),
  sortOrder: z.number().finite(),
});

const addItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["folder", "doc", "project"]),
  name: z.string(),
  parentId: z.string().nullable(),
  sortOrder: z.number().finite(),
  collapsed: z.boolean().optional(),
  projectKind: z.literal("dummy").optional(),
  docContent: z.string().optional(),
  uncollapseParentId: z.string().nullable().optional(),
});

const deleteItemSchema = z.object({
  id: z.string().min(1),
  siblingReorders: z.array(sortOrderPairSchema),
});

const moveItemSchema = z.object({
  id: z.string().min(1),
  newParentId: z.string().nullable(),
  siblingReorders: z.array(sortOrderPairSchema),
});

ipcMain.handle("workspace:toggleCollapsed", async (_event, payload: unknown) => {
  try {
    const parsed = toggleCollapsedSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; "),
      } satisfies WorkspaceSaveResult;
    }

    workspace.toggleCollapsed(parsed.data);
    return { ok: true } satisfies WorkspaceSaveResult;
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    } satisfies WorkspaceSaveResult;
  }
});

ipcMain.handle("workspace:renameItem", async (_event, payload: unknown) => {
  try {
    const parsed = renameItemSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; "),
      } satisfies WorkspaceSaveResult;
    }

    workspace.renameItem(parsed.data);
    return { ok: true } satisfies WorkspaceSaveResult;
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    } satisfies WorkspaceSaveResult;
  }
});

ipcMain.handle("workspace:addItem", async (_event, payload: unknown) => {
  try {
    const parsed = addItemSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; "),
      } satisfies WorkspaceSaveResult;
    }

    workspace.addItem(parsed.data);
    return { ok: true } satisfies WorkspaceSaveResult;
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    } satisfies WorkspaceSaveResult;
  }
});

ipcMain.handle("workspace:deleteItem", async (_event, payload: unknown) => {
  try {
    const parsed = deleteItemSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; "),
      } satisfies WorkspaceSaveResult;
    }

    workspace.deleteItem(parsed.data);
    return { ok: true } satisfies WorkspaceSaveResult;
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    } satisfies WorkspaceSaveResult;
  }
});

ipcMain.handle("workspace:moveItem", async (_event, payload: unknown) => {
  try {
    const parsed = moveItemSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; "),
      } satisfies WorkspaceSaveResult;
    }

    workspace.moveItem(parsed.data);
    return { ok: true } satisfies WorkspaceSaveResult;
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    } satisfies WorkspaceSaveResult;
  }
});

ipcMain.handle("workspace:saveUi", async (_event, payload: unknown) => {
  try {
    const parsed = saveUiSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join("; "),
      } satisfies WorkspaceSaveResult;
    }

    workspace.updateUiState(parsed.data);
    return { ok: true } satisfies WorkspaceSaveResult;
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    } satisfies WorkspaceSaveResult;
  }
});
