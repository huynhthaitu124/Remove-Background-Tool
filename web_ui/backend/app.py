import os
import sys
import tempfile
import zipfile
import io
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# Add parent directory to path so we can import backgroundremover
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backgroundremover.bg import remove

app = Flask(__name__)
CORS(app) # Cho phép Vercel gọi API chéo domain

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "Background Remover API is running"})

@app.route('/api/process-single', methods=['POST'])
def process_single():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
        
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400
        
    try:
        # Read raw bytes
        input_data = file.read()
        
        # Get options
        model = request.form.get('model', 'u2net')
        alpha_matting = request.form.get('alpha_matting', 'false').lower() == 'true'
        mask_threshold_str = request.form.get('mask_threshold', '')
        mask_threshold = int(mask_threshold_str) if mask_threshold_str else None
        
        # Process image
        output_data = remove(
            input_data,
            model_name=model,
            alpha_matting=alpha_matting,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_structure_size=10,
            alpha_matting_base_size=1000,
            mask_threshold=mask_threshold
        )
        
        # Determine output filename
        # Ensure it keeps the exact same name but .png
        base_name = os.path.splitext(file.filename)[0]
        output_filename = f"{base_name}.png"
        
        return send_file(
            io.BytesIO(output_data),
            mimetype='image/png',
            as_attachment=True,
            download_name=output_filename
        )
        
    except Exception as e:
        print(f"Error processing single image: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/process-batch', methods=['POST'])
def process_batch():
    if 'images' not in request.files:
        return jsonify({'error': 'No images provided'}), 400
        
    files = request.files.getlist('images')
    model = request.form.get('model', 'u2net')
    alpha_matting = request.form.get('alpha_matting', 'false').lower() == 'true'
    mask_threshold_str = request.form.get('mask_threshold', '')
    mask_threshold = int(mask_threshold_str) if mask_threshold_str else None
    
    memory_file = io.BytesIO()
    
    try:
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file in files:
                if file.filename == '':
                    continue
                
                input_data = file.read()
                
                # Process image
                output_data = remove(
                    input_data,
                    model_name=model,
                    alpha_matting=alpha_matting,
                    alpha_matting_foreground_threshold=240,
                    alpha_matting_background_threshold=10,
                    alpha_matting_erode_structure_size=10,
                    alpha_matting_base_size=1000,
                    mask_threshold=mask_threshold
                )
                
                # Determine output filename
                base_name = os.path.splitext(file.filename)[0]
                output_filename = f"{base_name}.png"
                
                zf.writestr(output_filename, output_data)
                
        memory_file.seek(0)
        return send_file(
            memory_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name='processed_images.zip'
        )
        
    except Exception as e:
        print(f"Error processing batch images: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
