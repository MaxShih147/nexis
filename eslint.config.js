import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    'src/three/wasm/**',
    '**/*.md',
  ],
})
