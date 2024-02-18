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

Now `dist/` contains the demo. Run HTTP file server in that directory. You need to use `localhost`
URL (or use HTTPS) since Service Worker requires secure context.

[Live demo]: https://jxl-oxide.tirr.dev/demo/index.html
[`wasm-pack`]: https://rustwasm.github.io/wasm-pack/
