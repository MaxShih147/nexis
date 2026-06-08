/** @type {import('tailwindcss').Config} */
import { addDynamicIconSelectors } from '@iconify/tailwind'
import { PRIMARY_PALETTE } from './src/constants/theme.js'

export default {
  darkMode: 'selector',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: PRIMARY_PALETTE,
      },
    },
  },
  plugins: [
    addDynamicIconSelectors({
      customise: (content, _name, _prefix) => {
        // Change stroke-width for all icons
        return content.replaceAll('stroke-width="2"', 'stroke-width="1.5"')
      },
    }),
  ],
}
