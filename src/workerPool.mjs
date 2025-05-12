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
      worker = new Decoder();
    }
    return worker;
  }

  putWorker(worker) {
    worker.reset();

    const maybeResolve = this.#queue.shift();
    if (maybeResolve) {
      maybeResolve(worker);
      return;
    }

    this.#workerPool.push(worker);
    this.#remaining += 1;
  }
}

export class Decoder {
  #worker;
  #size = 0;
  #promise = null;
  #cancel = null;

  constructor() {
    this.#worker = new Worker(new URL('./jxl-decode-worker.mjs', import.meta.url));
  }

  async getVersion() {
    return new Promise(resolve => {
      this.#worker.addEventListener(
        'message',
        ev => {
          const data = ev.data;
          switch (data.type) {
            case 'version':
              resolve(data.version);
              break;
          }
        },
        { once: true },
      );
      this.#worker.postMessage({ type: 'version' });
    });
  }

  async load(file) {
    this.#size = 0;
    this.#size = await new Promise((resolve, reject) => {
      this.#worker.addEventListener(
        'message',
        ev => {
          const data = ev.data;
          switch (data.type) {
            case 'bytes':
              resolve(data.bytes);
              break;
            case 'error':
              reject(data.err);
              break;
          }
        },
        { once: true },
      );
      this.#worker.postMessage({ type: 'load', file });
    });
    return this.#size;
  }

  get size() {
    return this.#size;
  }

  async decode(bytes, forceSrgb) {
    if (this.#cancel) {
      this.#cancel();
      this.#cancel = null;
    }

    let cancelled = false;
    const decodePromise = (async () => {
      await this.#promise;

      if (cancelled) {
        return;
      }

      try {
        const promise = this.#decodeImmediately(bytes, forceSrgb);
        this.#promise = promise;
        return promise;
      } finally {
        this.#promise = null;
      }
    })();
    const cancelPromise = new Promise((_, reject) => {
      this.#cancel = () => {
        cancelled = true;
        reject(new DecodeCancelError());
      };
    });

    return Promise.race([decodePromise, cancelPromise]);
  }

  async #decodeImmediately(bytes, forceSrgb) {
    return new Promise((resolve, reject) => {
      this.#worker.addEventListener(
        'message',
        ev => {
          const data = ev.data;
          switch (data.type) {
            case 'blob':
              resolve(data.blob);
              break;
            case 'error':
              reject(data.err);
              break;
          }
        },
        { once: true },
      );
      this.#worker.postMessage({ type: 'decode', bytes, forceSrgb });
    });
  }

  reset() {
    this.#worker.postMessage({ type: 'reset' });
  }
}

export class DecodeCancelError extends Error {
  constructor() {
    super('decode cancelled');
  }
}
