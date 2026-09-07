import urllib.request
import json
import sys

API_KEY = "AQ.Ab8RN6Irb4VM5oUDUaxpLqK2vFZj2LKusxPJx2Q4QKGNUnfi9g"
PROJECT_ID = "5669522129904894277"

SCREENS = {
    "style_browser": "000d85c0e9c042f2a7a0b1cf05593c8d",
    "creative_video_producer_image": "145f5e7cf900467eaf95c9ac92acc1c0",
    "workspace_render": "37b3a4ac82a04a7e8485b76288b30fa1",
    "studio_editor": "42f3f68689fa40dd98187c9dc6bf2b46",
    "upload_transcribe": "4e4f4ef04e874a3d92db30b7f0443cc2",
    "brand_logo": "9647146894144e30ae5b8666aece4a63",
    "design_system": "asset-stub-assets_e78e10be154d4d66874899d306e15097"
}

def fetch_json(url):
    req = urllib.request.Request(url, headers={'X-Goog-Api-Key': API_KEY})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))

def download_file(url, output_path):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response, open(output_path, 'wb') as out_file:
        out_file.write(response.read())

for name, screen_id in SCREENS.items():
    print(f"Processing {name} ({screen_id})...")
    try:
        url = f"https://stitch.googleapis.com/v1/projects/{PROJECT_ID}/screens/{screen_id}"
        data = fetch_json(url)
        
        # Determine what it is
        # Is it a screen with HTML?
        if 'htmlCode' in data and 'downloadUrl' in data['htmlCode']:
            download_url = data['htmlCode']['downloadUrl']
            output_path = f"design/{name}.html"
            download_file(download_url, output_path)
            print(f"Downloaded HTML to {output_path}")
            
        # Is it an image?
        if 'screenshot' in data and 'downloadUrl' in data['screenshot']:
            download_url = data['screenshot']['downloadUrl']
            output_path = f"design/{name}.jpg"
            download_file(download_url, output_path)
            print(f"Downloaded image to {output_path}")
            
        with open(f"design/{name}.json", "w") as f:
            json.dump(data, f)
            print(f"Saved JSON metadata to design/{name}.json")
            
    except Exception as e:
        print(f"Failed processing {name}: {e}")

print("Done.")
