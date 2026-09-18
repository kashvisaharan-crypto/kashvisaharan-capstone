async function initAuthNav({ requireLogin }) {
  const authStatus = document.getElementById('authStatus');
  let name = null;

  try {
    const res = await fetch('/api/current-student');
    const data = await res.json();
    name = data.name;
  } catch (err) {
    name = null;
  }

  if (!authStatus) return name;

  if (name) {
    authStatus.innerHTML = `<span>Welcome, ${name}</span> <button id="logoutBtn" type="button">Logout</button>`;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/login';
    });
  } else {
    authStatus.innerHTML = '<a href="/login">Login</a>';
    if (requireLogin) {
      window.location.href = '/login';
    }
  }

  return name;
}
