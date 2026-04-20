import os
import re
import hashlib

public_dir = "public"
svg_dir = os.path.join(public_dir, "svg")

if not os.path.exists(svg_dir):
    os.makedirs(svg_dir)

# Regex to capture the whole SVG including optional XML declarations or comments
svg_pattern = re.compile(r'(?:<\?xml[\s\S]*?\?>\s*)?(?:<!DOCTYPE[\s\S]*?>\s*)?(?:<!--[\s\S]*?-->\s*)?<svg\b([^>]*)>[\s\S]*?</svg>', re.IGNORECASE)
class_pattern = re.compile(r'class="([^"]*)"', re.IGNORECASE)

def process_html_file(filepath):
    print(f"Processing {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    def replace_svg(match):
        full_match = match.group(0)
        svg_attrs = match.group(1)
        
        # Get class to apply to img
        class_match = class_pattern.search(svg_attrs)
        img_class = f' class="{class_match.group(1)}"' if class_match else ''
        
        # Hash to find duplicates and generate unique name
        svg_hash = hashlib.md5(full_match.encode('utf-8')).hexdigest()[:8]
        svg_filename = f"icon_{svg_hash}.svg"
        svg_filepath = os.path.join(svg_dir, svg_filename)
        
        if not os.path.exists(svg_filepath):
            with open(svg_filepath, 'w', encoding='utf-8') as svg_file:
                # Ensure xmlns exists for img rendering
                svg_content = full_match
                if 'xmlns=' not in svg_content:
                    svg_content = svg_content.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
                svg_file.write(svg_content)
        
        return f'<img src="./svg/{svg_filename}"{img_class} alt="icon" />'

    new_content = svg_pattern.sub(replace_svg, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for filename in os.listdir(public_dir):
    if filename.endswith(".html"):
        process_html_file(os.path.join(public_dir, filename))
