/**
 * setup_youtube_cookies.js
 * 
 * Run this script ONCE to set up YouTube cookies for the bot.
 * This allows the bot to bypass YouTube bot detection and stream music.
 * 
 * Instructions:
 * 1. Open Chrome/Edge and go to youtube.com, make sure you're logged in
 * 2. Press F12 to open DevTools
 * 3. Go to Application tab → Cookies → https://www.youtube.com
 * 4. Find "__Secure-3PSID" and copy its value
 * 5. Run: node setup_youtube_cookies.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('=== YouTube Cookie Setup for Hot Pursuit Bot ===\n');
console.log('To get your YouTube cookies:');
console.log('1. Open Chrome/Edge browser');
console.log('2. Go to https://www.youtube.com and log in');
console.log('3. Press F12 (DevTools) → Application tab → Cookies → https://www.youtube.com');
console.log('4. Copy the values for: __Secure-3PSID, __Secure-3PAPISID, SAPISID, SID\n');

const cookies = {};
const fields = [
    { key: '__Secure-3PSID', prompt: 'Paste __Secure-3PSID value: ' },
    { key: '__Secure-3PAPISID', prompt: 'Paste __Secure-3PAPISID value: ' },
    { key: 'SAPISID', prompt: 'Paste SAPISID value: ' },
    { key: 'SID', prompt: 'Paste SID value: ' },
];

function askNext(index) {
    if (index >= fields.length) {
        // Build cookie string
        const cookieStr = Object.entries(cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
        
        const configPath = path.join(__dirname, 'yt_cookies.json');
        fs.writeFileSync(configPath, JSON.stringify({ cookie: cookieStr }, null, 2));
        console.log('\n✅ Cookies saved to yt_cookies.json');
        console.log('Restart the bot with: node main.js');
        rl.close();
        return;
    }

    rl.question(fields[index].prompt, (answer) => {
        cookies[fields[index].key] = answer.trim();
        askNext(index + 1);
    });
}

askNext(0);
