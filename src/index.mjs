import { WorkerPool } from './workerPool.mjs';

import './styles.css';
import sunsetLogoUrl from './assets/sunset_logo.jxl';

if ('serviceWorker' in window.navigator) {
  window.navigator.serviceWorker.getRegistration()
    .then(registration => registration?.unregister())
    .then(ok => {
      if (ok) {
        window.location.reload();
      }
    });
}

const workerPool = new WorkerPool(8);

function scaleDown(img) {
  img.style.width = '';
}

function scaleTo1x(img) {
  const width = img.naturalWidth / window.devicePixelRatio;
  img.style.width = `${width}px`;
}

async function decodeIntoImageNode(file, imgNode, bytes) {
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
      worker.postMessage({ type: 'file', file, bytes });
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

  const partialLoadCheckbox = document.querySelector('.cb-partial-load');
  const partialLoadSlider = document.querySelector('.range-partial-load');
  const partialLoadLabel = document.querySelector('.label-partial-load');
  function updateLabel() {
    const value = partialLoadSlider.value;
    const max = partialLoadSlider.max;
    let label = '';
    if (max > 0) {
      label = `${(value * 100 / max).toFixed(2)}%`;
    }
    partialLoadLabel.textContent = label;
  }
  updateLabel();

  partialLoadCheckbox.addEventListener('click', () => {
    const checked = partialLoadCheckbox.checked;
    partialLoadSlider.disabled = !checked;
    if (!checked) {
      partialLoadSlider.value = partialLoadSlider.max;
      updateLabel();
    }
  });

  partialLoadSlider.addEventListener('input', updateLabel);

  const form = document.querySelector('.form');
  const fileInput = document.querySelector('.file');
  fileInput.addEventListener('input', () => {
    const file = fileInput.files[0];
    const size = file.size;
    partialLoadSlider.max = size;
    partialLoadSlider.value = size;
    updateLabel();
  });

  const img = document.createElement('img');
  img.className = 'image';
  img.addEventListener('load', () => {
    updateScale();
  });

  imageContainer.innerHTML = '';
  imageContainer.appendChild(img);
  form.addEventListener('submit', ev => {
    ev.preventDefault();

    const bytes = partialLoadCheckbox.checked ? partialLoadSlider.value : undefined;
    const file = fileInput.files[0];
    if (file) {
      decodeIntoImageNode(file, img, bytes);
    }
  });

  decodeIntoImageNode(sunsetLogoUrl, img);

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
