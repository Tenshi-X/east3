// Memory-only reads. Invalidation detaches old in-flight requests so that a
// response started before a write cannot populate the new cache.
export function createReadCache(now = () => Date.now()) {
  const entries = new Map<string, { expires: number; value: Promise<any> }>();
  return {
    clear() {
      entries.clear();
    },
    read<T>(key: string, fetcher: () => Promise<T>, ttl = 15_000): Promise<T> {
      const cached = entries.get(key);
      if (cached && cached.expires > now()) return cached.value;
      if (entries.size >= 100) entries.delete(entries.keys().next().value!);
      const entry = {
        expires: Infinity,
        value: Promise.resolve().then(fetcher),
      };
      entries.set(key, entry);
      entry.value.then(
        () => {
          entry.expires = now() + ttl;
        },
        () => {
          if (entries.get(key) === entry) entries.delete(key);
        },
      );
      return entry.value;
    },
  };
}
