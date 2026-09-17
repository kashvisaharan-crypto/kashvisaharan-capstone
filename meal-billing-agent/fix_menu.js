const fs = require('fs');

const FABRICATED = new Set([
  "penne pasta", "pasta", "broccoli florets", "broccoli", "steamed broccoli",
  "apple slices", "fresh apple", "apple", "white sauce pasta", "cream pasta"
]);

const raw = fs.readFileSync('menu.json', 'utf-8');
const menu = JSON.parse(raw);

let removedCount = 0;
for (const date in menu) {
  for (const slot in menu[date]) {
    if (Array.isArray(menu[date][slot])) {
      const before = menu[date][slot].length;
      menu[date][slot] = menu[date][slot].filter(item => !FABRICATED.has(item));
      removedCount += before - menu[date][slot].length;
    }
  }
}

fs.writeFileSync('menu.json', JSON.stringify(menu, null, 2));
console.log(`Removed ${removedCount} fabricated menu item(s) across all dates/slots.`);

