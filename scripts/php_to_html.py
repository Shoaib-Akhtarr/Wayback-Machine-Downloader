import os
import re
import argparse

def convert_php_to_html(target_dir):
    target_dir = os.path.abspath(target_dir)
    print(f"Starting PHP to HTML conversion in: {target_dir}")
    if not os.path.exists(target_dir):
        print(f"Error: Directory '{target_dir}' does not exist.")
        return

    # Phase 1: Find all .php and .htm files and rename them
    files_to_rename = []
    for root, dirs, files in os.walk(target_dir):
        for file in files:
            if file.endswith('.php') or file.endswith('.htm'):
                old_path = os.path.join(root, file)
                # Form new name
                base, ext = os.path.splitext(file)
                new_file = base + '.html'
                new_path = os.path.join(root, new_file)
                files_to_rename.append((old_path, new_path))

    if files_to_rename:
        print(f"Found {len(files_to_rename)} files to rename:")
        for old, new in files_to_rename:
            try:
                # If target file already exists, remove it first to avoid collision
                if os.path.exists(new):
                    os.remove(new)
                os.rename(old, new)
                print(f"  Renamed: {os.path.basename(old)} -> {os.path.basename(new)}")
            except Exception as e:
                print(f"  Error renaming {os.path.basename(old)}: {e}")
    else:
        print("No .php or .htm files found to rename.")

    # Phase 2: Update link references in HTML, CSS, and JS files
    updated_files_count = 0
    # Match links containing .php or .htm (with word boundaries or attribute boundaries)
    # Match things like "href=index.php", "src='contact.php'", or urls in JS/CSS
    # E.g. href="index.php" or href="/page.php" or url('style.htm')
    php_ref_pattern = re.compile(r'([\b"\'/])([^"\'\s>#]+\.php)([\b"\'?#])', re.IGNORECASE)
    htm_ref_pattern = re.compile(r'([\b"\'/])([^"\'\s>#]+\.htm)([\b"\'?#])', re.IGNORECASE)

    for root, dirs, files in os.walk(target_dir):
        for file in files:
            if file.endswith(('.html', '.htm', '.css', '.js')):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()

                    new_content = content
                    changes_made = False

                    # Replace .php references
                    # e.g., index.php -> index.html
                    def php_replacer(match):
                        nonlocal changes_made
                        prefix = match.group(1)
                        filename = match.group(2)
                        suffix = match.group(3)
                        
                        new_filename = filename[:-4] + '.html'
                        changes_made = True
                        return f"{prefix}{new_filename}{suffix}"

                    new_content = php_ref_pattern.sub(php_replacer, new_content)

                    # Replace .htm references
                    # e.g., page.htm -> page.html
                    def htm_replacer(match):
                        nonlocal changes_made
                        prefix = match.group(1)
                        filename = match.group(2)
                        suffix = match.group(3)
                        
                        new_filename = filename[:-4] + '.html'
                        changes_made = True
                        return f"{prefix}{new_filename}{suffix}"

                    new_content = htm_ref_pattern.sub(htm_replacer, new_content)

                    if changes_made:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        updated_files_count += 1
                        print(f"  Updated references in: {os.path.relpath(filepath, target_dir)}")

                except Exception as e:
                    print(f"  Error updating references in {file}: {e}")

    print(f"\nConversion complete! Updated references in {updated_files_count} files.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Standalone PHP/HTM to HTML converter and link updater")
    parser.add_argument("-d", "--dir", default="extracted_site", help="Target directory to convert (default: extracted_site)")
    args = parser.parse_args()
    convert_php_to_html(args.dir)
