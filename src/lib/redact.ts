/**
 * Redaction Guard
 *
 * Detects and optionally masks secrets in text content.
 * Used to prevent accidental exposure of sensitive data in evidence files.
 */

export interface SecretMatch {
  type: string;
  value: string;
  masked: string;
  line: number;
  column: number;
}

export interface RedactionResult {
  hasSecrets: boolean;
  matches: SecretMatch[];
  redactedContent: string;
}

interface SecretPattern {
  name: string;
  regex: RegExp;
  maskFn?: (match: string) => string;
}

// Common secret patterns
const SECRET_PATTERNS: SecretPattern[] = [
  // API Keys and Tokens
  {
    name: "AWS Access Key",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: "AWS Secret Key",
    regex: /\b[A-Za-z0-9/+=]{40}\b(?=.*(?:aws|secret|key))/gi,
  },
  {
    name: "GitHub Token",
    regex: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
  },
  {
    name: "GitLab Token",
    regex: /\bglpat-[A-Za-z0-9\-_]{20,}\b/g,
  },
  {
    name: "Slack Token",
    regex: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/g,
  },
  {
    name: "Stripe Key",
    regex: /\b(sk|pk)_(test|live)_[A-Za-z0-9]{24,}\b/g,
  },
  {
    name: "OpenAI Key",
    regex: /\bsk-[A-Za-z0-9]{32,}\b/g,
  },
  {
    name: "Anthropic Key",
    regex: /\bsk-ant-[A-Za-z0-9\-]{32,}\b/g,
  },
  {
    name: "Generic API Key",
    regex: /\b(?:api[_-]?key|apikey|api[_-]?secret)['":\s]*[=:]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?/gi,
    maskFn: (match) => match.replace(/([A-Za-z0-9_\-]{20,})/, (key) => maskValue(key)),
  },

  // Credentials
  {
    name: "Password in URL",
    regex: /:\/\/[^:]+:([^@]+)@/g,
    maskFn: (match) => match.replace(/:([^@]+)@/, ":****@"),
  },
  {
    name: "Password Assignment",
    regex: /\b(?:password|passwd|pwd|secret)['":\s]*[=:]\s*['"]?([^\s'"]+)['"]?/gi,
    maskFn: (match) => match.replace(/[=:]\s*['"]?([^\s'"]+)['"]?/, "=****"),
  },

  // Private Keys
  {
    name: "Private Key",
    regex: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    maskFn: () => "-----BEGIN PRIVATE KEY-----\n[REDACTED]\n-----END PRIVATE KEY-----",
  },

  // Connection Strings
  {
    name: "Database URL",
    regex: /\b(?:postgres|mysql|mongodb|redis):\/\/[^\s]+/gi,
    maskFn: (match) => {
      try {
        const url = new URL(match);
        if (url.password) {
          url.password = "****";
        }
        return url.toString();
      } catch {
        return match.replace(/:([^@]+)@/, ":****@");
      }
    },
  },

  // JWT Tokens (only if they look like real tokens, not examples)
  {
    name: "JWT Token",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    maskFn: (match) => {
      const parts = match.split(".");
      return `${parts[0].slice(0, 10)}...[REDACTED]`;
    },
  },

  // Environment Variables with sensitive names
  {
    name: "Env Secret",
    regex: /\b(?:SECRET|TOKEN|CREDENTIAL|AUTH)[A-Z_]*\s*=\s*['"]?([^\s'"]+)['"]?/g,
    maskFn: (match) => match.replace(/=\s*['"]?([^\s'"]+)['"]?/, "=****"),
  },
];

/**
 * Mask a value, preserving first and last characters
 */
function maskValue(value: string): string {
  if (value.length <= 8) {
    return "****";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * Scan content for secrets
 */
export function scanForSecrets(content: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const lines = content.split("\n");

  for (const pattern of SECRET_PATTERNS) {
    // Reset regex state
    pattern.regex.lastIndex = 0;

    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const value = match[0];
      const beforeMatch = content.slice(0, match.index);
      const lineNumber = beforeMatch.split("\n").length;
      const lastNewline = beforeMatch.lastIndexOf("\n");
      const column = match.index - lastNewline;

      // Use custom mask function or default
      const masked = pattern.maskFn ? pattern.maskFn(value) : maskValue(value);

      matches.push({
        type: pattern.name,
        value,
        masked,
        line: lineNumber,
        column,
      });
    }
  }

  // Deduplicate by value and position
  const seen = new Set<string>();
  return matches.filter((m) => {
    const key = `${m.value}:${m.line}:${m.column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Redact secrets from content
 */
export function redactSecrets(content: string): RedactionResult {
  const matches = scanForSecrets(content);

  if (matches.length === 0) {
    return {
      hasSecrets: false,
      matches: [],
      redactedContent: content,
    };
  }

  let redactedContent = content;

  // Sort matches by position (descending) to replace from end to start
  const sortedMatches = [...matches].sort((a, b) => {
    if (a.line !== b.line) return b.line - a.line;
    return b.column - a.column;
  });

  for (const match of sortedMatches) {
    redactedContent = redactedContent.replace(match.value, match.masked);
  }

  return {
    hasSecrets: true,
    matches,
    redactedContent,
  };
}

/**
 * Check if a file extension is likely to contain secrets
 */
export function isSensitiveExtension(filename: string): boolean {
  const sensitiveExtensions = [
    ".env",
    ".pem",
    ".key",
    ".p12",
    ".pfx",
    ".jks",
    ".keystore",
    ".credentials",
    ".secret",
  ];

  const lowerFilename = filename.toLowerCase();
  return sensitiveExtensions.some((ext) => lowerFilename.endsWith(ext));
}

/**
 * Check if a filename suggests it contains secrets
 */
export function isSensitiveFilename(filename: string): boolean {
  const sensitivePatterns = [
    /^\.env/i,
    /credentials/i,
    /secrets?/i,
    /password/i,
    /private[_-]?key/i,
    /id_rsa/i,
    /id_ed25519/i,
    /\.pem$/i,
    /\.key$/i,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(filename));
}
