# jxl-oxide-wasm Demo
[Live demo]

## Building the demo locally
You'll need:
- Node.js (version 20.x is recommended)
- Yarn

First, install Yarn dependencies. It will download prebuilt package of `jxl-oxide-wasm`.
```shell
yarn install --immutable
```

Then, bundle the demo with Webpack.
```shell
yarn build
```

Now `dist/` contains the demo. Serve the directory with an HTTP file server. Any file server is
fine; typically `http.server` module of Python is the simplest one.
```shell
python3 -m http.server -d dist/
```

You need to use `localhost` URL (or use HTTPS) since Service Worker requires secure context.

[Live demo]: https://jxl-oxide.tirr.dev/demo/index.html
[`wasm-pack`]: https://rustwasm.github.io/wasm-pack/
