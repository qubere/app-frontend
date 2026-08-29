import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

async function main() {
  console.log("===============================================================");
  console.log("📸 HEADLESS CHROME VISUAL & INTERACTIVE UI VALIDATION SUITE");
  console.log("===============================================================");

  const artifactsDir = "/Users/rachitlohani/.gemini/antigravity-ide/brain/ddd6c8c0-d4ee-4668-b36d-7cbfd9743ea2";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  console.log("1. Navigating to http://localhost:3000/app/shipments/SHP-TGT-2026-001...");
  const response = await page.goto("http://localhost:3000/app/shipments/SHP-TGT-2026-001", {
    waitUntil: "networkidle",
    timeout: 15000,
  });

  console.log(`   HTTP Response Status: ${response?.status()}`);
  console.log(`   Final Page URL: ${page.url()}`);

  // Take full page screenshot
  const screenshot1Path = path.join(artifactsDir, "shipment_workspace_journey_ribbon.png");
  await page.screenshot({ path: screenshot1Path, fullPage: false });
  console.log(`   Saved full page screenshot to: ${screenshot1Path}`);

  // Check for Journey Ribbon element
  const ribbonCount = await page.locator("text=Leg 3 of 4").count();
  console.log(`   Journey Ribbon Headline elements found: ${ribbonCount}`);

  // Check for stops
  const stopsCount = await page.locator("text=Factory (Shenzhen)").count();
  console.log(`   Shared Stop Node 'Factory (Shenzhen)' found: ${stopsCount > 0}`);

  // Click on a leg segment to test interactivity
  const legButtons = await page.locator("button:has-text('OCEAN'), button:has-text('TRUCK'), button:has-text('DRAYAGE')").all();
  console.log(`   Interactive Leg buttons found on Journey Ribbon: ${legButtons.length}`);

  if (legButtons.length > 0) {
    await legButtons[0].click();
    await page.waitForTimeout(500);
    const screenshot2Path = path.join(artifactsDir, "journey_ribbon_expanded_leg.png");
    await page.screenshot({ path: screenshot2Path, fullPage: false });
    console.log(`   Saved expanded leg screenshot to: ${screenshot2Path}`);
  }

  await browser.close();
  console.log("===============================================================");
  console.log("🎉 HEADLESS CHROME VALIDATION COMPLETE!");
  console.log("===============================================================");
}

main().catch((err) => {
  console.error("❌ Headless Chrome validation error:", err);
  process.exit(1);
});
