// Captures the remaining Week-1 screens (steps 4-filled through 2FA QR).
import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3100";
const OUT = path.resolve(process.cwd(), "../../design/screenshots-week1");
const runId = Date.now().toString().slice(-7);
const user = {
  email: `shots${runId}@test.dev`,
  username: `shots${runId}`,
  password: "screenshot123pass",
};

const shot = async (page, name) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "desktop", `${name}.png`), fullPage: true });
  console.log(`✓ desktop/${name}.png`);
};

async function uploadWithRetry(page, input, file, previewIndex) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await input.setInputFiles(file);
    try {
      await page.locator("button img").nth(previewIndex).waitFor({ timeout: 120000 });
      return;
    } catch {
      console.log(`upload attempt ${attempt} for ${file} did not complete; retrying`);
    }
  }
  throw new Error(`upload failed after retries: ${file}`);
}

const browser = await chromium.launch();
try {
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage();
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.getByRole("radio").first().click();
  const checks = page.getByRole("checkbox");
  await checks.nth(0).click();
  await checks.nth(1).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByLabel("Username").fill(`@${user.username}`);
  await page.getByLabel("Display name").fill("Sir Shots");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Phone number").fill("0803 555 0142");
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm password").fill(user.password);
  await page.getByRole("button", { name: /^next/i }).click();
  await page.getByLabel("State").selectOption("Delta");
  await page.getByLabel("City").fill("Sapele");
  await page.getByRole("option", { name: "4", exact: true }).click();
  await page.getByRole("option", { name: "August", exact: true }).click();
  await page.getByRole("option", { name: "1999", exact: true }).click();
  await page.getByRole("button", { name: /♂ male/i }).click();
  await page.getByRole("button", { name: /create account/i }).click();
  await page.getByRole("button", { name: /skip for now/i }).click();
  await page.getByRole("heading", { name: /build your/i }).waitFor();

  const files = page.locator('input[type="file"]');
  await uploadWithRetry(page, files.nth(0), "public/brand/logo.png", 0);
  await uploadWithRetry(page, files.nth(1), "public/brand/hero-crowd.jpg", 1);
  await page.getByRole("button", { name: "Dominant", exact: true }).click();
  await page.getByRole("button", { name: "Switch", exact: true }).click();
  const confirms = page.getByRole("checkbox");
  await confirms.nth(0).click();
  await confirms.nth(1).click();
  await shot(page, "09-signup-profile-filled");
  await page.getByRole("button", { name: /complete profile/i }).click();

  await page.getByRole("heading", { name: /welcome to/i }).waitFor({ timeout: 30000 });
  await shot(page, "10-signup-welcome");
  await page.getByRole("button", { name: /continue with starter/i }).click();

  await page.getByRole("heading", { name: /edit/i }).waitFor({ timeout: 30000 });
  await shot(page, "11-profile-view-and-edit");

  await page.getByLabel(/confirm password to enable/i).fill(user.password);
  await page.getByRole("button", { name: /enable 2fa/i }).click();
  await page.locator('img[alt="2FA QR code"]').waitFor({ timeout: 30000 });
  await shot(page, "12-profile-2fa-setup-qr");
  console.log("resume complete");
} finally {
  await browser.close();
}
