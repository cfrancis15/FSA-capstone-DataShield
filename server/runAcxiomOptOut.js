import "dotenv/config";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { Stagehand } from "@browserbasehq/stagehand";
import db from "./db/client.js";

// One row per successful run (same user can have many rows over time).
async function saveLog(userId) {
  await db.query(
    `INSERT INTO acxiom_opt_out_submissions (user_id) VALUES ($1)`,
    [userId]
  );
}

// Every cron run: all rows in user_pii.
// Set CRON_USER_ID in .env to test with one user only.
async function loadAllPii() {
  const testUserId = process.env.CRON_USER_ID
    ? Number(process.env.CRON_USER_ID)
    : null;

  if (testUserId) {
    const { rows } = await db.query(
      `SELECT user_id, title, first_name, middle_name, last_name, suffix,
              phone_number, email_address, street, apt, city, us_state, zip_code, dob
       FROM user_pii WHERE user_id = $1`,
      [testUserId]
    );
    return rows;
  }

  const { rows } = await db.query(
    `SELECT user_id, title, first_name, middle_name, last_name, suffix,
            phone_number, email_address, street, apt, city, us_state, zip_code, dob
     FROM user_pii ORDER BY user_id`
  );
  return rows;
}

export async function runAcxiomOptOutForUser(pii, userId) {
  const areaCode = "1";
  const phone = pii.phone_number;

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
  });

  await stagehand.init();
  const page = stagehand.context.pages()[0];

  try {
    await page.goto("https://google.com");
    await page.goto("https://www.acxiom.com/optout/");

    const steps = [
      'Select "Mailing Addresses", "Phone Numbers", and "Email Addresses".',
      'For "Who is opting out?", choose individual consumer/self if present.',
      `Set title to "${pii.title || "Mr."}" if title exists.`,
      `Fill first "${pii.first_name}", middle "${pii.middle_name || ""}", last "${pii.last_name}", suffix "${pii.suffix || ""}".`,
      `Fill phone: area code "${areaCode}" and phone number "${phone}".`,
      `Fill email "${pii.email_address}".`,
      `Fill address: street "${pii.street}", apt "${pii.apt || ""}", city "${pii.city}", state "${pii.us_state}", zip "${pii.zip_code}".`,
      "Click Submit.",
    ];

    for (const step of steps) await stagehand.act(step);

    const { success } = await stagehand.extract(
      "Is there a clear success or thank-you message after submit?",
      z.object({ success: z.boolean() })
    );

    if (!success) throw new Error("Submit confirmation not detected.");

    await saveLog(userId);
    return { ok: true, userId };
  } finally {
    await stagehand.close?.();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAcxiomOptOutCron() {
  await db.connect();

  const list = await loadAllPii();
  const summary = { total: list.length, ok: 0, failed: 0, errors: [] };

  for (const pii of list) {
    const userId = pii.user_id;
    try {
      await runAcxiomOptOutForUser(pii, userId);
      summary.ok += 1;
      await wait(Number(process.env.ACXIOM_JOB_GAP_MS) || 3000);
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({ userId, message: err?.message || String(err) });
      console.error(`[Acxiom] user_id=${userId} failed:`, err);
    }
  }

  return summary;
}

const ranDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (ranDirectly) {
  runAcxiomOptOutCron()
    .then((res) => {
      console.log("Acxiom cron job complete:", res);
      process.exit(res.failed ? 1 : 0);
    })
    .catch((err) => {
      console.error("Acxiom cron job failed:", err);
      process.exit(1);
    });
}