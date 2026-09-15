let token;
export async function api(url, body, retried = false) {
  if (!token) token = (await (await fetch('/api/config')).json()).token;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Studio-Token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  // A local server restart rotates the token; preserve the open editor and retry once.
  if (res.status === 403 && !retried) {
    token = null;
    return api(url, body, true);
  }
  const data = await res.json();
  if (!res.ok) throw Error(data.error || '요청에 실패했습니다.');
  return data;
}
