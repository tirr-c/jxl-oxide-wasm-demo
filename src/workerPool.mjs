export class WorkerPool {
  #workerPool = [];
  #queue = [];
  #remaining;

  constructor(maxConcurrentWorkers = 8) {
    this.#remaining = maxConcurrentWorkers;
  }

  async getWorker() {
    if (this.#remaining <= 0) {
      return new Promise(resolve => {
        this.#queue.push(resolve);
      });
    }

    this.#remaining -= 1;
    let worker = this.#workerPool.shift();
    if (!worker) {
      worker = new Worker(new URL('./jxl-decode-worker.mjs', import.meta.url));
    }
    return worker;
  }

  putWorker(worker) {
    worker.postMessage({ type: 'reset' });

    const maybeResolve = this.#queue.shift();
    if (maybeResolve) {
      maybeResolve(worker);
      return;
    }

    this.#workerPool.push(worker);
    this.#remaining += 1;
  }
}
