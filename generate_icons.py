from PIL import Image, ImageDraw
import os

def create_icon(size):
    # 创建一个新的RGBA图像，背景为透明
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # 计算圆形的边界框
    padding = 1  # 留一个像素的边距
    circle_bbox = [padding, padding, size - padding, size - padding]
    
    # 绘制实心圆形，使用蓝色
    draw.ellipse(circle_bbox, fill='#2196F3')
    
    # 绘制美元符号（使用简单的线条）
    line_color = 'white'
    center_x = size // 2
    center_y = size // 2
    line_width = max(1, size // 8)  # 确保线宽至少为1像素
    
    # 垂直线
    draw.line([(center_x, padding * 2), (center_x, size - padding * 2)], 
              fill=line_color, width=line_width)
    
    # 上方的横线
    draw.line([(center_x - size//4, center_y - size//4), 
               (center_x + size//4, center_y - size//4)], 
              fill=line_color, width=line_width)
    
    # 下方的横线
    draw.line([(center_x - size//4, center_y + size//4), 
               (center_x + size//4, center_y + size//4)], 
              fill=line_color, width=line_width)
    
    # 确保images目录存在
    if not os.path.exists('images'):
        os.makedirs('images')
    
    # 保存图像
    output_path = f'images/icon{size}.png'
    image.save(output_path)
    print(f'已生成图标: {output_path}')

# 生成三种尺寸的图标
for size in [16, 48, 128]:
    create_icon(size)
print('所有图标生成完成！') 