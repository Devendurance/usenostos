import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("Next.js deployment configuration", () => {
  it("uses the default .next output directory", () => {
    expect(nextConfig.distDir).toBeUndefined();
    expect(nextConfig.output).toBeUndefined();
  });
});
