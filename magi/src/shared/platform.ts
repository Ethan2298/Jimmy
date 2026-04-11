export type Platform = "darwin" | "win32" | "linux";

export function normalizePlatform(rawPlatform: string): Platform {
  if (rawPlatform === "darwin" || rawPlatform === "win32") {
    return rawPlatform;
  }
  return "linux";
}
