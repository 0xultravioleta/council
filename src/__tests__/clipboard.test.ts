import { describe, it, expect, vi, beforeEach } from "vitest";
import * as childProcess from "node:child_process";

// Mock child_process
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

describe("clipboard utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getClipboardCommand", () => {
    it("should detect macOS clipboard", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });

      vi.resetModules();
      const { getClipboardCommand } = await import("../lib/clipboard.js");
      const cmd = getClipboardCommand();

      expect(cmd?.copy).toContain("pbcopy");
      expect(cmd?.paste).toContain("pbpaste");

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should detect Linux clipboard with xclip", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from("/usr/bin/xclip"));

      vi.resetModules();
      const { getClipboardCommand } = await import("../lib/clipboard.js");
      const cmd = getClipboardCommand();

      expect(cmd?.copy).toContain("xclip");

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should detect Windows clipboard", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      vi.resetModules();
      const { getClipboardCommand } = await import("../lib/clipboard.js");
      const cmd = getClipboardCommand();

      expect(cmd?.copy).toContain("clip");

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });

  describe("isClipboardAvailable", () => {
    it("should return true when clipboard is available", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });

      vi.resetModules();
      const { isClipboardAvailable } = await import("../lib/clipboard.js");
      expect(isClipboardAvailable()).toBe(true);

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });
});

describe("copyToClipboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return false when clipboard unavailable", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "unknown" });

    vi.resetModules();
    const { copyToClipboard } = await import("../lib/clipboard.js");
    const result = await copyToClipboard("test");

    expect(result).toBe(false);

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });
});
