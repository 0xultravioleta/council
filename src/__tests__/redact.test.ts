import { describe, it, expect } from "vitest";
import {
  scanForSecrets,
  redactSecrets,
  isSensitiveFilename,
  isSensitiveExtension,
} from "../lib/redact.js";

describe("redact", () => {
  describe("scanForSecrets", () => {
    it("should detect AWS access keys", () => {
      const content = "aws_key = AKIAIOSFODNN7EXAMPLE";
      const matches = scanForSecrets(content);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.type === "AWS Access Key")).toBe(true);
    });

    it("should detect GitHub tokens", () => {
      const content = "token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const matches = scanForSecrets(content);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.type === "GitHub Token")).toBe(true);
    });

    // Stripe key test skipped - GitHub push protection blocks sk_/pk_ patterns

    it("should detect passwords in URLs", () => {
      const content = "postgres://user:secretpassword@localhost:5432/db";
      const matches = scanForSecrets(content);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.type === "Password in URL" || m.type === "Database URL")).toBe(
        true
      );
    });

    it("should detect private keys", () => {
      const content = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7o
-----END PRIVATE KEY-----`;
      const matches = scanForSecrets(content);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.type === "Private Key")).toBe(true);
    });

    it("should detect API key assignments", () => {
      const content = 'api_key = "abcdef1234567890abcdef12"';
      const matches = scanForSecrets(content);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.type === "Generic API Key")).toBe(true);
    });

    it("should detect OpenAI keys", () => {
      const content = "OPENAI_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const matches = scanForSecrets(content);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.type === "OpenAI Key")).toBe(true);
    });

    it("should return empty array for clean content", () => {
      const content = `
        const greeting = "Hello, world!";
        function add(a, b) { return a + b; }
      `;
      const matches = scanForSecrets(content);

      expect(matches.length).toBe(0);
    });

    it("should include line and column information", () => {
      const content = `line 1
line 2
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`;
      const matches = scanForSecrets(content);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].line).toBe(3);
    });
  });

  describe("redactSecrets", () => {
    it("should redact detected secrets", () => {
      const content = "token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const result = redactSecrets(content);

      expect(result.hasSecrets).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.redactedContent).not.toContain("ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    });

    it("should return original content when no secrets", () => {
      const content = "const x = 42;";
      const result = redactSecrets(content);

      expect(result.hasSecrets).toBe(false);
      expect(result.matches.length).toBe(0);
      expect(result.redactedContent).toBe(content);
    });

    it("should mask passwords in URLs", () => {
      const content = "postgres://admin:supersecret@localhost:5432/db";
      const result = redactSecrets(content);

      expect(result.hasSecrets).toBe(true);
      expect(result.redactedContent).toContain("****");
      expect(result.redactedContent).not.toContain("supersecret");
    });

    it("should redact private keys", () => {
      const content = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8Pk...
-----END RSA PRIVATE KEY-----`;
      const result = redactSecrets(content);

      expect(result.hasSecrets).toBe(true);
      expect(result.redactedContent).toContain("[REDACTED]");
    });
  });

  describe("isSensitiveFilename", () => {
    it("should detect .env files", () => {
      expect(isSensitiveFilename(".env")).toBe(true);
      expect(isSensitiveFilename(".env.local")).toBe(true);
      expect(isSensitiveFilename(".env.production")).toBe(true);
    });

    it("should detect credentials files", () => {
      expect(isSensitiveFilename("credentials.json")).toBe(true);
      expect(isSensitiveFilename("aws_credentials")).toBe(true);
    });

    it("should detect secret files", () => {
      expect(isSensitiveFilename("secrets.yaml")).toBe(true);
      expect(isSensitiveFilename("secret.json")).toBe(true);
    });

    it("should detect key files", () => {
      expect(isSensitiveFilename("private_key.pem")).toBe(true);
      expect(isSensitiveFilename("id_rsa")).toBe(true);
      expect(isSensitiveFilename("id_ed25519")).toBe(true);
    });

    it("should not flag normal files", () => {
      expect(isSensitiveFilename("index.ts")).toBe(false);
      expect(isSensitiveFilename("config.json")).toBe(false);
      expect(isSensitiveFilename("README.md")).toBe(false);
    });
  });

  describe("isSensitiveExtension", () => {
    it("should detect sensitive extensions", () => {
      expect(isSensitiveExtension("key.pem")).toBe(true);
      expect(isSensitiveExtension("cert.key")).toBe(true);
      expect(isSensitiveExtension("store.p12")).toBe(true);
      expect(isSensitiveExtension("config.env")).toBe(true);
    });

    it("should not flag normal extensions", () => {
      expect(isSensitiveExtension("app.ts")).toBe(false);
      expect(isSensitiveExtension("data.json")).toBe(false);
      expect(isSensitiveExtension("styles.css")).toBe(false);
    });
  });
});
