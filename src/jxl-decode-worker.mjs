import initModule, { JxlImage, version } from 'jxl-oxide-wasm';

let fileBuffer = null;
let fileName = '';
let loadedBytes = 0;
let image = null;

function reset() {
  fileBuffer = null;
  fileName = '';
  loadedBytes = 0;
  if (image) {
    image.free();
    image = null;
  }
}

async function loadFile(file) {
  reset();

  if (typeof file === 'string') {
    const res = await fetch(file);
    if (!res.ok) {
      throw new Error('Failed to fetch resource');
    }
    fileName = '';
    fileBuffer = await res.arrayBuffer();
  } else {
    fileName = file.name;
    fileBuffer = await file.arrayBuffer();
  }

  return fileBuffer.byteLength;
}

async function decodeAndRender(bytes, forceSrgb) {
  if (!fileBuffer) {
    throw new Error('file is not loaded');
  }

  if (bytes == null) {
    bytes = fileBuffer.byteLength;
  }

  if (!image) {
    await initModule();
    image = new JxlImage();
    loadedBytes = 0;
  } else if (loadedBytes > bytes) {
    image.free();
    image = new JxlImage();
    loadedBytes = 0;
  }

  const bytesToFeed = new Uint8Array(fileBuffer, loadedBytes, bytes - loadedBytes);

  try {
    console.time('Decode and render');

    image.feedBytes(bytesToFeed);
    loadedBytes = bytes;

    const loadingDone = image.tryInit();
    if (!loadingDone) {
      throw new Error('partial image, no frame data');
    }

    if (forceSrgb != null) {
      image.forceSrgb = forceSrgb;
    }

    console.timeLog('Decode and render', 'started rendering');
    const renderResult = image.render();

    console.timeLog('Decode and render', 'encoding to PNG');
    const output = renderResult.encodeToPng();

    return output;
  } finally {
    console.timeEnd('Decode and render');
  }
}

async function handleMessage(ev) {
  const data = ev.data;
  try {
    switch (data.type) {
      case 'version':
        await initModule();
        self.postMessage(
          { type: 'version', version: version() },
        );
        break;
      case 'load': {
        const bytes = await loadFile(data.file);
        self.postMessage({ type: 'bytes', bytes });
        break;
      }
      case 'decode': {
        const image = await decodeAndRender(data.bytes, data.forceSrgb);
        const blob = new File(
          [image],
          fileName ? fileName + '.rendered.png' : 'rendered.png',
          { type: 'image/png' },
        );
        self.postMessage({ type: 'blob', blob });
        break;
      }
      case 'reset':
        reset();
        break;
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      err,
    });
  }
}

self.addEventListener('message', ev => {
  handleMessage(ev);
})
