import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'src/index.ts',
    output: [
        {
            format: 'cjs',
            dir: 'lib',
        },
    ],
    plugins: [typescript(), resolve(), commonjs(), terser()],
};
