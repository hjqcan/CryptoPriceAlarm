from PIL import Image, ImageDraw
import os

def create_icon(size):
    # 创建图像
    img = Image.new('RGB', (size, size), color='#2196F3')
    draw = ImageDraw.Draw(img)
    
    # 画一个简单的$符号
    margin = size // 4
    draw.line([(size//2, margin), (size//2, size-margin)], fill='white', width=max(1, size//10))
    draw.line([(margin, size//2), (size-margin, size//2)], fill='white', width=max(1, size//10))
    
    # 保存
    if not os.path.exists('images'):
        os.makedirs('images')
    img.save(f'images/icon{size}.png')
    print(f'Created icon{size}.png')

# 生成图标
sizes = [16, 48, 128]
for size in sizes:
    create_icon(size)
print('Done!') 