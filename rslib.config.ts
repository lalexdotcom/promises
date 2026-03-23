import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'cjs',
      syntax: 'es2020',
      dts: false,
    },
    {
      format: 'esm',
      syntax: ['node 18'],
      dts: true,
    },
  ],
});
