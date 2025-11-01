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
    { pattern: /^w-\[300px\]$/ },
  ],
  plugins:[] 
}
