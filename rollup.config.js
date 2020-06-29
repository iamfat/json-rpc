import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default [
    {
        input: 'src/index.ts',
        output: {
            format: 'cjs',
            dir: 'lib',
            exports: 'named',
            compact: true,
        },
        plugins: [typescript({ declaration: true, declarationDir: 'lib' }), resolve(), commonjs(), terser()],
        external: ['js-base64'],
    },
    {
        input: 'src/index.ts',
        output: {
            format: 'esm',
            file: 'lib/index.mjs',
        },
        plugins: [typescript(), resolve(), commonjs(), terser()],
        external: ['js-base64'],
    },
    {
        input: 'src/index.browser.ts',
        output: [
            {
                format: 'esm',
                file: 'lib/index.browser.mjs',
            },
            {
                format: 'cjs',
                file: 'lib/index.browser.js',
                exports: 'named',
                compact: true,
            },
        ],
        plugins: [typescript(), resolve(), commonjs(), terser()],
        external: ['js-base64'],
    },
    {
        input: 'src/index.rn.ts',
        output: [
            {
                format: 'esm',
                file: 'lib/index.rn.mjs',
            },
            {
                format: 'cjs',
                file: 'lib/index.rn.js',
                exports: 'named',
                compact: true,
            },
        ],
        plugins: [typescript({ sourceMap: false }), resolve(), commonjs(), terser()],
        external: ['js-base64'],
    },
];
