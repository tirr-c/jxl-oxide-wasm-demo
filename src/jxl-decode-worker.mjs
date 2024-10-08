import initModule, { JxlImage, version } from 'jxl-oxide-wasm';

let image = null;
async function feed(buffer) {
  if (!image) {
    await initModule();
    image = new JxlImage();
  }
  image.feedBytes(buffer);
}

function render() {
  console.time('Decode and render');
  const loadingDone = image.tryInit();
  if (!loadingDone) {
    throw new Error('Partial image, no frame data');
  }

  console.timeLog('Decode and render', 'started rendering');
  const renderResult = image.render();

  console.timeLog('Decode and render', 'encoding to PNG');
  const output = renderResult.encodeToPng();

  console.timeEnd('Decode and render');
  return output;
}

async function decodeFile(file) {
  await initModule();
  image = new JxlImage();

  const reader = file.stream().getReader();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    image.feedBytes(chunk.value);
  }

  const buffer = render();
  const blob = new File(
    [buffer],
    file.name + '.rendered.png',
    { type: 'image/png' },
  );
  self.postMessage({ type: 'blob', blob });
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
      case 'file':
        await decodeFile(data.file);
        break;
      case 'feed':
        await feed(data.buffer);
        self.postMessage({ type: 'feed' });
        break;
      case 'decode': {
        const image = render();
        self.postMessage(
          { type: 'image', image },
          [image.buffer],
        );
        break;
      }
      case 'reset':
        if (image) {
          image.free();
          image = null;
        }
        break;
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: String(err),
    });
  }
}

self.addEventListener('message', ev => {
  handleMessage(ev);
})
