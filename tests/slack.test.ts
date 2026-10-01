import { describe, expect, it } from "vitest";

import {
  decryptSecret,
  encryptSecret,
} from "@/server/crypto/encryption";

import {
  SlackWebhookError,
  validateSlackWebhookUrl,
} from "@/server/slack/validate";

describe("secret encryption", () => {
  it("encrypts and decrypts a secret", () => {
    const original = "https://hooks.slack.com/services/T/B/X";

    const encrypted = encryptSecret(original);

    expect(encrypted).not.toContain(original);
    expect(decryptSecret(encrypted)).toBe(original);
  });

  it("produces different ciphertext for the same plaintext", () => {
    const original = "https://hooks.slack.com/services/T/B/X";

    const first = encryptSecret(original);
    const second = encryptSecret(original);

    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe(original);
    expect(decryptSecret(second)).toBe(original);
  });
});

describe("Slack webhook validation", () => {
  it("accepts a valid Slack webhook", () => {
    const value =
      "https://hooks.slack.com/services/T00000000/B00000000/abc123";

    expect(validateSlackWebhookUrl(value)).toBe(value);
  });

  it("rejects non-HTTPS URLs", () => {
    expect(() =>
      validateSlackWebhookUrl(
        "http://hooks.slack.com/services/T/B/X"
      )
    ).toThrow(SlackWebhookError);
  });

  it("rejects non-Slack hosts", () => {
    expect(() =>
      validateSlackWebhookUrl(
        "https://example.com/services/T/B/X"
      )
    ).toThrow(SlackWebhookError);
  });

  it("rejects URLs containing credentials", () => {
    expect(() =>
      validateSlackWebhookUrl(
        "https://user:password@hooks.slack.com/services/T/B/X"
      )
    ).toThrow(SlackWebhookError);
  });

  it("rejects URLs containing a port", () => {
    expect(() =>
      validateSlackWebhookUrl(
        "https://hooks.slack.com:8443/services/T/B/X"
      )
    ).toThrow(SlackWebhookError);
  });

  it("rejects invalid paths", () => {
    expect(() =>
      validateSlackWebhookUrl(
        "https://hooks.slack.com/not-services/T/B/X"
      )
    ).toThrow(SlackWebhookError);
  });
});
