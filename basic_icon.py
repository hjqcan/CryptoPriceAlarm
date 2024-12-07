from PIL import Image
import os

# 确保images目录存在
if not os.path.exists('images'):
    os.makedirs('images')

# 创建纯色图标
def create_basic_icon(size):
    # 创建一个蓝色背景的图像
    image = Image.new('RGB', (size, size), '#2196F3')
    
    # 保存图像
    image.save(f'images/icon{size}.png')
    print(f'Created icon{size}.png')

# 生成三种尺寸的图标
for size in [16, 48, 128]:
    create_basic_icon(size)
print('All icons created successfully!') 