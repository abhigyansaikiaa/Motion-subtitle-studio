text = open('public/js/app.js', encoding='utf-8').read()
for i, line in enumerate(text.split('\n')):
    if 'addEventListener' in line and '$(' in line and not 'if (' in line:
        print(f'{i+1}: {line.strip()}')
