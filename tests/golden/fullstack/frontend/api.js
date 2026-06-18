// Frontend HTTP client. Each function calls one backend endpoint.

export async function loadUsers() {
  const res = await fetch('/api/users');
  return res.json();
}

export async function createUser(data) {
  return fetch('/api/users', { method: 'POST', body: JSON.stringify(data) });
}

export async function getUser(id) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
