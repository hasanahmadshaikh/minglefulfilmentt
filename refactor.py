import os
import re

def refactor_html(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace Header
    header_pattern = re.compile(r'<!-- Header -->\s*<header class="header">.*?</header>', re.DOTALL)
    if header_pattern.search(content):
        content = header_pattern.sub('<!-- Header -->\n  <app-header></app-header>', content)
    else:
        # Fallback if no <!-- Header --> comment
        header_pattern = re.compile(r'<header class="header">.*?</header>', re.DOTALL)
        content = header_pattern.sub('<app-header></app-header>', content)

    # Replace Footer
    footer_pattern = re.compile(r'<!-- Footer -->\s*<footer class="footer">.*?</footer>', re.DOTALL)
    if footer_pattern.search(content):
        content = footer_pattern.sub('<!-- Footer -->\n  <app-footer></app-footer>', content)
    else:
        footer_pattern = re.compile(r'<footer class="footer">.*?</footer>', re.DOTALL)
        content = footer_pattern.sub('<app-footer></app-footer>', content)

    # Remove the inline script for menu toggle
    script_pattern = re.compile(r'<script>\s*const menuToggle = document\.createElement.*?navLinks\.classList\.toggle\(\'show\'\);\s*}\);\s*(?:/\*.*?\*/\s*)?</script>', re.DOTALL)
    content = script_pattern.sub('', content)

    # Add components.js script before </body>
    if '<script src="./js/components.js"></script>' not in content:
        content = content.replace('</body>', '  <script src="./js/components.js"></script>\n</body>')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Refactored {file_path}")

for file in os.listdir('.'):
    if file.endswith('.html'):
        refactor_html(file)
