import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import db from "./db/client.js";
import { getAllPii } from "./db/queries/pii.js";

const FORM_URL =
  "https://privacyportal.onetrust.com/webform/342ca6ac-4177-4827-b61e-19070296cbd3/7229a09c-578f-4ac6-a987-e0428a7b877e";

function dobUs(dob) {
  const s = String(dob);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : s;
}

const t = 120_000;

await db.connect();

const users = await getAllPii();

for (const p of users) {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    await page.goto(FORM_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });

    const d = dobUs(p.dob);

    await stagehand.act('click "as Myself" under I am submitting this request', { timeout: t });

await stagehand.act('click "Delete" under Select the Right You Want to Exercise', { timeout: t });

await stagehand.act(`type ${p.email_address} in the Email field`, { timeout: t });

await stagehand.act(`type ${p.first_name} in the First Name field`, { timeout: t });

await stagehand.act(`type ${p.last_name} in the Last Name field`, { timeout: t });

await stagehand.act(`clear the Date of Birth field`, { timeout: t });
await stagehand.act(`type ${d} in the Date of Birth field in MM/DD/YYYY format`, { timeout: t });

await stagehand.act(`type ${p.street} in the Street Address field`, { timeout: t });

if (p.apt) {
  await stagehand.act(`type ${p.apt} in the Apartment or Address Line 2 field`, { timeout: t });
}

await stagehand.act(`type ${p.city} in the City field`, { timeout: t });

await stagehand.act(`type ${p.us_state} in the State field`, { timeout: t });

await stagehand.act(`type ${p.zip_code} in the ZIP Code field`, { timeout: t });

await stagehand.act("scroll to the bottom of the form", { timeout: t });

await stagehand.act("click the main submit button", { timeout: t });


    await db.query(
      `INSERT INTO acxiom_opt_out_submissions (user_id) VALUES ($1)`,
      [p.user_id]
    );

    console.log("submitted for user", p.user_id);
  } catch (err) {
    console.error("user_id", p.user_id, err);
  } finally {
    await stagehand.close?.();
  }
}

await db.end();
console.log("done");