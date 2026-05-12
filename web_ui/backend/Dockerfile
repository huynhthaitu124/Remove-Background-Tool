# Sử dụng image Python chuẩn và nhẹ
FROM python:3.10-slim

# Thiết lập thư mục làm việc
WORKDIR /app

# Cài đặt các thư viện hệ thống cần thiết cho PyTorch và OpenCV (nếu dùng)
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ffmpeg \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy mã nguồn backgroundremover (thư mục root) vào container
COPY ./backgroundremover /app/backgroundremover
COPY ./setup.py /app/setup.py
COPY ./README.md /app/README.md
COPY ./requirements.txt /app/requirements.txt

# Cài đặt PyTorch bản CPU (nhẹ hơn rất nhiều, tránh lỗi Out of Memory trên Render)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Cài đặt backgroundremover
RUN pip install --no-cache-dir -e .

# Copy Backend Code
COPY ./web_ui/backend /app/backend
WORKDIR /app/backend

# Cài đặt thư viện cho Flask Backend
RUN pip install --no-cache-dir flask flask-cors gunicorn

# Pre-download mô hình AI (u2net) để không bị tải lại mỗi khi restart
RUN mkdir -p ~/.u2net && \
    wget -O ~/.u2net/u2net.pth https://github.com/nadermx/backgroundremover/releases/download/v0.1.0/u2net.pth || true

# Mở cổng 8080
EXPOSE 8080

# Lệnh chạy Production Server bằng Gunicorn
CMD ["gunicorn", "-w", "2", "--timeout", "120", "-b", "0.0.0.0:8080", "app:app"]
