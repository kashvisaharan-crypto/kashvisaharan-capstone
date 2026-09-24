// Reads your existing menu.json, learns the weekly pattern (by day-of-week),
// and extends it forward to cover a wide date range - so "today" and any
// nearby date always has a valid menu, instead of only the original
// Sept 14-20 week. Existing dates are left untouched.

const fs = require('fs');

const menu = JSON.parse(fs.readFileSync('menu.json', 'utf-8'));

// Build a day-of-week -> menu template map from whatever dates already exist.
const byDayOfWeek = {};
for (const dateStr in menu) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun..6=Sat
  if (!byDayOfWeek[dow]) byDayOfWeek[dow] = menu[dateStr];
}

if (Object.keys(byDayOfWeek).length < 7) {
  console.log('Warning: fewer than 7 distinct weekdays found in existing menu.json.');
  console.log('Will still extend using whatever patterns exist, repeating them.');
}

// Extend from 2026-09-01 through 2026-12-31 (adjust range below if needed).
const start = new Date('2026-09-01T00:00:00');
const end = new Date('2026-12-31T00:00:00');

let addedCount = 0;
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  const iso = d.toISOString().split('T')[0];
  if (menu[iso]) continue; // never overwrite existing real data
  const dow = d.getDay();
  const template = byDayOfWeek[dow];
  if (!template) continue; // no pattern known for this weekday, skip
  // Deep clone the template so each date gets its own object, and set the
  // correct day label for this specific date.
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const entry = JSON.parse(JSON.stringify(template));
  entry.day = dayNames[dow];
  menu[iso] = entry;
  addedCount++;
}

fs.writeFileSync('menu.json', JSON.stringify(menu, null, 2));
console.log(`Extended menu.json: added ${addedCount} new dates, existing dates untouched.`);
