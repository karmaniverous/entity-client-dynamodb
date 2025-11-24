/** Run a simple concurrency-limited task pool. */
export async function runLimited<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  let running = 0;
  return new Promise((resolveDone, reject) => {
    const startNext = () => {
      while (running < limit && index < tasks.length) {
        const i = index++;
        running++;
        tasks[i]()
          .then((res) => {
            results[i] = res;
          })
          .catch(reject)
          .finally(() => {
            running--;
            if (
              results.length === tasks.length &&
              running === 0 &&
              index >= tasks.length
            ) {
              resolveDone(results);
            } else {
              startNext();
            }
          });
      }
      if (tasks.length === 0) resolveDone(results);
    };
    startNext();
  });
}
