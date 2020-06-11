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
            sourcemap: true,
        },
        external: ['hash-sum', 'nanoid/non-secure'],
        plugins: [typescript({ declaration: true, declarationDir: 'lib' }), resolve(), commonjs(), terser()],
    },
    {
        input: 'src/index.ts',
        output: {
            format: 'esm',
            file: 'lib/index.mjs',
            sourcemap: true,
        },
        external: ['hash-sum', 'nanoid/non-secure'],
        plugins: [typescript(), resolve(), commonjs(), terser()],
    },
    {
        input: 'src/index.browser.ts',
        output: [
            {
                format: 'esm',
                file: 'lib/index.browser.mjs',
                sourcemap: true,
            },
            {
                format: 'cjs',
                file: 'lib/index.browser.js',
                exports: 'named',
                sourcemap: true,
            },
        ],
        external: ['hash-sum', 'nanoid/non-secure'],
        plugins: [typescript(), resolve(), commonjs(), terser()],
    },
];
