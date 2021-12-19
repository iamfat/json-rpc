import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
    {
        input: 'src/index.ts',
        output: {
            format: 'cjs',
            dir: 'lib',
            exports: 'named',
            compact: true,
        },
        plugins: [
            typescript({
                declaration: true,
                declarationDir: 'lib',
                declarationMap: false,
                exclude: ['src/index.*.ts'],
            }),
            resolve(),
            commonjs(),
        ],
        external: ['js-base64'],
    },
    {
        input: 'src/index.ts',
        output: {
            format: 'es',
            file: 'lib/index.mjs',
        },
        plugins: [typescript(), resolve(), commonjs()],
        external: ['js-base64'],
    },
    {
        input: 'src/index.browser.ts',
        output: [
            {
                format: 'es',
                file: 'lib/index.browser.mjs',
            },
            {
                format: 'cjs',
                file: 'lib/index.browser.js',
                exports: 'named',
                compact: true,
            },
        ],
        plugins: [typescript(), resolve(), commonjs()],
        external: ['js-base64'],
    },
    {
        input: 'src/index.rn.ts',
        output: [
            {
                format: 'es',
                file: 'lib/index.rn.mjs',
            },
            {
                format: 'cjs',
                file: 'lib/index.rn.js',
                exports: 'named',
                compact: true,
            },
        ],
        plugins: [typescript({ sourceMap: false }), resolve(), commonjs()],
        external: ['js-base64'],
    },
];
