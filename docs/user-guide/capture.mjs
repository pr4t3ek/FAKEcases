/**
 * Screenshot capture for docs/USER_GUIDE.docx.
 *
 * Drives the running dev server with Playwright and writes PNGs into
 * ./screenshots, one per figure in the user guide.
 *
 * Usage:
 *   pnpm db:reset                 # a freshly seeded database; the script
 *                                 # assumes demo/prof have no attempts or runs
 *   pnpm dev                      # in another shell
 *   npm i playwright              # not a repo dependency on purpose — this is
 *                                 # a docs tool, not part of the app
 *   node docs/user-guide/capture.mjs
 *
 * CHROMIUM_PATH overrides the browser binary; BASE_URL overrides the origin.
 *
 * The seeded accounts it signs in as are the ones README.md documents. Their
 * passwords are typed here because they are already public in that file — they
 * are deliberately NOT shown in any captured screen, and must never be.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "screenshots");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROMIUM =
  process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

mkdirSync(OUT, { recursive: true });

const done = [];

async function shot(page, name, opts = {}) {
  await page.waitForTimeout(opts.settle ?? 1000);
  await page.screenshot({
    path: join(OUT, `${name}.png`),
    fullPage: opts.fullPage ?? false,
    ...(opts.clip ? { clip: opts.clip } : {}),
  });
  done.push(name);
  console.log(`  ✓ ${name}`);
}

async function newContext(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  // Two things that belong on a first visit but not in a manual: the Next.js
  // dev-tools badge, and the tours. The tours are switched off through the same
  // localStorage keys the app's own "don't show again" writes.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("eq-tour-off", "1");
      localStorage.setItem("sim-tour-off", "1");
      localStorage.setItem("cc-worked-example-seen", "1");
    } catch {
      /* private window */
    }
    const css = document.createElement("style");
    css.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css));
  });
  return ctx;
}

