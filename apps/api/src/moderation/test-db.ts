/**
 * A stand-in for the Drizzle client in moderation specs. Every builder call
 * returns the chain, and each `await` on a chain takes the next queued result,
 * so a spec lists the database's answers in the order the code asks for them
 * and then checks what was written.
 */
export function queuedDb(results: unknown[]) {
  const queue = [...results];
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get(_target, prop) {
        if (prop === "then") {
          const value = queue.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
          return chain();
        };
      },
    });
  /** The argument given to `op` right after `anchor` was called with `table`. */
  const after = (anchor: string, table: unknown, op: string): unknown => {
    const start = calls.findIndex((c) => c.op === anchor && c.args[0] === table);
    if (start < 0) return undefined;
    return calls.slice(start + 1).find((c) => c.op === op)?.args[0];
  };
  return { db: chain() as never, calls, after, remaining: () => queue.length };
}
