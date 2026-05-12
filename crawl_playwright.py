import asyncio
from playwright.async_api import async_playwright
import os
import base64

source_dir = '/Users/danchoingoinhinmuaroi/Downloads/backgroundremover-0.4.1/source'
os.makedirs(source_dir, exist_ok=True)

async def run():
    async with async_playwright() as p:
        # Launching with user-agent to look legitimate
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        print("Navigating to https://www.netcarshow.com/abt/ ...")
        try:
            await page.goto("https://www.netcarshow.com/abt/", wait_until="networkidle", timeout=60000)
            print("Page loaded successfully.")
            
            # Extract image URLs
            images = await page.eval_on_selector_all('div.coHm img', 'elements => elements.map(el => el.src)')
            print(f"Found {len(images)} images in the grid.")
            
            count = 0
            for src in images:
                if src and src.endswith(('.jpg', '.png', '.jpeg')):
                    filename = os.path.join(source_dir, os.path.basename(src))
                    print(f"Downloading {src} -> {filename}")
                    try:
                        # Use browser's fetch API to download the image, bypassing any strict Python block
                        image_data_b64 = await page.evaluate(f'''async () => {{
                            const response = await fetch('{src}');
                            const blob = await response.blob();
                            return new Promise((resolve) => {{
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                                reader.readAsDataURL(blob);
                            }});
                        }}''')
                        
                        if image_data_b64:
                            with open(filename, 'wb') as f:
                                f.write(base64.b64decode(image_data_b64))
                            count += 1
                        else:
                            print(f"Empty data for {src}")
                    except Exception as e:
                        print(f"Failed to fetch {src}: {e}")
            
            print(f"Successfully downloaded {count} images to {source_dir}")

        except Exception as e:
            print(f"Error during navigation or extraction: {e}")
            
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
