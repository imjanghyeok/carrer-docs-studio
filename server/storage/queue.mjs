/** Serialize work per key within this process; failures do not block later work. */
export function createQueue() {
  const queues = new Map();
  function locked(id, action) {
    const promise = (queues.get(id) || Promise.resolve()).catch(() => {}).then(action);
    queues.set(id, promise);
    return promise;
  }

  return locked;
}
