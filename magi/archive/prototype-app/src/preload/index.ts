import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  platform: process.platform,
  windowMinimize: () => ipcRenderer.send("window:minimize"),
  windowMaximize: () => ipcRenderer.send("window:maximize"),
  windowClose: () => ipcRenderer.send("window:close"),
  chat: (request: unknown) => ipcRenderer.invoke("chat:send", request),
  getApiKey: () => ipcRenderer.invoke("apiKey:get"),
  setApiKey: (key: string) => ipcRenderer.invoke("apiKey:set", key),
  onChatStreamDelta: (streamId: string, cb: (text: string) => void) => {
    ipcRenderer.on(`chat:stream:${streamId}:delta`, (_event, text: string) => cb(text));
  },
  onChatStreamDone: (streamId: string, cb: () => void) => {
    ipcRenderer.on(`chat:stream:${streamId}:done`, () => cb());
  },
  onChatStreamError: (streamId: string, cb: (error: string) => void) => {
    ipcRenderer.on(`chat:stream:${streamId}:error`, (_event, error: string) => cb(error));
  },
  offChatStream: (streamId: string) => {
    ipcRenderer.removeAllListeners(`chat:stream:${streamId}:delta`);
    ipcRenderer.removeAllListeners(`chat:stream:${streamId}:done`);
    ipcRenderer.removeAllListeners(`chat:stream:${streamId}:error`);
  },
  loadData: () => ipcRenderer.invoke("data:load"),
  saveData: (json: string) => ipcRenderer.invoke("data:save", json),
});
