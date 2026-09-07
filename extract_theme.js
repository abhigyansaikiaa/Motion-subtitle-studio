const fs = require('fs');
const html = fs.readFileSync('design_new/Word_Timeline_Inspector.html', 'utf8');
const match = html.match(/tailwind\.config\s*=\s*(\{.*?\})\s*<\/script>/);

if (match) {
  const config = new Function('return ' + match[1])();
  const extend = config.theme.extend;
  
  let css = `@import "tailwindcss";\n@source "design_new/*.html";\n\n@theme {\n`;
  
  // Colors
  if (extend.colors) {
    for (const [key, val] of Object.entries(extend.colors)) {
      css += `  --color-${key}: ${val};\n`;
    }
  }
  
  // Spacing
  if (extend.spacing) {
    for (const [key, val] of Object.entries(extend.spacing)) {
      css += `  --spacing-${key}: ${val};\n`;
    }
  }
  
  // Border Radius
  if (extend.borderRadius) {
    for (const [key, val] of Object.entries(extend.borderRadius)) {
      if (key === 'DEFAULT') css += `  --radius: ${val};\n`;
      else css += `  --radius-${key}: ${val};\n`;
    }
  }
  
  // Font Family
  if (extend.fontFamily) {
    for (const [key, val] of Object.entries(extend.fontFamily)) {
      css += `  --font-${key}: '${val[0]}', sans-serif;\n`;
    }
  }

  // Font Size
  if (extend.fontSize) {
    for (const [key, val] of Object.entries(extend.fontSize)) {
      css += `  --text-${key}: ${val[0]};\n`;
      css += `  --text-${key}--line-height: ${val[1].lineHeight};\n`;
      if(val[1].letterSpacing) css += `  --text-${key}--letter-spacing: ${val[1].letterSpacing};\n`;
      if(val[1].fontWeight) css += `  --text-${key}--font-weight: ${val[1].fontWeight};\n`;
    }
  }

  css += `}\n`;
  fs.writeFileSync('tailwind_in.css', css);
  console.log('tailwind_in.css created successfully with theme');
} else {
  console.log('Config not found in HTML');
}
