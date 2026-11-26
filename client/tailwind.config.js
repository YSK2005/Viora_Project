/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Viora Bills Brand Palette
        // 1. Midnight Navy (#0D1A33) - Sidebar, headings, primary text
        navy: {
          50:  '#F0F4FA',
          100: '#E1E9F5',
          200: '#C4D3EC',
          300: '#9AB4DD',
          400: '#6A8EC9',
          500: '#466DB1',
          600: '#32528D',
          700: '#233B69',
          800: '#17274B',
          900: '#0D1A33', // Midnight Navy Core
          950: '#070E1E',
        },
        // 2. Dusk Blue (#8FB4E3) - Application background, secondary surfaces & chart accents
        dusk: {
          50:  '#F4F8FD', // Lightest content surface background
          100: '#EAF2FB',
          200: '#D5E4F5', // Soft borders and chip backgrounds
          300: '#B6D1EF',
          400: '#8FB4E3', // Dusk Blue Core
          500: '#6B94D1',
          600: '#4E77BD',
          700: '#3A5CA2',
          800: '#2A457D',
          900: '#1F345F',
          950: '#121F3A',
        },
        // 3. Sunset Orange (#FF6A2B) - Primary buttons, active navigation, badges, highlights
        sunset: {
          50:  '#FFF5F0',
          100: '#FFE9DE',
          200: '#FFD0BC',
          300: '#FFAF8F',
          400: '#FF8A58',
          500: '#FF6A2B', // Sunset Orange Core
          600: '#E85215',
          700: '#C23D09',
          800: '#9B300C',
          900: '#7E290E',
          950: '#451203',
        },
        // Brand alias mapped to Sunset Orange for complete backward compatibility
        brand: {
          50:  '#FFF5F0',
          100: '#FFE9DE',
          200: '#FFD0BC',
          300: '#FFAF8F',
          400: '#FF8A58',
          500: '#FF6A2B', // Sunset Orange Core
          600: '#E85215',
          700: '#C23D09',
          800: '#9B300C',
          900: '#7E290E',
          950: '#451203',
        },
        accent: {
          50:  '#F4F8FD',
          100: '#EAF2FB',
          200: '#D5E4F5',
          300: '#B6D1EF',
          400: '#8FB4E3',
          500: '#6B94D1',
          600: '#4E77BD',
          700: '#3A5CA2',
          800: '#2A457D',
          900: '#1F345F',
          950: '#121F3A',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Outfit',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      borderRadius: {
        'card': '12px',
        'button': '10px',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(13, 26, 51, 0.04)',
        'card': '0 1px 3px 0 rgba(13, 26, 51, 0.06), 0 1px 2px -1px rgba(13, 26, 51, 0.04)',
        'card-hover': '0 4px 12px -2px rgba(13, 26, 51, 0.08), 0 2px 6px -1px rgba(13, 26, 51, 0.04)',
        'popover': '0 10px 25px -5px rgba(13, 26, 51, 0.1), 0 8px 10px -6px rgba(13, 26, 51, 0.05)',
        'orange': '0 2px 8px 0 rgba(255, 106, 43, 0.25)',
      },
    },
  },
  plugins: [],
}
