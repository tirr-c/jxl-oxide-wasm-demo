import { DecodeCancelError, WorkerPool } from './workerPool.mjs';

import './styles.css';
import images from './images.mjs';

if ('serviceWorker' in window.navigator) {
  (async () => {
    try {
      const registration = await window.navigator.serviceWorker.getRegistration();
      if (await registration?.unregister()) {
        window.location.reload();
      }
    } catch (_e) {
      // Ignore errors
    }
  })();
}

const hdrQuery = window.matchMedia('(dynamic-range: high)');
let isHdr = hdrQuery.matches;
hdrQuery.addEventListener('change', ev => {
  isHdr = ev.matches;
});

const workerPool = new WorkerPool(8);

function scaleDown(img) {
  img.style.width = '';
}

function scaleTo1x(img) {
  const width = img.naturalWidth / window.devicePixelRatio;
  img.style.width = `${width}px`;
}

async function decodeIntoImageNode(decoder, imgNode, errorDisplay, bytes) {
  let done = false;
  new Promise(resolve => {
    window.setTimeout(() => {
      if (!done) {
        imgNode.classList.add('loading');
      }
      resolve();
    }, 500);
  });

  try {
    const blob = await decoder.decode(bytes);

    const prevUrl = imgNode.src;
    if (prevUrl.startsWith('blob:')) {
      URL.revokeObjectURL(prevUrl);
    }
    imgNode.src = URL.createObjectURL(blob);

    errorDisplay.textContent = '';
    errorDisplay.classList.remove('show');
  } catch (e) {
    if (!(e instanceof DecodeCancelError)) {
      errorDisplay.textContent = String(e);
      errorDisplay.classList.add('show');
    }
  } finally {
    done = true;
    imgNode.classList.remove('loading');
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
  const version = await worker.getVersion();
  workerPool.putWorker(worker);
  return version
}

document.addEventListener('DOMContentLoaded', () => {
  const img = document.querySelector('.image');
  const errorDisplay = document.querySelector('.error');

  const sampleImageSelector = document.querySelector('.sample-images');
  const sampleImageEmptyOption = sampleImageSelector.querySelector('.empty');
  for (let idx = 0; idx < images.length; idx += 1) {
    const sampleImage = images[idx];

    const option = document.createElement('option');
    option.value = String(idx);
    option.textContent = sampleImage.name;
    sampleImageSelector.appendChild(option);
  }

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
    const value = Number(partialLoadSlider.value);
    const max = Number(partialLoadSlider.max);
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

  const fileInput = document.querySelector('.file');
  let decoder = null;

  async function reloadFileRefresh() {
    if (decoder) {
      workerPool.putWorker(decoder);
      decoder = null;
    }

    let file = fileInput.files[0];
    if (file == null) {
      const idxString = sampleImageSelector.value;
      if (idxString !== '') {
        file = images[Number(idxString)]?.url;
      }
    } else {
      sampleImageEmptyOption.textContent = file.name;
      sampleImageSelector.value = '';
    }

    if (file) {
      decoder = await workerPool.getWorker();
      const bytes = await decoder.load(file, !isHdr);
      partialLoadSlider.max = bytes;
      partialLoadSlider.value = bytes;
      partialLoadSlider.disabled = false;
      updateLabel();

      await decodeIntoImageNode(decoder, img, errorDisplay, bytes);
      return true;
    } else {
      partialLoadSlider.max = 0;
      partialLoadSlider.value = 0;
      partialLoadSlider.disabled = true;
      updateLabel();

      return false;
    }
  }

  async function reloadFile() {
    if (decoder) {
      const bytes = Number(partialLoadSlider.value);
      await decodeIntoImageNode(decoder, img, errorDisplay, bytes);
    }
  }

  partialLoadSlider.addEventListener('input', updateLabel);

  partialLoadSlider.addEventListener('pointerup', reloadFile);

  let leftPressed = false;
  let rightPressed = false;

  partialLoadSlider.addEventListener('keydown', ev => {
    const { key } = ev;
    let direction = 0;
    switch (key) {
      case 'ArrowLeft':
        leftPressed = true;
        direction = -1;
        break;
      case 'ArrowRight':
        rightPressed = true;
        direction = 1;
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        ev.preventDefault();
        return;
      default:
        return;
    }

    ev.preventDefault();

    let scale = 10;
    if (ev.altKey) {
      scale = 1;
    } else if (ev.shiftKey) {
      scale = 100;
    }

    const dValue = direction * scale;
    let newValue = Number(partialLoadSlider.value) + dValue;
    if (newValue < 0) {
      newValue = 0;
    }
    partialLoadSlider.value = Math.min(newValue, partialLoadSlider.max);
    updateLabel();
  });

  partialLoadSlider.addEventListener('keyup', ev => {
    const { key } = ev;
    switch (key) {
      case 'ArrowLeft':
        leftPressed = false;
        break;
      case 'ArrowRight':
        rightPressed = false;
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        ev.preventDefault();
        return;
      default:
        return;
    }

    ev.preventDefault();

    if (!leftPressed && !rightPressed) {
      reloadFile();
    }
  });

  fileInput.addEventListener('change', reloadFileRefresh);

  sampleImageSelector.addEventListener('change', () => {
    if (sampleImageSelector.value !== '') {
      fileInput.value = '';
    }
    reloadFileRefresh();
  });

  img.addEventListener('load', () => {
    updateScale();
  });

  if (fileInput.files[0] == null) {
    sampleImageSelector.value = '0';
  } else {
    sampleImageSelector.value = '';
  }

  reloadFileRefresh();

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
