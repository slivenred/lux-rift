import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'index.html',
  'styles.css',
  'shaders.js',
  'app.js',
  'README.md',
  'README.zh-TW.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'assets/preview.svg',
];

for (const file of requiredFiles) {
  await access(file, constants.R_OK);
}

const [html, css, shaders, app] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('styles.css', 'utf8'),
  readFile('shaders.js', 'utf8'),
  readFile('app.js', 'utf8'),
]);

const checks = [
  ['HTML doctype', html, /<!doctype html>/i],
  ['responsive viewport', html, /name="viewport"/i],
  ['local stylesheet', html, /href="styles\.css"/],
  ['local shader script', html, /src="shaders\.js"/],
  ['local app script', html, /src="app\.js"/],
  ['WebGL context', app, /getContext\(['"]webgl['"]/],
  ['vertex shader', shaders, /vertexSource\s*:/],
  ['fragment shader', shaders, /fragmentSource\s*:/],
  ['pointer input', app, /pointerdown/],
  ['reduced-motion support', app, /prefers-reduced-motion/],
  ['responsive styles', css, /@media/],
  ['MIT header', html, /Released under the MIT License/],
];

for (const [label, source, pattern] of checks) {
  if (!pattern.test(source)) throw new Error(`Missing ${label}`);
}

const runtime = `${html}\n${css}\n${shaders}\n${app}`;
const externalRuntimeAssets = [
  /<script[^>]+src=["']https?:\/\//i,
  /<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:\/\//i,
  /url\(["']?https?:\/\//i,
  /fetch\(["']https?:\/\//i,
];

for (const pattern of externalRuntimeAssets) {
  if (pattern.test(runtime)) throw new Error('External runtime asset detected');
}

console.log('Lux Rift validation passed.');
