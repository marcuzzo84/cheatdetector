import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import copy from 'rollup-plugin-copy';

export default {
  input: {
    'background/service-worker': 'src/background/service-worker.js',
    'content/content-script': 'src/content/content-script.js',
    'ui/popup': 'src/ui/popup.js'
  },
  output: {
    dir: 'dist',
    format: 'es',
    entryFileNames: '[name].js',
    chunkFileNames: 'shared/[name]-[hash].js'
  },
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    replace({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      'process.env.FAIRPLAY_JWT': JSON.stringify(process.env.FAIRPLAY_JWT || 'demo-jwt-token-replace-in-production'),
      'process.env.LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL || 'info'),
      preventAssignment: true
    }),
    copy({
      targets: [
        // Copy manifest and static files
        { src: 'src/manifest.json', dest: 'dist' },
        { src: 'src/ui/popup.html', dest: 'dist/ui' },
        { src: 'src/ui/popup.css', dest: 'dist/ui' },
        
        // Create icons directory and placeholder icons
        { 
          src: 'src/ui/icons/*', 
          dest: 'dist/ui/icons',
          // If icons don't exist, we'll create them in the build process
        }
      ],
      hook: 'buildStart'
    })
  ],
  external: ['chrome']
};