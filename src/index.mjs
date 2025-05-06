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

async function decodeIntoImageNode(file, imgNode, errorDisplay, bytes) {
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
              reject(data.err);
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

    errorDisplay.textContent = '';
    errorDisplay.classList.remove('show');
  } catch (e) {
    errorDisplay.textContent = String(e);
    errorDisplay.classList.add('show');
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
  const img = document.querySelector('.image');
  const errorDisplay = document.querySelector('.error');

  const imageContainer = document.querySelector('.image-container');
  const toggleZoomBtn = document.querySelector('.btn-zoom-mode');
  toggleZoomBtn.addEventListener('click', () => {
    imageContainer.classList.toggle('scale-down');
    const isScaleDown = imageContainer.classList.contains('scale-down');
    const text = isScaleDown ? 'Change to 1x zoom' : 'Change to scale down';
    toggleZoomBtn.textContent = text;

    updateScale();
  });

  const partialLoadControls = document.querySelector('.partial-load');
  const partialLoadSlider = partialLoadControls.querySelector('.slider');
  const partialLoadLabel = partialLoadControls.querySelector('.percentage');
  const partialLoadBytes = partialLoadControls.querySelector('.bytes');

  function updateLabel() {
    const value = partialLoadSlider.value;
    const max = partialLoadSlider.max;
    let percentage = '';
    let bytes = '';
    if (max > 0) {
      percentage = `${(value * 100 / max).toFixed(2)}%`;
      bytes = `${value} / ${max} bytes`;
    }
    partialLoadLabel.textContent = percentage;
    partialLoadBytes.textContent = bytes;
  }
  updateLabel();

  partialLoadSlider.addEventListener('input', updateLabel);

  partialLoadSlider.addEventListener('pointerup', () => {
    const file = fileInput.files[0];
    if (file) {
      const bytes = partialLoadSlider.value;
      decodeIntoImageNode(file, img, errorDisplay, bytes);
    }
  });

  const fileInput = document.querySelector('.file');
  async function reloadFile() {
    const file = fileInput.files[0];

    if (file) {
      const size = file.size;
      partialLoadSlider.max = size;
      partialLoadSlider.value = size;
      partialLoadSlider.disabled = false;
      updateLabel();

      await decodeIntoImageNode(file, img, errorDisplay);
      return true;
    } else {
      partialLoadSlider.max = 0;
      partialLoadSlider.value = 0;
      partialLoadSlider.disabled = true;
      updateLabel();

      return false;
    }
  }

  fileInput.addEventListener('input', reloadFile);

  img.addEventListener('load', () => {
    updateScale();
  });

  reloadFile().then(ok => {
    if (!ok) {
      decodeIntoImageNode(sunsetLogoUrl, img, errorDisplay);
    }
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
