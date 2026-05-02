import babel from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import copy from 'rollup-plugin-copy'

const babelConfig = {
  babelHelpers: 'bundled',
  exclude: 'node_modules/**',
  presets: [['@babel/preset-env', { targets: { safari: '14' } }]],
}

const plugins = [nodeResolve(), commonjs(), json(), babel(babelConfig)]

export default [
  {
    input: 'src/index.js',
    output: {
      file: 'script.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: false,
      intro: 'var exports = globalThis;',
    },
    plugins: [
      ...plugins,
      copy({
        targets: [{ src: 'src/webview/styles.css', dest: '.', rename: 'webview-styles.css' }],
        hook: 'writeBundle',
      }),
    ],
  },
  {
    input: 'src/webview/main.js',
    output: {
      file: 'webview-bundle.js',
      format: 'iife',
      name: 'GraphView',
      globals: { d3: 'd3' },
      sourcemap: false,
    },
    external: ['d3'],
    plugins,
  },
]
