export function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
