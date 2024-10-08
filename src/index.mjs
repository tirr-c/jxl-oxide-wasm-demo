import { WorkerPool } from './workerPool.mjs';

import './styles.css';
import sunsetLogoUrl from './assets/sunset_logo.jxl';

const workerPool = new WorkerPool(8);

const workers = new Map();
async function registerWorker() {
  if ('serviceWorker' in navigator) {
    const registerPromise = navigator.serviceWorker
      .register('service-worker.js', { updateViaCache: 'imports' })
      .then(
        registration => {
          if (registration.active) {
            registration.addEventListener('updatefound', () => {
              const sw = registration.installing;
              sw.addEventListener('statechange', () => {
                const state = sw.state;
                if (state === 'installed') {
                  console.info('Service Worker update is available.');
                }
              });
            });
          }
        },
        err => {
          console.error(`Registration failed with ${err}`);
          throw err;
        },
      );

    if (!navigator.serviceWorker.controller) {
      await Promise.all([
        registerPromise,
        new Promise(resolve => {
          function handle() {
            resolve();
            navigator.serviceWorker.removeEventListener('controllerchange', handle);
          }

          navigator.serviceWorker.addEventListener('controllerchange', handle);
        }),
      ]);
    }

    navigator.serviceWorker.addEventListener('message', async ev => {
      const sw = ev.source;

      const data = ev.data;
      const id = data.id;
      if (id == null) {
        return;
      }

      if (!workers.has(id)) {
        const worker = await workerPool.getWorker();
        const listener = ev => {
          const data = ev.data;
          switch (data.type) {
            case 'feed':
              sw.postMessage({ id, type: 'feed' });
              break;
            case 'image':
              sw.postMessage(
                { id, type: 'image', image: data.image },
                [data.image.buffer]
              );
              break;
            case 'error':
              sw.postMessage({
                id,
                type: 'error',
                message: data.message,
              });
              break;
          }
          return worker;
        };
        worker.addEventListener('message', listener);
        workers.set(id, { worker, listener });
      }

      const { worker, listener } = workers.get(id);
      switch (data.type) {
        case 'done':
          workers.delete(id);
          worker.removeEventListener('message', listener);
          workerPool.putWorker(worker);
          break;
        case 'feed':
          worker.postMessage({ type: 'feed', buffer: data.buffer }, [data.buffer.buffer]);
          break;
        case 'decode':
          worker.postMessage({ type: 'decode' });
          break;
      }
    });
  }
}

function scaleDown(img) {
  img.style.width = '';
}

function scaleTo1x(img) {
  const width = img.naturalWidth / window.devicePixelRatio;
  img.style.width = `${width}px`;
}

async function decodeIntoImageNode(file, imgNode) {
  imgNode.classList.add('loading');

  const worker = await workerPool.getWorker();

  try {
    const blob = await new Promise((resolve, reject) => {
      worker.addEventListener(
        'message',
        ev => {
          const data = ev.data;
          switch (data.type) {
            case 'blob':
              resolve(data.blob);
              break;
            case 'error':
              reject(new Error(data.message));
              break;
          }
        },
        { once: true },
      );
      worker.postMessage({ type: 'file', file });
    });

    const prevUrl = imgNode.src;
    if (prevUrl.startsWith('blob:')) {
      URL.revokeObjectURL(prevUrl);
    }
    imgNode.src = URL.createObjectURL(blob);
  } finally {
    imgNode.classList.remove('loading');
    workerPool.putWorker(worker);
  }
}

function updateScale() {
  const imageContainer = document.querySelector('.image-container');
  if (!imageContainer) {
    return;
  }

  const img = imageContainer.querySelector('img');
  if (!img) {
    return;
  }

  const isScaleDown = imageContainer.classList.contains('scale-down');
  if (isScaleDown) {
    scaleDown(img);
  } else {
    scaleTo1x(img);
  }
}

async function getVersion() {
  const worker = await workerPool.getWorker();
  return new Promise(resolve => {
    worker.addEventListener(
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
    worker.postMessage({ type: 'version' });
  });
}

registerWorker().then(async () => {
  const imageContainer = document.querySelector('.image-container');
  const form = container.querySelector('.form');
  const fileInput = container.querySelector('.file');

  const img = document.createElement('img');
  img.className = 'image';
  img.src = sunsetLogoUrl;
  img.addEventListener('load', () => {
    updateScale();
  });

  await img.decode().catch(() => {});

  imageContainer.innerHTML = '';
  imageContainer.appendChild(img);
  form.addEventListener('submit', ev => {
    ev.preventDefault();

    const file = fileInput.files[0];
    if (file) {
      decodeIntoImageNode(file, img);
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const imageContainer = document.querySelector('.image-container');
  const toggleZoomBtn = document.querySelector('.btn-zoom-mode');
  toggleZoomBtn.addEventListener('click', () => {
    imageContainer.classList.toggle('scale-down');
    const isScaleDown = imageContainer.classList.contains('scale-down');
    const text = isScaleDown ? 'Change to 1x zoom' : 'Change to scale down';
    toggleZoomBtn.textContent = text;

    updateScale();
  });

  const statusElement = document.querySelector('.status');
  getVersion().then(version => {
    statusElement.textContent = `jxl-oxide-wasm ${version}`;
  });
});

function watchDppxChange() {
  updateScale();

  const dppx = window.devicePixelRatio;
  const mediaQuery = `(resolution: ${dppx}dppx)`;
  const query = window.matchMedia(mediaQuery);
  const cb = () => {
    watchDppxChange();
    query.removeEventListener('change', cb);
  };
  query.addEventListener('change', cb);
}

watchDppxChange();
