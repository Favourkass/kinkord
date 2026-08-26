// Walks every Week-1 flow against the local stack and saves PNGs
// (empty + filled states). Usage: node scripts/screenshot-week1.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3100";
const OUT = path.resolve(process.cwd(), "../../design/screenshots-week1");
const runId = Date.now().toString().slice(-7);
const user = {
  email: `shots${runId}@test.dev`,
  username: `shots${runId}`,
  password: "screenshot123pass",
};
// Existing local account with 2FA enabled (from the API e2e runs).
const twoFaUser = { email: "tega@test.dev", password: "supersecret123" };

const shot = async (page, dir, name) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, dir, `${name}.png`), fullPage: true });
  console.log(`✓ ${dir}/${name}.png`);
};

async function signupFlow(page, dir, { complete }) {
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await shot(page, dir, "01-signup-country-empty");
  await page.getByRole("radio").first().click();
  const checks = page.getByRole("checkbox");
  await checks.nth(0).click();
  await checks.nth(1).click();
  await shot(page, dir, "02-signup-country-filled");
  await page.getByRole("button", { name: /continue/i }).click();

  await page.getByLabel("Username").waitFor();
  await shot(page, dir, "03-signup-account-empty");
  await page.getByLabel("Username").fill(`@${user.username}`);
  await page.getByLabel("Display name").fill("Sir Shots");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Phone number").fill("0803 555 0142");
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm password").fill(user.password);
  await shot(page, dir, "04-signup-account-filled");
  await page.getByRole("button", { name: /^next/i }).click();

  await page.getByLabel("State").waitFor();
  await shot(page, dir, "05-signup-about-empty");
  await page.getByLabel("State").selectOption("Delta");
  await page.getByLabel("City").fill("Sapele");
  await page.getByRole("option", { name: "4", exact: true }).click();
  await page.getByRole("option", { name: "August", exact: true }).click();
  await page.getByRole("option", { name: "1999", exact: true }).click();
  await page.getByRole("button", { name: /♂ male/i }).click();
  await shot(page, dir, "06-signup-about-filled");
  if (!complete) return;

  await page.getByRole("button", { name: /create account/i }).click();
  await page.getByRole("heading", { name: /verification/i }).waitFor({ timeout: 20000 });
  await shot(page, dir, "07-signup-verification-skippable");
  await page.getByRole("button", { name: /skip for now/i }).click();

  await page.getByRole("heading", { name: /build your/i }).waitFor();
  await shot(page, dir, "08-signup-profile-empty");
  const files = page.locator('input[type="file"]');
  const previews = page.locator("button img");
  await files.nth(0).setInputFiles("public/brand/logo.png");
  await previews.nth(0).waitFor({ timeout: 90000 }); // real S3 round-trip
  await files.nth(1).setInputFiles("public/brand/hero-crowd.jpg");
  await previews.nth(1).waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: "Dominant", exact: true }).click();
  await page.getByRole("button", { name: "Switch", exact: true }).click();
  const confirms = page.getByRole("checkbox");
  await confirms.nth(0).click();
  await confirms.nth(1).click();
  await shot(page, dir, "09-signup-profile-filled");
  await page.getByRole("button", { name: /complete profile/i }).click();

  await page.getByRole("heading", { name: /welcome to/i }).waitFor({ timeout: 20000 });
  await shot(page, dir, "10-signup-welcome");
  await page.getByRole("button", { name: /continue with starter/i }).click();

  await page.getByRole("heading", { name: /edit/i }).waitFor({ timeout: 20000 });
  await shot(page, dir, "11-profile-view-and-edit");

  // 2FA setup with live QR
  await page.getByLabel(/confirm password to enable/i).fill(user.password);
  await page.getByRole("button", { name: /enable 2fa/i }).click();
  await page.locator('img[alt="2FA QR code"]').waitFor({ timeout: 20000 });
  await shot(page, dir, "12-profile-2fa-setup-qr");
}

async function authScreens(page, dir) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await shot(page, dir, "13-login-empty");
  await page.getByLabel(/email or username/i).fill(twoFaUser.email);
  await page.getByLabel("Password", { exact: true }).fill(twoFaUser.password);
  await shot(page, dir, "14-login-filled");
  await page.getByRole("button", { name: /log in/i }).click();
  await page.getByRole("heading", { name: /two-factor/i }).waitFor({ timeout: 20000 });
  await shot(page, dir, "15-login-2fa-challenge-empty");
  for (let i = 1; i <= 6; i++) await page.getByLabel(`Digit ${i}`).fill(String(i));
  await shot(page, dir, "16-login-2fa-challenge-filled");

  await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
  await shot(page, dir, "17-forgot-password-empty");
  await page.getByLabel(/email address/i).fill(twoFaUser.email);
  await shot(page, dir, "18-forgot-password-filled");
  await page.getByRole("button", { name: /send reset link/i }).click();
  await page.getByText(/on its way/i).waitFor({ timeout: 15000 });
  await shot(page, dir, "19-forgot-password-sent");

  await page.goto(`${BASE}/reset-password?token=preview`, { waitUntil: "networkidle" });
  await shot(page, dir, "20-reset-password-empty");
  await page.getByLabel("New password", { exact: true }).fill("newpassword123");
  await page.getByLabel("Confirm new password").fill("newpassword123");
  await shot(page, dir, "21-reset-password-filled");

  await page.goto(`${BASE}/verify-email`, { waitUntil: "networkidle" });
  await shot(page, dir, "22-verify-email-landing");
}

const browser = await chromium.launch();
try {
  // Desktop: full journey
  mkdirSync(path.join(OUT, "desktop"), { recursive: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dp = await desktop.newPage();
  try {
    await signupFlow(dp, "desktop", { complete: true });
  } catch (e) {
    console.error("signup flow stopped:", e.message);
    await dp.screenshot({ path: path.join(OUT, "desktop", "ZZ-signup-error.png"), fullPage: true });
  }
  const dp2 = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage();
  try {
    await authScreens(dp2, "desktop");
  } catch (e) {
    console.error("auth screens stopped:", e.message);
    await dp2.screenshot({ path: path.join(OUT, "desktop", "ZZ-auth-error.png"), fullPage: true });
  }

  // Mobile: form-factor pass (no account creation, reuses flows up to submit)
  mkdirSync(path.join(OUT, "mobile"), { recursive: true });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mp = await mobile.newPage();
  await signupFlow(mp, "mobile", { complete: false });
  await mp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await shot(mp, "mobile", "13-login-empty");
  await mp.getByLabel(/email or username/i).fill(twoFaUser.email);
  await mp.getByLabel("Password", { exact: true }).fill(twoFaUser.password);
  await shot(mp, "mobile", "14-login-filled");
  await mp.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
  await shot(mp, "mobile", "17-forgot-password-empty");

  console.log("\nAll screenshots saved to", OUT);
} finally {
  await browser.close();
}
