export type CaptureLook = {
  greenscreen: boolean;
  showMouse: boolean;
};

export type CapturePngResult = "ok" | "no-selection" | "out-of-view" | "failed";

export type RecordGifResult =
  | "ok"
  | "ok-capped"
  | "too-large"
  | "cancelled"
  | "no-selection"
  | "out-of-view"
  | "failed";
