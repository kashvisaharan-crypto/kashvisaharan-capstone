// Reads your existing biometric.json and extends each student's attendance
// records to cover the same wide date range as menu.json, generating
// realistic (~88% present) attendance for new dates only. Existing dates
// are left untouched.

const fs = require('fs');

const biometric = JSON.parse(fs.readFileSync('biometric.json', 'utf-8'));

const start = new Date('2026-09-01T00:00:00');
const end = new Date('2026-12-31T00:00:00');

function randomDay(dow) {
  const r = () => Math.random() > 0.12;
  if (dow === 0) {
    // Sunday: matches the Brunch-style schedule used in the sample data
    return { Brunch: r(), evening_snacks: r(), Dinner: r() };
  }
  return { Breakfast: r(), Lunch: r(), evening_snacks: r(), Dinner: r() };
}

let addedCount = 0;
for (const email in biometric) {
  const student = biometric[email];
  if (!student.attendance) student.attendance = {};
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().split('T')[0];
    if (student.attendance[iso]) continue; // never overwrite existing data
    student.attendance[iso] = randomDay(d.getDay());
    addedCount++;
  }
}

fs.writeFileSync('biometric.json', JSON.stringify(biometric, null, 2));
console.log(`Extended biometric.json: added ${addedCount} new date entries across all students.`);
