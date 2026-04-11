import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";

function createWindow() {
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: isMac,
    titleBarStyle: isMac ? "hiddenInset" : undefined,
    trafficLightPosition: isMac ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

// --- API Key storage ---

const keyFilePath = () => path.join(app.getPath("userData"), "api-key.json");

ipcMain.handle("apiKey:get", async () => {
  try {
    const filePath = keyFilePath();
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return data.key ?? null;
  } catch {
    return null;
  }
});

ipcMain.handle("apiKey:set", async (_event, key: string) => {
  try {
    const filePath = keyFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ key }), "utf-8");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

// --- User data sync (janky cloud storage) ---

const dataFilePath = () => path.join(app.getAppPath(), "user-data.json");

ipcMain.handle("data:load", async () => {
  try {
    const filePath = dataFilePath();
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
});

ipcMain.handle("data:save", async (_event, json: string) => {
  try {
    fs.writeFileSync(dataFilePath(), json, "utf-8");
  } catch (err) {
    console.error("[data:save]", err);
  }
});

// --- Chat handler ---

interface ChatRequest {
  apiKey: string;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  tools: Anthropic.Messages.Tool[];
}

ipcMain.handle("chat:send", async (event, request: ChatRequest) => {
  try {
    const client = new Anthropic({ apiKey: request.apiKey });

    let messages: Anthropic.Messages.MessageParam[] = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const allToolCalls: { name: string; input: Record<string, unknown> }[] = [];
    let loopCount = 0;

    while (loopCount < 10) {
      loopCount++;

      const response = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 1024,
        system: request.systemPrompt,
        messages,
        tools: request.tools.length > 0 ? request.tools : undefined,
      });

      // Extract tool use blocks
      const toolUseBlocks: Anthropic.Messages.ToolUseBlock[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          toolUseBlocks.push(block);
        }
      }

      if (toolUseBlocks.length === 0 || response.stop_reason !== "tool_use") {
        // No more tool calls, we're done with the loop
        break;
      }

      // Collect tool calls for the renderer
      for (const toolBlock of toolUseBlocks) {
        allToolCalls.push({
          name: toolBlock.name,
          input: toolBlock.input as Record<string, unknown>,
        });
      }

      // If a task-modifying tool was used, stop the loop — one task action per turn
      const hasTaskTool = toolUseBlocks.some((b) =>
        ["set_task", "edit_task", "complete_task", "delete_task"].includes(b.name)
      );
      if (hasTaskTool) break;

      // Build assistant message with all content blocks
      messages = [
        ...messages,
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: toolUseBlocks.map((toolBlock) => ({
            type: "tool_result" as const,
            tool_use_id: toolBlock.id,
            content: "OK",
          })),
        },
      ];
    }

    // Generate a stream ID and start streaming the final response
    const streamId = randomUUID();
    const sender = event.sender;

    // Fire-and-forget: stream the final text response
    (async () => {
      try {
        const stream = client.messages.stream({
          model: "claude-opus-4-6",
          max_tokens: 1024,
          system: request.systemPrompt,
          messages,
          // No tools on the streaming call — tool loop is already done
        });

        stream.on("text", (text) => {
          if (!sender.isDestroyed()) {
            sender.send(`chat:stream:${streamId}:delta`, text);
          }
        });

        await stream.finalMessage();

        if (!sender.isDestroyed()) {
          sender.send(`chat:stream:${streamId}:done`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (!sender.isDestroyed()) {
          sender.send(`chat:stream:${streamId}:error`, message);
        }
      }
    })();

    return { streamId, toolCalls: allToolCalls };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { streamId: "", toolCalls: [], error: message };
  }
});

// --- Window controls ---

ipcMain.on("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on("window:maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.on("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
