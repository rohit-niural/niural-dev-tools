import { describe, expect, it } from "vitest";
import { envForHost, isKnownHost } from "./env";

describe("envForHost", () => {
  it("maps each known host to its env", () => {
    expect(envForHost("niural.com")).toBe("prod");
    expect(envForHost("qa.niural.com")).toBe("qa");
    expect(envForHost("dev.niural.com")).toBe("dev");
    expect(envForHost("localhost:3000")).toBe("dev");
  });

  it("returns null for demo, whose env name is not confirmed", () => {
    expect(envForHost("demo.niural.com")).toBeNull();
  });

  it("returns null for an unknown host", () => {
    expect(envForHost("example.com")).toBeNull();
  });

  it("returns null for an Amplify preview, whose backend env the host cannot reveal", () => {
    expect(
      envForHost("branch-preview.d1example.amplifyapp.com"),
    ).toBeNull();
  });

  it("rejects prototype-chain keys", () => {
    expect(envForHost("constructor")).toBeNull();
    expect(envForHost("__proto__")).toBeNull();
    expect(envForHost("toString")).toBeNull();
  });
});

describe("isKnownHost", () => {
  it("recognises every mapped host plus demo", () => {
    for (const host of [
      "niural.com",
      "qa.niural.com",
      "dev.niural.com",
      "localhost:3000",
      "demo.niural.com",
    ]) {
      expect(isKnownHost(host)).toBe(true);
    }
  });

  it("rejects an unknown host", () => {
    expect(isKnownHost("example.com")).toBe(false);
    expect(isKnownHost("niural.com.evil.example")).toBe(false);
  });

  it("recognises any Amplify branch deployment", () => {
    expect(
      isKnownHost("branch-preview.d1example.amplifyapp.com"),
    ).toBe(true);
    expect(isKnownHost("main.d1example.amplifyapp.com")).toBe(true);
  });

  it("rejects hosts that only end in the suffix without the dot boundary", () => {
    expect(isKnownHost("notamplifyapp.com")).toBe(false);
    expect(isKnownHost("amplifyapp.com.evil.example")).toBe(false);
    expect(isKnownHost("amplifyapp.com")).toBe(false);
  });

  it("rejects localhost on a port the app does not use", () => {
    expect(isKnownHost("localhost:8080")).toBe(false);
  });

  it("rejects prototype-chain keys", () => {
    expect(isKnownHost("constructor")).toBe(false);
    expect(isKnownHost("__proto__")).toBe(false);
    expect(isKnownHost("toString")).toBe(false);
  });
});
