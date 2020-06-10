import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                format: 'esm',
                dir: 'lib',
                sourcemap: true,
            },
        ],
        external: ['hash-sum', 'nanoid/non-secure'],
        plugins: [typescript({ declaration: true, outDir: 'lib' }), resolve(), commonjs(), terser()],
    },
    {
        input: 'src/index.browser.ts',
        output: [
            {
                format: 'esm',
                file: 'lib/index.browser.js',
                sourcemap: true,
            },
        ],
        external: ['hash-sum', 'nanoid/non-secure'],
        plugins: [typescript(), resolve(), commonjs(), terser()],
    },
];
