export async function request(path: string, method = 'GET', data?: unknown) {
  const r = await fetch(path, {
    method,
    headers:
      data instanceof FormData
        ? {}
        : data === undefined
          ? {}
          : { 'Content-Type': 'application/json' },
    body:
      data === undefined
        ? undefined
        : data instanceof FormData
          ? data
          : JSON.stringify(data),
  });
  let b: any;
  try {
    b = await r.json();
  } catch {
    throw new Error(
      'The server could not complete this request. Please try again.',
    );
  }
  if (!r.ok) throw new Error(b.error || 'Request failed.');
  return b;
}
export function istInput(date: Date) {
  return new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 16);
}
export function displayDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
