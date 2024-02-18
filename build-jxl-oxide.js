child_process.execFileSync(
  'git',
  [
    'clone',
    '--depth=1',
    'https://github.com/tirr-c/jxl-oxide.git',
    execEnv.tempDir
  ],
);

child_process.execFileSync(
  'wasm-pack',
  [
    'build',
    '--release',
    '--out-dir',
    execEnv.buildDir,
  ],
  {
    cwd: path.resolve(execEnv.tempDir, './crates/jxl-oxide-wasm'),
  },
);
