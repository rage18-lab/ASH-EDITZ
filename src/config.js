const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const jsonConfig = path.join(__dirname, 'config.json');

let config;
try {
  config = require(jsonConfig);
  if (process.env.DISCORD_TOKEN) {
    config.token = process.env.DISCORD_TOKEN;
  }
} catch (err) {
  console.error("❌ config.json not found or is invalid!", err.message);
  process.exit(1);
}

function parseBoolean(value) {
  if (typeof value === "string") {
    value = value.trim().toLowerCase();
  }
  switch (value) {
    case true:
    case "true":
      return true;
    default:
      return false;
  }
}

config.parseBoolean = parseBoolean;

module.exports = config;
