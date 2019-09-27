import typescript from 'rollup-plugin-typescript2'
import { terser } from 'rollup-plugin-terser'
import commonjs from 'rollup-plugin-commonjs'
import pkg from './package.json'

const dependencies = Object.assign(
  {},
  pkg.dependencies || {},
  pkg.peerDependencies || {}
)

const external = Object.keys(dependencies)

export default {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
    }
  ],
  external,
  plugins: [
    typescript({
      typescript: require('typescript'),
      cacheRoot: `${require('temp-dir')}/.rpt2_cache`
    }),
    commonjs(),
    terser()
  ]
}
