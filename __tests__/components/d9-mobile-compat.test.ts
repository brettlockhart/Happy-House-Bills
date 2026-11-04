import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

const nuxtConfig = readFileSync(resolve(root, "nuxt.config.ts"), "utf-8");
const tokensCss = readFileSync(resolve(root, "app/assets/css/tokens.css"), "utf-8");
const manifestPath = resolve(root, "public/manifest.webmanifest");
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf-8"))
  : null;

describe("D9: Viewport configuration", () => {
  it("REQUIRES viewport meta tag in nuxt.config.ts", () => {
    expect(nuxtConfig).toContain("viewport");
    expect(nuxtConfig).toContain("width=device-width");
    expect(nuxtConfig).toContain("initial-scale=1");
  });

  it("REQUIRES theme-color meta tag for mobile browser theming", () => {
    expect(nuxtConfig).toContain("theme-color");
    expect(nuxtConfig).toContain("#10b981");
  });

  it("REQUIRES color-scheme meta tag for light/dark support", () => {
    expect(nuxtConfig).toContain("color-scheme");
    expect(nuxtConfig).toContain("light dark");
  });
});

describe("D9: PWA manifest", () => {
  it("REQUIRES manifest.webmanifest exists in public/", () => {
    expect(existsSync(manifestPath)).toBe(true);
  });

  it("REQUIRES manifest linked in nuxt.config.ts", () => {
    expect(nuxtConfig).toContain("manifest");
    expect(nuxtConfig).toContain("/manifest.webmanifest");
  });

  it("REQUIRES manifest has display: standalone", () => {
    expect(manifest).not.toBeNull();
    expect(manifest.display).toBe("standalone");
  });

  it("REQUIRES manifest has short_name", () => {
    expect(manifest).not.toBeNull();
    expect(manifest.short_name).toBe("HHB");
  });

  it("REQUIRES manifest has name", () => {
    expect(manifest).not.toBeNull();
    expect(manifest.name).toBe("Happy House Bills");
  });

  it("REQUIRES manifest has icons array with 192px and 512px", () => {
    expect(manifest).not.toBeNull();
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("REQUIRES manifest has theme_color and background_color", () => {
    expect(manifest).not.toBeNull();
    expect(manifest.theme_color).toBe("#10b981");
    expect(manifest.background_color).toBe("#ffffff");
  });

  it("REQUIRES manifest has start_url", () => {
    expect(manifest).not.toBeNull();
    expect(manifest.start_url).toBe("/");
  });

  it("REQUIRES manifest includes maskable icon for Android", () => {
    expect(manifest).not.toBeNull();
    const maskable = manifest.icons.filter((i: { purpose: string }) => i.purpose.includes("maskable"));
    expect(maskable.length).toBeGreaterThanOrEqual(1);
  });

  it("REQUIRES all manifest icon src paths resolve to existing files", () => {
    expect(manifest).not.toBeNull();
    for (const icon of manifest.icons) {
      const iconPath = resolve(root, "public", icon.src.replace(/^\//, ""));
      expect(existsSync(iconPath), `Icon missing: ${icon.src}`).toBe(true);
    }
  });
});

describe("D9: Apple touch icon", () => {
  it("REQUIRES apple-touch-icon link in nuxt.config.ts", () => {
    expect(nuxtConfig).toContain("apple-touch-icon");
    expect(nuxtConfig).toContain("/icons/icon-192.png");
  });
});

describe("D9: Touch target sizing", () => {
  it("REQUIRES button, a[href], input type elements have 44px minimum", () => {
    expect(tokensCss).toContain("button, a[href], input[type=\"button\"], input[type=\"submit\"], input[type=\"file\"]");
    expect(tokensCss).toMatch(/\.hhb-btn[^}]*min-height:\s*44px/);
  });

  it("REQUIRES hhb-btn has min-height 44px", () => {
    expect(tokensCss).toMatch(/\.hhb-btn[^}]*min-height:\s*44px/);
  });

  it("REQUIRES HhbButton has min-height 44px", () => {
    expect(tokensCss).toMatch(/\.HhbButton[^}]*min-height:\s*44px/);
  });

  it("REQUIRES input[type=file] has opacity and position rules", () => {
    expect(tokensCss).toMatch(/input\[type="file"\][^]*opacity:\s*0/);
    expect(tokensCss).toMatch(/input\[type="file"\][^]*position:\s*absolute/);
  });
});

describe("D9: prefers-reduced-motion", () => {
  it("REQUIRES prefers-reduced-motion media query present", () => {
    expect(tokensCss).toContain("prefers-reduced-motion");
    expect(tokensCss).toContain("animation-duration: 0.01ms !important");
    expect(tokensCss).toContain("transition-duration: 0.01ms !important");
  });
});

describe("D9: prefers-color-scheme dark mode", () => {
  it("REQUIRES dark mode media query present", () => {
    expect(tokensCss).toContain("prefers-color-scheme: dark");
  });
});

describe("D9: Camera capture input", () => {
  const receiptUploader = readFileSync(resolve(root, "app/components/ReceiptUploader.vue"), "utf-8");

  it("REQUIRES ReceiptUploader has capture=environment input", () => {
    expect(receiptUploader).toContain("capture=\"environment\"");
  });

  it("REQUIRES file input accepts image/* types", () => {
    expect(receiptUploader).toContain("accept=\"image/*\"");
  });
});

describe("D9: Icon assets exist", () => {
  it("REQUIRES app icon files exist in public/icons/", () => {
    expect(existsSync(resolve(root, "public/icons/icon-192.png"))).toBe(true);
    expect(existsSync(resolve(root, "public/icons/icon-512.png"))).toBe(true);
  });

  it("REQUIRES maskable icon files exist in public/icons/", () => {
    expect(existsSync(resolve(root, "public/icons/maskable-192.png"))).toBe(true);
    expect(existsSync(resolve(root, "public/icons/maskable-512.png"))).toBe(true);
  });
});

describe("D9: No secrets in runtime config", () => {
  it("REQUIRES CONVEX_DEPLOY_KEY not in nuxt.config.ts", () => {
    expect(nuxtConfig).not.toContain("CONVEX_DEPLOY_KEY");
    expect(nuxtConfig).not.toContain("convexDeployKey");
  });
});
