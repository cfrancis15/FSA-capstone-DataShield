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

const ACXIOM_ONETRUST_FORM_URL =
  "https://privacyportal.onetrust.com/webform/342ca6ac-4177-4827-b61e-19070296cbd3/7229a09c-578f-4ac6-a987-e0428a7b877e";

export async function runAcxiomOptOutForUser(pii, userId) {
  const dobUs = formatDobUs(pii.dob);

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
  });

  await stagehand.init();
  const page = stagehand.context.pages()[0];

  try {
    await page.goto(ACXIOM_ONETRUST_FORM_URL, { waitUntil: "domcontentloaded" });

    const steps = [
      'Set "Requestor\'s Country" to United States.',
      'Under "I am submitting this request" choose "as Myself".',
      'Under "Select the Right You Want to Exercise" pick "Delete Sensitive Personal Information" if it exists; otherwise choose the closest opt-out or limit-use option.',
      `Fill Email: "${pii.email_address}".`,
      `Fill First Name, Middle Name, Last Name, Suffix with: "${pii.first_name}", "${pii.middle_name || ""}", "${pii.last_name}", "${pii.suffix || ""}".`,
      `Fill Date of Birth as "${dobUs}" (MM/DD/YYYY).`,
      `Fill Address: "${pii.street}", Address Line 2: "${pii.apt || ""}", City: "${pii.city}", State: "${pii.us_state}", Zip: "${pii.zip_code}".`,
      `If "Principal / Consumer" fields are visible and required, use the same person: first "${pii.first_name}", middle "${pii.middle_name || ""}", last "${pii.last_name}", DOB "${dobUs}", address "${pii.street}", city "${pii.city}", state "${pii.us_state}", zip "${pii.zip_code}".`,
      'Complete the reCAPTCHA "I\'m not a robot" (click the checkbox; solve any image challenge if shown).',
      "Click the final Submit or Send button for the form.",
    ];

    for (const step of steps) await stagehand.act(step);

    const { success } = await stagehand.extract(
      "After submitting, is there a clear success, confirmation, or thank-you for the privacy request (not a validation or required-field error)?",
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