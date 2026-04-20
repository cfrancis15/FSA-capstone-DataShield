/**
 * Env (never commit secrets — use server/.env locally, Render dashboard in prod):
 * - BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID
 * - DATABASE_URL
 * - Optional: STAGEHAND_MODEL (e.g. openai/gpt-4o-mini) + OPENAI_API_KEY for that model
 * - If STAGEHAND_MODEL is unset, Stagehand uses Browserbase gateway default (openai/gpt-4.1-mini).
 * - CRON_USER_ID (optional), ACXIOM_JOB_GAP_MS (optional)
 */
import "dotenv/config";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { Stagehand } from "@browserbasehq/stagehand";
import db from "./db/client.js";

async function saveLog(userId) {
  await db.query(
    `INSERT INTO acxiom_opt_out_submissions (user_id) VALUES ($1)`,
    [userId]
  );
}

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

function formatDobUs(dob) {
  if (!dob) return "";
  const s = String(dob);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return s;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function actWithRetry(stagehand, instruction, maxAttempts = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await stagehand.act(instruction);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message ?? err);
      const emptyModel =
        msg.includes("No object generated") ||
        msg.includes("did not match schema") ||
        msg.includes("AI_NoObjectGeneratedError");
      if (!emptyModel || attempt === maxAttempts) throw err;
      await sleep(600 * attempt);
    }
  }
  throw lastErr;
}

const ACXIOM_ONETRUST_FORM_URL =
  "https://privacyportal.onetrust.com/webform/342ca6ac-4177-4827-b61e-19070296cbd3/7229a09c-578f-4ac6-a987-e0428a7b877e";

export async function runAcxiomOptOutForUser(pii, userId) {
  const dobUs = formatDobUs(pii.dob);

  const stagehandOpts = {
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    selfHeal: true,
  };
  const customModel = process.env.STAGEHAND_MODEL?.trim();
  if (customModel) stagehandOpts.model = customModel;

  const stagehand = new Stagehand(stagehandOpts);

  await stagehand.init();
  const page = stagehand.context.pages()[0];

  try {
    await page.goto(ACXIOM_ONETRUST_FORM_URL, { waitUntil: "domcontentloaded" });
    await sleep(2500);

    const steps = [
      'Click the "Requestor\'s Country" field (combobox or dropdown) to open the country list.',
      'Choose the option whose label is exactly "United States" (the 50 states). Do NOT choose "United States Minor Outlying Islands".',
      'Under "I am submitting this request" click "as Myself".',
      'Under "Select the Right You Want to Exercise" pick "Limit Use/Opt Out of Sensitive Personal Information" or the closest opt-out / limit-use button.',
      `Type into the Email field: ${pii.email_address}`,
      `Fill First Name "${pii.first_name}", Middle Name "${pii.middle_name || ""}", Last Name "${pii.last_name}", Suffix "${pii.suffix || ""}".`,
      `Fill Date of Birth as ${dobUs} using MM/DD/YYYY.`,
      `Fill Address "${pii.street}", Address Line 2 "${pii.apt || ""}", City "${pii.city}", State "${pii.us_state}", Zip "${pii.zip_code}".`,
      `If Principal / Consumer fields are visible and required, repeat the same name, DOB ${dobUs}, and address "${pii.street}", "${pii.city}", "${pii.us_state}", "${pii.zip_code}".`,
      "If there is a reCAPTCHA checkbox, click it. Wait if the page needs to verify.",
      "Click the main Submit or Send button at the bottom.",
    ];

    for (const step of steps) {
      await actWithRetry(stagehand, step);
    }

    const { success } = await stagehand.extract(
      "After submitting, is there a success, confirmation, or thank-you message (not a red validation error)?",
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
      console.error(`[Acxiom OneTrust] user_id=${userId} failed:`, err);
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
      console.log("Acxiom OneTrust cron complete:", res);
      process.exit(res.failed ? 1 : 0);
    })
    .catch((err) => {
      console.error("Acxiom OneTrust cron failed:", err);
      process.exit(1);
    });
}