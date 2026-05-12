import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

url = 'https://www.netcarshow.com/abt/'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
}
print(f"Fetching URL: {url}")
try:
    r = requests.get(url, headers=headers, timeout=10)
    print(f"Status code: {r.status_code}")
except Exception as e:
    print(f"Failed to fetch {url}: {e}")
    exit(1)

soup = BeautifulSoup(r.text, 'html.parser')
source_dir = '/Users/danchoingoinhinmuaroi/Downloads/backgroundremover-0.4.1/source'

os.makedirs(source_dir, exist_ok=True)

count = 0
for img in soup.find_all('img'):
    src = img.get('src')
    if src and src.endswith(('.jpg', '.png', '.jpeg')):
        full_url = urljoin('https://www.netcarshow.com', src)
        filename = os.path.join(source_dir, os.path.basename(full_url))
        print(f"Downloading {full_url} to {filename}")
        try:
            img_data = requests.get(full_url, headers=headers, timeout=10).content
            with open(filename, 'wb') as f:
                f.write(img_data)
            count += 1
        except Exception as e:
            print(f"Failed to download {full_url}: {e}")

print(f"Downloaded {count} images to {source_dir}")
