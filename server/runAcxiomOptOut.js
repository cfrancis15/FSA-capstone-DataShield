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
    await page.goto(FORM_URL, { waitUntil: "domcontentloaded" });

    const d = dobUs(p.dob);

    // Edit these strings to match the real form labels.
    await stagehand.act('click "as Myself" under I am submitting this request');
    await stagehand.act('click the "Delete" option under "Select the Right You Want to Exercise"');
    await stagehand.act(`type ${p.email_address} in the email field`);
    await stagehand.act(
      `fill first name ${p.first_name}, last name ${p.last_name}, date of birth ${d}`
    );
    await stagehand.act(
      `fill street ${p.street}, apt ${p.apt || ""}, city ${p.city}, state ${p.us_state}, zip ${p.zip_code}`
    );

    await stagehand.act("complete the robot check and then click the main submit button");

    await db.query(
      `INSERT INTO acxiom_opt_out_submissions (user_id) VALUES ($1)`,
      [p.user_id]
    );
  } catch (err) {
    console.error("user_id", p.user_id, err);
  } finally {
    await stagehand.close?.();
  }
}

console.log("done");