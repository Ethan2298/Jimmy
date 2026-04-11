export type EventKind =
  | "window_focus"
  | "app_switch"
  | "screenshot"
  | "clipboard"
  | "idle_start"
  | "idle_end"
  | "typing_start"
  | "typing_end";

export interface WindowFocusData {
  app: string;
  title: string;
  pid: number;
}

export interface AppSwitchData {
  from_app: string;
  from_title: string;
  to_app: string;
  to_title: string;
  duration_ms: number;
}

export interface ScreenshotData {
  path: string;
  width: number;
  height: number;
}

export interface ClipboardData {
  text: string;
  length: number;
}

export interface IdleStartData {
  idle_seconds: number;
}

export interface IdleEndData {
  duration_ms: number;
}

export interface TypingStartData {
  /* intentionally empty — marks session start */
}

export interface TypingEndData {
  key_count: number;
  duration_ms: number;
}

export type EventData =
  | WindowFocusData
  | AppSwitchData
  | ScreenshotData
  | ClipboardData
  | IdleStartData
  | IdleEndData
  | TypingStartData
  | TypingEndData;
