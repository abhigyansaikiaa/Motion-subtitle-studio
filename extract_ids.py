import re
text = open('design/workspace_render.html', encoding='utf-8').read()
ids = re.findall(r'id=\"([^\"]*)\"', text)
for i in ids: print(i)
