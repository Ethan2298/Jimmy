import { ipcMain, BrowserWindow } from "electron";

ipcMain.handle("magi:minimize", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.minimize();
});

ipcMain.handle("magi:maximize", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.handle("magi:close", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.close();
});
