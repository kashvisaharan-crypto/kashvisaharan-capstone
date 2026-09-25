// Merges the real, transcribed Sept 21-27 menu into your existing
// menu.json, overwriting any auto-generated placeholder entries for
// those specific dates (from extend_menu.js) with the real data.
// All other dates are left completely untouched.

const fs = require('fs');

const existing = JSON.parse(fs.readFileSync('menu.json', 'utf-8'));
const real = JSON.parse(fs.readFileSync('menu_sept21_27.json', 'utf-8'));

let overwrittenCount = 0;
let addedCount = 0;
for (const date in real) {
  if (existing[date]) overwrittenCount++;
  else addedCount++;
  existing[date] = real[date];
}

fs.writeFileSync('menu.json', JSON.stringify(existing, null, 2));
console.log(`Merged real menu: ${overwrittenCount} dates overwritten (replacing auto-generated data), ${addedCount} new dates added.`);
