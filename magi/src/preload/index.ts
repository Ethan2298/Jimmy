import { contextBridge, ipcRenderer } from "electron";
import type { AIProvider } from "../shared/ai-provider";
import type {
  WorkspaceAddItemInput,
  WorkspaceDeleteItemInput,
  WorkspaceLoadResult,
  WorkspaceMoveItemInput,
  WorkspaceRenameItemInput,
  WorkspaceSaveDocInput,
  WorkspaceSaveResult,
  WorkspaceSaveUiInput,
  WorkspaceSnapshot,
  WorkspaceToggleCollapsedInput,
} from "../shared/workspace";

contextBridge.exposeInMainWorld("api", {
  platform: process.platform,
  chat: (request: unknown) => ipcRenderer.invoke("chat:send", request),
  cancelChatStream: (streamId: string) => ipcRenderer.invoke("chat:cancel", { streamId }),
  approveChatTool: (streamId: string, approvalId: string, approved: boolean) =>
    ipcRenderer.invoke("chat:approveTool", { streamId, approvalId, approved }),
  onChatStreamChunk: (streamId: string, cb: (event: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on(`chat:stream:${streamId}:chunk`, handler);
    return () => { ipcRenderer.removeListener(`chat:stream:${streamId}:chunk`, handler); };
  },
  onChatStreamChunks: (streamId: string, cb: (events: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown[]) => cb(data);
    ipcRenderer.on(`chat:stream:${streamId}:chunks`, handler);
    return () => { ipcRenderer.removeListener(`chat:stream:${streamId}:chunks`, handler); };
  },
  onChatToolApproval: (streamId: string, cb: (event: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on(`chat:stream:${streamId}:approval`, handler);
    return () => { ipcRenderer.removeListener(`chat:stream:${streamId}:approval`, handler); };
  },
  onChatStreamStatus: (streamId: string, cb: (event: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on(`chat:stream:${streamId}:status`, handler);
    return () => { ipcRenderer.removeListener(`chat:stream:${streamId}:status`, handler); };
  },
  onChatStreamDone: (streamId: string, cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on(`chat:stream:${streamId}:done`, handler);
    return () => { ipcRenderer.removeListener(`chat:stream:${streamId}:done`, handler); };
  },
  onChatStreamError: (streamId: string, cb: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => cb(error);
    ipcRenderer.on(`chat:stream:${streamId}:error`, handler);
    return () => { ipcRenderer.removeListener(`chat:stream:${streamId}:error`, handler); };
  },
  onChatStreamUsage: (streamId: string, cb: (usage: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => cb(data);
    ipcRenderer.on(`chat:stream:${streamId}:usage`, handler);
    return () => { ipcRenderer.removeListener(`chat:stream:${streamId}:usage`, handler); };
  },
  offChatStream: (streamId: string) => {
    ipcRenderer.removeAllListeners(`chat:stream:${streamId}:chunk`);
    ipcRenderer.removeAllListeners(`chat:stream:${streamId}:chunks`);
    ipcRenderer.removeAllListeners(`chat:stream:${streamId}:approval`);
    ipcRenderer.removeAllListeners(`chat:stream:${streamId}:status`);
    ipcRenderer.removeAllListeners(`chat:stream:${streamId}:done`);
    ipcRenderer.removeAllListeners(`chat:stream:${streamId}:error`);
    ipcRenderer.removeAllListeners(`chat:stream:${streamId}:usage`);
  },
  getApiKey: () => ipcRenderer.invoke("apiKey:get"),
  setApiKey: (key: string) => ipcRenderer.invoke("apiKey:set", key),
  getApiKeysStatus: () => ipcRenderer.invoke("apiKeys:getStatus"),
  setApiKeyForProvider: (provider: AIProvider, key: string) =>
    ipcRenderer.invoke("apiKeys:set", { provider, key }),
  getRecentActivity: (sinceMinutes: number): Promise<string> =>
    ipcRenderer.invoke("activity:recent", { sinceMinutes }),
  loadData: () => ipcRenderer.invoke("data:load"),
  saveData: (json: string) => ipcRenderer.invoke("data:save", json),
  workspaceLoad: (): Promise<WorkspaceLoadResult> => ipcRenderer.invoke("workspace:load"),
  workspaceReplaceSnapshot: (
    snapshot: WorkspaceSnapshot
  ): Promise<WorkspaceSaveResult> => ipcRenderer.invoke("workspace:replaceSnapshot", snapshot),
  workspaceSaveDoc: (payload: WorkspaceSaveDocInput): Promise<WorkspaceSaveResult> =>
    ipcRenderer.invoke("workspace:saveDoc", payload),
  workspaceSaveUi: (payload: WorkspaceSaveUiInput): Promise<WorkspaceSaveResult> =>
    ipcRenderer.invoke("workspace:saveUi", payload),
  workspaceToggleCollapsed: (payload: WorkspaceToggleCollapsedInput): Promise<WorkspaceSaveResult> =>
    ipcRenderer.invoke("workspace:toggleCollapsed", payload),
  workspaceRenameItem: (payload: WorkspaceRenameItemInput): Promise<WorkspaceSaveResult> =>
    ipcRenderer.invoke("workspace:renameItem", payload),
  workspaceAddItem: (payload: WorkspaceAddItemInput): Promise<WorkspaceSaveResult> =>
    ipcRenderer.invoke("workspace:addItem", payload),
  workspaceDeleteItem: (payload: WorkspaceDeleteItemInput): Promise<WorkspaceSaveResult> =>
    ipcRenderer.invoke("workspace:deleteItem", payload),
  workspaceMoveItem: (payload: WorkspaceMoveItemInput): Promise<WorkspaceSaveResult> =>
    ipcRenderer.invoke("workspace:moveItem", payload),
  minimize: () => ipcRenderer.invoke("magi:minimize"),
  maximize: () => ipcRenderer.invoke("magi:maximize"),
  close: () => ipcRenderer.invoke("magi:close"),
});
