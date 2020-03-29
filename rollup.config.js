import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import commonjs from '@rollup/plugin-commonjs';

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                format: 'cjs',
                dir: 'lib',
            },
        ],
        external: ['hash-sum', 'nanoid/non-secure'],
        plugins: [typescript({ declaration: true, outDir: 'lib' }), resolve(), commonjs()],
    },
    {
        input: 'src/index.ts',
        output: [
            {
                format: 'es',
                file: 'lib/index.es.js',
            },
        ],
        external: ['hash-sum', 'nanoid/non-secure'],
        plugins: [typescript(), resolve(), commonjs()],
    },
];
