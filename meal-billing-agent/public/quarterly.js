const quarterSelect = document.getElementById('quarterSelect');
const billCard = document.getElementById('billCard');
const studentName = document.getElementById('studentName');
const billBody = document.getElementById('billBody');
const billTotal = document.getElementById('billTotal');

function formatQuarterLabel(quarterKey) {
  // "2026-Q3" -> "Q3 2026 (Jul-Sep)"
  const [year, q] = quarterKey.split('-Q');
  const monthRanges = { 1: 'Jan-Mar', 2: 'Apr-Jun', 3: 'Jul-Sep', 4: 'Oct-Dec' };
  return `Q${q} ${year} (${monthRanges[q]})`;
}

async function loadBill(quarter) {
  const url = quarter ? `/api/quarterly-bill?quarter=${encodeURIComponent(quarter)}` : '/api/quarterly-bill';
  const res = await fetch(url);
  if (!res.ok) {
    billCard.classList.add('hidden');
    return;
  }
  const data = await res.json();

  // Populate the quarter dropdown the first time, or if it's still empty.
  if (quarterSelect.options.length === 0) {
    quarterSelect.innerHTML = data.availableQuarters
      .map(q => `<option value="${q}">${formatQuarterLabel(q)}</option>`)
      .join('');
    quarterSelect.value = data.quarter;
  }

  studentName.textContent = `${data.name} — ${formatQuarterLabel(data.quarter)}`;
  billBody.innerHTML = data.entries.map(e =>
    `<tr><td>${e.date}</td><td>${e.mealSlot}</td><td>${e.items.map(i => i.name).join(', ')}</td><td>₹${e.total}</td></tr>`
  ).join('') || '<tr><td colspan="4">No approved meals recorded for this quarter.</td></tr>';
  billTotal.textContent = `₹${data.total}`;
  billCard.classList.remove('hidden');
}

quarterSelect.addEventListener('change', () => loadBill(quarterSelect.value));

initAuthNav({ requireLogin: true }).then(() => {
  loadBill();
});
