export const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function postJson(path, body) {
  const response = await fetch(`${backendUrl}${path}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
}
