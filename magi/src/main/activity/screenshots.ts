import { desktopCapturer, app } from "electron";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { insertEvent } from "./db";

let interval: ReturnType<typeof setInterval> | null = null;

const CAPTURE_INTERVAL_MS = 30_000;
const JPEG_QUALITY = 80;
const THUMBNAIL_SIZE = { width: 1920, height: 1080 };

function getScreenshotDir(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return path.join(app.getPath("userData"), "screenshots", `${yyyy}-${mm}-${dd}`);
}

function getFilename(): string {
  const date = new Date();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const shortId = randomUUID().slice(0, 8);
  return `${hh}${mm}${ss}-${shortId}.jpg`;
}

async function captureScreen(): Promise<void> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: THUMBNAIL_SIZE,
    });

    if (sources.length === 0) return;

    const source = sources[0];
    const image = source.thumbnail;
    if (image.isEmpty()) return;

    const dir = getScreenshotDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filename = getFilename();
    const fullPath = path.join(dir, filename);
    const jpeg = image.toJPEG(JPEG_QUALITY);
    fs.writeFileSync(fullPath, jpeg);

    // Store path relative to userData
    const userDataDir = app.getPath("userData");
    const relativePath = path.relative(userDataDir, fullPath).replace(/\\/g, "/");

    insertEvent("screenshot", {
      path: relativePath,
      width: image.getSize().width,
      height: image.getSize().height,
    });
  } catch (err) {
    console.error("[activity] Screenshot capture failed:", err);
  }
}

export function startScreenshots(): void {
  // Capture immediately, then on interval
  captureScreen();
  interval = setInterval(captureScreen, CAPTURE_INTERVAL_MS);
  console.log("[activity] Screenshots started (30s interval)");
}

export function stopScreenshots(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
    console.log("[activity] Screenshots stopped");
  }
}
