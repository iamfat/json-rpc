import { build } from 'esbuild';

build({
    platform: 'node',
    bundle: true,
    charset: 'utf8',
    format: 'esm',
    entryPoints: ['src/index.ts'],
    outdir: './lib',
});

build({
    platform: 'browser',
    bundle: true,
    charset: 'utf8',
    format: 'esm',
    entryPoints: ['src/index.rn.ts'],
    outdir: './lib',
    external: ['js-base64'],
});

build({
    platform: 'browser',
    bundle: true,
    charset: 'utf8',
    format: 'esm',
    entryPoints: ['src/index.browser.ts'],
    outdir: './lib',
});

build({
    platform: 'browser',
    bundle: true,
    charset: 'utf8',
    format: 'iife',
    entryPoints: ['src/index.browser.ts'],
    outfile: './lib/index.amd.js',
    globalName: '__export__',
    minify: true,
    banner: {
        js: `define(function(){`,
    },
    footer: {
        js: `return __export__;});`,
    },
});
