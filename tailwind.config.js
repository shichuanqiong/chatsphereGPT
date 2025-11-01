/** @type {import('tailwindcss').Config} */
export default { 
  content:['./index.html','./src/**/*.{ts,tsx,js,jsx}'], 
  theme:{ 
    extend:{
      width: {
        rail: "300px",
      },
    }
  }, 
  safelist: [
    { pattern: /^w-\[\d+px\]$/ },
    "w-[300px]",
    "w-rail",
  ],
  plugins:[] 
}
