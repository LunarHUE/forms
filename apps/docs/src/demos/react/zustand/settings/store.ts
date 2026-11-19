import { create } from "zustand";

export interface Settings {
  displayName: string;
  timezone: string;
}

// The app's store, with more in it than the form edits.
interface AppState {
  settings: Settings;
  theme: "light" | "dark";
}

export const useAppStore = create<AppState>()(() => ({
  settings: { displayName: "Ada", timezone: "Europe/London" },
  theme: "light",
}));
