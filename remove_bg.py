import os
import subprocess

source_dir = '/Users/danchoingoinhinmuaroi/Downloads/backgroundremover-0.4.1/source'
output_dir = '/Users/danchoingoinhinmuaroi/Downloads/backgroundremover-0.4.1/output'

os.makedirs(output_dir, exist_ok=True)

if not os.path.exists(source_dir):
    print(f"Source directory {source_dir} does not exist.")
    exit(1)

images = [f for f in os.listdir(source_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

if not images:
    print(f"No images found in {source_dir}")
    exit(1)

print(f"Found {len(images)} images to process.")

for img in images:
    input_path = os.path.join(source_dir, img)
    output_path = os.path.join(output_dir, f"no_bg_{img}")
    
    # backgroundremover -i "input.jpg" -o "output.png"
    # Ensure output is always .png as it requires alpha channel for transparency
    output_path = os.path.splitext(output_path)[0] + '.png'
    
    cmd = ['backgroundremover', '-i', input_path, '-o', output_path]
    print(f"Running: {' '.join(cmd)}")
    try:
        subprocess.run(cmd, check=True)
        print(f"Successfully processed {img}")
    except subprocess.CalledProcessError as e:
        print(f"Error processing {img}: {e}")

print("Batch processing complete.")
