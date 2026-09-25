const nameSelect = document.getElementById('loginName');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const studentIdInput = document.getElementById('loginStudentId');

async function loadNames() {
  const res = await fetch('/api/students');
  const students = await res.json();
  nameSelect.innerHTML = students.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
}
loadNames();

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');

  const name = nameSelect.value;
  const studentId = studentIdInput.value.trim();

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, studentId })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      loginError.textContent = data.error || 'Incorrect Student ID. Please try again.';
      loginError.classList.remove('hidden');
      return;
    }

    window.location.href = '/';
  } catch (err) {
    loginError.textContent = 'Error: ' + err.message;
    loginError.classList.remove('hidden');
  }
});
