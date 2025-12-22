import { describe, it, expect } from "vitest";
import { MessageSchema, createMessage, validateMessage } from "../lib/message.js";

describe("MessageSchema", () => {
  it("should validate a question message", () => {
    const message = {
      thread_id: "th_20251222_180000_abc",
      message_id: "msg_180000_xyz",
      from: "402milly",
      to: "Facilitador",
      type: "question",
      timestamp: "2025-12-22T18:00:00.000Z",
      summary: "payment fails after quote",
      questions: ["what fields does /pay validate"],
      asks: ["correlate logs by request id"],
    };

    const result = MessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });

  it("should validate a human context injection", () => {
    const message = {
      thread_id: "th_20251222_180000_abc",
      message_id: "msg_180100_xyz",
      from: "HUMAN",
      to: "ALL",
      type: "context_injection",
      timestamp: "2025-12-22T18:01:00.000Z",
      summary: "extra context from operator",
      notes: ["this started after deploy abc123", "prioritize header mismatch"],
    };

    const result = MessageSchema.safeParse(message);
    expect(result.success).toBe(true);
  });

  it("should reject invalid message type", () => {
    const message = {
      thread_id: "th_20251222_180000_abc",
      message_id: "msg_180000_xyz",
      from: "402milly",
      to: "Facilitador",
      type: "invalid_type",
      timestamp: "2025-12-22T18:00:00.000Z",
      summary: "test",
    };

    const result = MessageSchema.safeParse(message);
    expect(result.success).toBe(false);
  });

  it("should reject message without required fields", () => {
    const message = {
      thread_id: "th_20251222_180000_abc",
      // missing from, to, type, timestamp, summary
    };

    const result = MessageSchema.safeParse(message);
    expect(result.success).toBe(false);
  });
});

describe("createMessage", () => {
  it("should create a message with generated ID and timestamp", () => {
    const message = createMessage({
      threadId: "th_20251222_180000_abc",
      from: "402milly",
      to: "Facilitador",
      type: "question",
      summary: "test question",
      questions: ["what is the expected format"],
    });

    expect(message.thread_id).toBe("th_20251222_180000_abc");
    expect(message.from).toBe("402milly");
    expect(message.to).toBe("Facilitador");
    expect(message.type).toBe("question");
    expect(message.summary).toBe("test question");
    expect(message.message_id).toMatch(/^msg_\d{6}_[a-z0-9]{4}$/);
    expect(message.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("validateMessage", () => {
  it("should return success for valid message", () => {
    const message = createMessage({
      threadId: "th_20251222_180000_abc",
      from: "402milly",
      to: "Facilitador",
      type: "answer",
      summary: "valid response",
    });

    const result = validateMessage(message);
    expect(result.success).toBe(true);
  });

  it("should return error for invalid message", () => {
    const result = validateMessage({ invalid: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("thread_id");
    }
  });
});