async function signIn(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** Confirm the open dialog by its affirmative button; `no` names the ones to avoid. */
async function confirmDialog(page, yes) {
  const dlg = page.locator("[role=dialog]");
  if (!(await dlg.count())) return false;
  await dlg.first().locator(`button:has-text("${yes}")`).last().click();
  await page.waitForTimeout(1800);
  return true;
}

/**
 * A short but genuine attempt: think aloud once, put a step on the tree, commit
 * a number, submit. Used only to give the dashboard figures a real history to
 * draw — five graded attempts is what the rank ladder needs to place an account.
 */
async function quickAttempt(page, query, thought, estimate) {
  await page.goto(`${BASE}/library?q=${encodeURIComponent(query)}`, { waitUntil: "networkidle" });
  await page.locator('button:has-text("Practise this")').first().click();
  await page.waitForURL(/\/practice\//, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  const chat = page.locator("textarea").first();
  for (const line of thought) {
    await chat.fill(line);
    await chat.press("Enter");
    await page.waitForTimeout(3000);
  }
  for (const step of ["Population", "Segmentation", "Frequency"]) {
    await page.locator(`button:has-text("${step}")`).first().click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.locator('input[placeholder="value / %"]').first().fill(estimate.tree).catch(() => {});
  const qShares = page.locator('input[placeholder="0–100%"]');
  await qShares.nth(0).fill(estimate.share ?? "60").catch(() => {});
  await page.waitForTimeout(200);
  await qShares.nth(1).fill("100").catch(() => {});
  await page.waitForTimeout(200);
  await page.locator('input[placeholder="1"]').nth(2).fill(estimate.per ?? "2").catch(() => {});
  await page.locator("body").click({ position: { x: 5, y: 430 } });
  await page.waitForTimeout(700);
  await page.locator('input[placeholder*="Final estimate"]').first().fill(estimate.answer);
  await page.waitForTimeout(400);
  await page.locator('button:visible:has-text("Submit")').first().click();
  await page.waitForTimeout(5000);
}

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

try {
  // ── 1. Public pages, no session ────────────────────────────────────────────
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await shot(page, "01-landing");
    await page.goto(`${BASE}/join`, { waitUntil: "networkidle" });
    await shot(page, "10-join-room");
    await ctx.close();
  }

  // ── 2. A guesstimate, worked and submitted ────────────────────────────────
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await signIn(page, "demo@caseclosed.app", "demo1234");

    await page.goto(`${BASE}/library?q=toothpaste`, { waitUntil: "networkidle" });
    await page.locator('button:has-text("Practise this")').first().click();
    await page.waitForURL(/\/practice\//, { timeout: 30_000 });
    await page.waitForTimeout(1800);
    await page.keyboard.press("Escape");

    const chat = page.locator("textarea").first();
    await chat.fill(
      "I'll go top-down: India's population, the share that actually uses toothpaste, then how many tubes one user gets through in a year.",
    );
    await chat.press("Enter");
    await page.waitForTimeout(3500);

    for (const step of ["Population", "Segmentation", "Frequency"]) {
      await page
        .locator(`button:has-text("${step}")`)
        .first()
        .click()
        .catch(() => console.log(`  ! step chip missing: ${step}`));
      await page.waitForTimeout(500);
    }

    // Real numbers, so the figure shows a chain that reads correctly:
    // 140 crore people × 70% who use toothpaste × 4 tubes a year.
    await page.locator('input[placeholder="value / %"]').first().fill("140cr");
    const shares = page.locator('input[placeholder="0–100%"]');
    await shares.nth(0).fill("70");
    await page.waitForTimeout(200);
    await shares.nth(1).fill("100");
    await page.waitForTimeout(200);
    const mults = page.locator('input[placeholder="1"]');
    await mults.nth(2).fill("4");
    await page.locator("body").click({ position: { x: 5, y: 430 } });
    await page.waitForTimeout(900);

    await chat.fill(
      "About 140 crore people, roughly 70% of them regular users, and around 4 tubes each a year — so of the order of 390 crore tubes.",
    );
    await chat.press("Enter");
    await page.waitForTimeout(3500);

    await shot(page, "04-practice");

    // A fixed crop of the left pane: the practice screen is a full-height flex
    // layout with no element that bounds the tree on its own.
    await shot(page, "05-framework-builder", {
      clip: { x: 0, y: 170, width: 915, height: 645 },
      settle: 300,
    });

    const estimate = page.locator('input[placeholder*="Final estimate"]').first();
    await estimate.fill("390cr");
    await page.waitForTimeout(500);
    await page.locator('button:visible:has-text("Submit")').first().click();
    await page.waitForTimeout(6000);
    await shot(page, "06-evaluation", { settle: 2000 });

    await ctx.close();
  }

  // ── 3. A war room, played to the debrief ──────────────────────────────────
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await signIn(page, "demo@caseclosed.app", "demo1234");

    await page.goto(`${BASE}/simulations?q=Kadak`, { waitUntil: "networkidle" });
    await page
      .locator('a:has-text("the war room"), button:has-text("the war room")')
      .first()
      .click();
    await page.waitForURL(/\/simulate\//, { timeout: 30_000 });
    await page.waitForTimeout(2200);
    await page.keyboard.press("Escape"); // the concept primer
    await page.waitForTimeout(900);
    await shot(page, "08a-war-room-observe");

    await page.locator('button:has-text("Order value is too low")').click();
    await page
      .locator("textarea")
      .first()
      .fill(
        "Contribution per order looks thin next to what a click costs — I'd expect CAC near or above ₹319.",
      );
    await page.locator('button:has-text("Lock it in and start investigating")').click();
    await page.waitForTimeout(1200);
    await confirmDialog(page, "Start investigating");

    for (let i = 0; i < 2; i++) {
      await page.locator('button:has-text("Run this")').first().click();
      await page.waitForTimeout(1200);
      await confirmDialog(page, "Run it");
    }
    await shot(page, "08b-war-room-investigate");

    await page.locator('button:has-text("I know enough")').click();
    await page.waitForTimeout(1200);
    await confirmDialog(page, "Move to the decision");

    await page.locator('button:has-text("The ads sell our lowest-margin product")').click();
    await page.waitForTimeout(600);
    await page.locator('button:has-text("Name it and see the options")').click();
    await page.waitForTimeout(1200);
    await confirmDialog(page, "Lock it in");

    const nums = page.locator("input[type=number]");
    await nums.nth(0).fill("3");
    await page.waitForTimeout(300);
    await nums.nth(1).fill("5.5");
    await page.waitForTimeout(700);
    await shot(page, "08c-war-room-decide");

    await page.locator('button:has-text("Commit the quarter")').last().click();
    await page.waitForTimeout(1500);
    await confirmDialog(page, "Commit");
    await page.waitForTimeout(4000);
    await shot(page, "09-war-room-debrief", { settle: 2500 });

    await ctx.close();
  }

  // ── 4. The signed-in catalogue and dashboard, now that there is history ───
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await signIn(page, "demo@caseclosed.app", "demo1234");

    // Four more attempts, so the dashboard has a score trend and a placed rank
    // rather than the empty state a brand-new account sees.
    await quickAttempt(
      page,
      "chai",
      [
        "I'll take Bangalore's population, the share who drink chai on a given day, and cups per drinker.",
        "Bangalore is about 1.4 crore people, and I'd say 60% drink chai daily.",
        "At roughly 2 cups each that lands near 1.7 crore cups a day.",
      ],
      { tree: "1.4cr", share: "60", per: "2", answer: "1.7cr" },
    );
    await quickAttempt(
      page,
      "smartphone users in Delhi",
      [
        "Delhi's population, then the share old enough to own a phone and able to afford one.",
        "Delhi is around 2 crore people; I'd exclude young children, so about 75% are candidates.",
        "Of those maybe 90% actually own a smartphone today, so roughly 1.4 crore.",
      ],
      { tree: "2cr", share: "75", per: "0.9", answer: "1.4cr" },
    );
    await quickAttempt(
      page,
      "cricket bats",
      [
        "India's population, the share who play cricket with a bought bat, and how often a bat is replaced.",
        "140 crore people, and I'd say 15% play often enough to own a bat.",
        "A bat lasts about three years, so roughly a third of them buy in a given year — around 7 crore.",
      ],
      { tree: "140cr", share: "15", per: "0.33", answer: "7cr" },
    );
    await quickAttempt(
      page,
      "Maggi",
      [
        "Households in India, the share that buy Maggi, packs a month, and the price per pack.",
        "About 30 crore households, of which I'd say 40% buy Maggi at all.",
        "At roughly 4 packs a month and ₹14 a pack that is of the order of ₹8,000 crore a year.",
      ],
      { tree: "30cr", share: "40", per: "48", answer: "8000cr" },
    );

    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await shot(page, "02-dashboard", { settle: 3000 });

    await page.goto(`${BASE}/library`, { waitUntil: "networkidle" });
    await shot(page, "03-library", { settle: 1500 });

    await page.goto(`${BASE}/simulations`, { waitUntil: "networkidle" });
    await shot(page, "07-war-rooms", { settle: 1500 });

    await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
    await shot(page, "13-profile", { settle: 1500 });

    await ctx.close();
  }

  // ── 5. A professor hosts a class, students join, the console fills up ─────
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await signIn(page, "prof@caseclosed.app", "prof1234");

    await page.goto(`${BASE}/simulations?q=Kadak`, { waitUntil: "networkidle" });
    await page.locator('button:has-text("host this in class")').first().click();
    await page.waitForTimeout(1200);
    await page.locator("#room-name").fill("Tue 4pm, Section B");
    await page.waitForTimeout(400);
    // Captured with the password field empty on purpose — a manual should not
    // put a working room password on the page.
    await shot(page, "11-host-dialog", { settle: 400 });

    await page.locator("#room-password").fill("kadak-tue-4pm");
    await page.locator('button:has-text("Open the room")').click();
    await page.waitForURL(/\/host\//, { timeout: 30_000 });
    await page.waitForTimeout(2000);
    const code = new URL(page.url()).pathname.split("/").pop();
    console.log(`  · room ${code}`);

    // Three students join and one of them starts working, so the roster the
    // console shows is a real one rather than an empty table.
    const students = ["Aditi R", "Karan M", "Sneha P"];
    for (const [i, name] of students.entries()) {
      const sctx = await newContext(browser);
      const spage = await sctx.newPage();
      await spage.goto(`${BASE}/join`, { waitUntil: "networkidle" });
      await spage.fill("#code", code);
      await spage.fill("#room-password", "kadak-tue-4pm");
      await spage.fill("#name", name);
      await spage.locator('button[type=submit]').click();
      await spage.waitForURL(/\/room\//, { timeout: 30_000 });
      await spage.waitForTimeout(1500);

      if (i === 0) await shot(spage, "12-room-student", { settle: 800 });

      if (i < 2) {
        await spage
          .locator('a:has-text("the war room"), button:has-text("the war room")')
          .first()
          .click()
          .catch(() => {});
        await spage.waitForTimeout(2500);
        await spage.keyboard.press("Escape");
        await spage.waitForTimeout(800);
        await spage
          .locator('button:has-text("The ads sell our lowest-margin product")')
          .click()
          .catch(() => {});
        await spage.locator("textarea").first().fill("The mix of what the ads sell looks wrong.").catch(() => {});
        await spage.locator('button:has-text("Lock it in and start investigating")').click().catch(() => {});
        await spage.waitForTimeout(1200);
        await confirmDialog(spage, "Start investigating");
        await spage.waitForTimeout(1500);
      }
      await sctx.close();
    }

    await page.reload({ waitUntil: "networkidle" });
    await shot(page, "14-host-console", { settle: 3000 });

    await page.goto(`${BASE}/host`, { waitUntil: "networkidle" });
    await shot(page, "15-host-rollup", { settle: 2000 });

    await ctx.close();
  }

  console.log(`\n${done.length} screenshots written to ${OUT}`);
} finally {
  await browser.close();
}
