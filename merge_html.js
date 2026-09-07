const fs = require('fs');

const inspector = fs.readFileSync('design_new/Word_Timeline_Inspector.html', 'utf8');
const styles = fs.readFileSync('design_new/Foundry_Style_Catalogue.html', 'utf8');
const dashboard = fs.readFileSync('design_new/Projects_Render_Vault.html', 'utf8');

function extractMainContent(html) {
  const match = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  return match ? match[1] : '';
}
function extractHeader(html) {
  const match = html.match(/<header[^>]*>([\s\S]*?)<\/header>/);
  return match ? match[1] : '';
}
function extractNav(html) {
  const match = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/);
  return match ? match[1] : '';
}

const headerContent = extractHeader(inspector);
const navContent = extractNav(inspector);

const editorHtml = extractMainContent(inspector);
const stylesHtml = extractMainContent(styles);
const dashHtml = extractMainContent(dashboard);

const newIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>Reel Type Caption Engine</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
  <link rel="stylesheet" href="css/style.css" />
  
  <style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
</head>
<body class="bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen selection:bg-primary selection:text-on-primary">
  
  <header class="fixed top-0 w-full z-50 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]" id="top-header">
    ${headerContent}
  </header>

  <main class="flex flex-col relative w-full pt-16 pb-24 bg-surface min-h-screen">
    <!-- DASHBOARD VIEW -->
    <section id="dashboardView" class="view active w-full">
      ${dashHtml}
    </section>
    
    <!-- EDITOR VIEW -->
    <section id="editorView" class="view w-full">
      ${editorHtml}
    </section>

    <!-- CATALOGUE VIEW -->
    <section id="catalogueView" class="view w-full">
      ${stylesHtml}
    </section>
  </main>

  <nav id="global-bottom-nav" class="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-1px_8px_rgba(0,0,0,0.04)]" data-active-classes="text-primary font-semibold">
    ${navContent}
  </nav>

  <script src="js/app.js"></script>
</body>
</html>`;

fs.writeFileSync('public/index.html', newIndexHtml);
console.log('Successfully generated public/index.html');
