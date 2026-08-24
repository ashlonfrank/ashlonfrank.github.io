"use strict";

const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");

function loadEnvFile(name) {
  try {
    const text = readFileSync(join(root, name), "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* optional local env file */
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const token = String(process.env.MIXPANEL_TOKEN || process.env.PUBLIC_MIXPANEL_TOKEN || "").trim();

writeFileSync(
  join(root, "js/mixpanel-config.js"),
  `/** Generated from MIXPANEL_TOKEN at build time. Keep this empty in git. */\nexport const MIXPANEL_TOKEN = ${JSON.stringify(token)};\n`
);

console.log(
  token
    ? "Wrote Mixpanel token to js/mixpanel-config.js"
    : "Wrote empty Mixpanel token (tracking disabled)"
);
