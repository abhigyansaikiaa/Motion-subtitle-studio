text = open('public/js/app.js', encoding='utf-8').read()

import re
lines = text.split('\n')
for i, line in enumerate(lines):
    match = re.search(r'\$\(\'#([a-zA-Z0-9_-]+)\'\)\.addEventListener\((.*)', line)
    if match and not 'if (' in line:
        id_name = match.group(1)
        # We only want to wrap specific ones that are missing
        if id_name in ['mode-switch-btn', 'toggle-pwd-btn', 'btnAccount', 'btnContinueToCompose', 'btnContinueToEdit', 'btnChangeStyle', 'btnToggleAdvancedEdit', 'btnBackToDashboard']:
            lines[i] = f"if ($('#{id_name}')) {{ $('#{id_name}').addEventListener({match.group(2)} "
            # Find the closing brace for this addEventListener
            # Simple assumption: it's on a line starting with `});` at the same indentation, but this is risky
            # Let's just do a regex replace for the whole file for these specific blocks
            pass

# Since doing this by lines is risky, let's use regex
# But the safer way is to just use multi_replace_file_content!
