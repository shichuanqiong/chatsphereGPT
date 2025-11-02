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
    // Arbitrary width patterns
    { pattern: /^w-\[\d+px\]$/ },
    { pattern: /^w-\[[\d.]+%\]$/ },
    // Specific widths used in codebase
    "w-[300px]",
    "w-rail",
    "w-[280px]",
    // Media query variants
    { pattern: /^md:/ },
    { pattern: /^lg:/ },
    { pattern: /^hidden$/ },
    { pattern: /^block$/ },
    "hidden",
    "md:block",
    "md:flex",
    // Flex and sizing
    { pattern: /^flex-/ },
    { pattern: /^shrink-/ },
    { pattern: /^overflow-/ },
    // Spacing and layout
    { pattern: /^gap-/ },
    { pattern: /^min-/ },
  ],
  plugins:[] 
}
