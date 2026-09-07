import re
from bs4 import BeautifulSoup

def read_html(path):
    with open(path, 'r', encoding='utf-8') as f:
        return BeautifulSoup(f, 'html.parser')

upload_doc = read_html('design/upload_transcribe.html')
style_doc = read_html('design/style_browser.html')
editor_doc = read_html('design/studio_editor.html')
render_doc = read_html('design/workspace_render.html')
brand_logo_doc = read_html('design/brand_logo.html')

# We will start with upload_doc as the base template
base_doc = upload_doc

# Extract the header and head from upload_doc (already there)
# The main content of upload_doc will become step-1 / step-2
# Wait, actually, let's create a fresh template string
template = """<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>Motion Studio</title>
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com" rel="preconnect"/>
    <link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet"/>
    <style>@layer base{html,body{width:100vw;margin:0;padding:0;background-color:#131314;}body{overscroll-behavior:none;}.pb-safe{padding-bottom:env(safe-area-inset-bottom,0px);}.pt-safe{padding-top:env(safe-area-inset-top,0px);}main>:first-child{margin-top:0!important;}main>:last-child{margin-bottom:0!important;}}::-webkit-scrollbar{display:none;}
    body { min-height: max(884px, 100dvh); }
    .step-container.active { display: flex; }
    .step-container { display: none; }
    .view { display: none; }
    .view.flex { display: flex; }
    </style>
    <script src="https://cdn.tailwindcss.com"></script>
    <script id="tailwind-config">{tailwind_config}</script>
</head>
<body class="bg-surface text-on-surface font-body-md flex flex-col min-h-screen selection:bg-primary selection:text-on-primary">
    {header}
    
    <main class="flex flex-col relative w-full pt-16 pb-24 bg-surface min-h-screen">
        <!-- GLOBAL VIEWS -->
        <section id="view-auth" class="view flex-col items-center justify-center min-h-screen relative p-4 z-50">
            <!-- Reuse old auth form but with dark theme styles -->
            <div class="flex flex-col items-center text-center gap-space-sm mb-space-lg">
                <h1 class="font-headline-lg text-headline-lg text-on-surface">Motion Studio</h1>
                <p class="font-body-md text-on-surface-variant">Sign in to continue</p>
            </div>
            <form class="flex flex-col gap-space-md w-full max-w-sm" id="authForm">
                <input class="bg-surface-container-low text-on-surface px-space-md py-space-sm rounded-lg" name="email" placeholder="Email" type="email" required>
                <input class="bg-surface-container-low text-on-surface px-space-md py-space-sm rounded-lg" name="password" placeholder="Password" type="password" required>
                <button class="w-full bg-primary text-on-primary py-space-sm rounded-lg font-semibold" type="submit">Sign In</button>
            </form>
        </section>

        <section id="view-dashboard" class="view w-full max-w-4xl mx-auto px-space-base hidden flex-col pt-10">
            <div class="flex justify-between items-end mb-space-lg">
                <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Your Projects</h1>
                <button id="btnNewProject" class="bg-primary text-on-primary px-space-md py-space-sm rounded-lg font-label-md uppercase tracking-wider font-semibold hover:bg-primary-fixed-dim transition-colors shadow-sm flex items-center gap-1">
                    <span class="material-symbols-outlined text-[18px]">add</span>
                    New Project
                </button>
            </div>
            <div id="projectsVault" class="flex flex-col gap-4"></div>
        </section>
        
        <section id="view-studio" class="view hidden flex-col relative w-full">
            <div id="step-1" class="step-container flex-col w-full">
                <!-- Dropzone UI -->
                <div class="flex flex-col items-center justify-center py-20 px-4 text-center">
                    <div id="drop-zone" class="w-full max-w-2xl h-64 border-2 border-dashed border-secondary rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-low transition-colors">
                        <span class="material-symbols-outlined text-4xl text-primary mb-4">upload_file</span>
                        <h2 class="font-headline-sm text-on-surface">Drag & Drop Video Here</h2>
                        <p class="font-body-sm text-secondary mt-2">or click to browse (MP4, MOV)</p>
                        <input type="file" id="videoInput" accept="video/mp4,video/quicktime" class="hidden">
                    </div>
                </div>
            </div>
            
            <div id="step-2" class="step-container flex-col w-full">
                {upload_transcribe_html}
            </div>

            <div id="step-3" class="step-container flex-col w-full">
                {style_browser_html}
            </div>
            
            <div id="step-5" class="step-container flex-col w-full h-full">
                {studio_editor_html}
            </div>
            
            <div id="step-6" class="step-container flex-col w-full h-full">
                {workspace_render_html}
            </div>

            <div id="step-7" class="step-container flex-col w-full h-full justify-center items-center py-20">
                <h1 class="font-headline-lg text-primary mb-6">Render Complete!</h1>
                <button id="btnDownloadVideo" class="bg-primary text-on-primary px-8 py-4 rounded-xl font-label-md font-semibold hover:bg-primary-fixed-dim transition-colors shadow-md flex items-center gap-2">
                    <span class="material-symbols-outlined">download</span> Download Video
                </button>
                <button id="btnBackToDashboard" class="mt-4 text-secondary hover:text-on-surface">Return to Dashboard</button>
            </div>
            
            <!-- GLOBAL WORKFLOW FOOTER -->
            <div id="workflow-footer" class="hidden mt-auto pt-6 border-t border-surface-container flex items-center justify-between px-gutter">
                <button id="btnWorkflowBack" class="text-on-surface-variant font-label-md uppercase tracking-wider hover:text-on-surface transition-colors flex items-center gap-1">
                    <span class="material-symbols-outlined text-[18px]">arrow_back</span> Back
                </button>
                <button id="btnWorkflowNext" class="bg-primary text-on-primary px-6 py-2 rounded-lg font-label-md uppercase tracking-wider font-semibold hover:bg-primary-fixed-dim transition-colors shadow-sm items-center gap-1">
                    Continue <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
            </div>
        </section>
    </main>

    <script src="js/styles-preview.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
"""

# Extract tailwind config
tailwind_config = upload_doc.find('script', id='tailwind-config').string

# Extract header
header_html = str(upload_doc.find('header'))

# Extract contents from main tag
def get_inner_html(doc):
    main = doc.find('main')
    if main:
        return ''.join([str(child) for child in main.contents])
    return ""

html_output = template.replace(
    '{tailwind_config}', str(tailwind_config)
).replace(
    '{header}', header_html
).replace(
    '{upload_transcribe_html}', get_inner_html(upload_doc)
).replace(
    '{style_browser_html}', get_inner_html(style_doc)
).replace(
    '{studio_editor_html}', get_inner_html(editor_doc)
).replace(
    '{workspace_render_html}', get_inner_html(render_doc)
)

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(html_output)

print("Built public/index.html successfully!")
