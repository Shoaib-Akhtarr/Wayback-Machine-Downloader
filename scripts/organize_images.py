#!/usr/bin/env python3
"""
Wayback Machine Image Organizer
Scans a folder of downloaded archive images, validates binary magic bytes,
deduplicates via SHA-256, and organizes them into structured categories with manifest.json.
"""

import os
import re
import json
import shutil
import hashlib
import argparse

def get_format(data):
    if data.startswith(b'\xff\xd8\xff'):
        return "JPEG"
    elif data.startswith(b'\x89PNG\r\n\x1a\n'):
        return "PNG"
    elif data.startswith(b'GIF87a') or data.startswith(b'GIF89a'):
        return "GIF"
    elif data.startswith(b'BM'):
        return "BMP"
    elif data.startswith(b'\x00\x00\x01\x00'):
        return "ICO"
    return "UNKNOWN"

def categorize(filename):
    fn = filename.lower()
    
    if (fn.startswith('dsc') or fn.startswith('img') or fn.startswith('photo') or 
        fn.startswith('ana') or 'coskun' in fn or fn == '01.jpg'):
        return "1_Photos_and_Events"
        
    clean_num = re.sub(r'\.(jpg|jpeg|png|gif)$', '', fn)
    if clean_num.isdigit() or fn.startswith('image_'):
        return "2_News_and_Articles"

    if ('logo' in fn or 'banner' in fn or 'sponsor' in fn or 'kamu' in fn or 
        'meslek' in fn or 'mesbil' in fn or 'vitamin' in fn or 'kipa' in fn or 
        'e-mezun' in fn or 'bubenimeserim' in fn or 'yesil_ev' in fn or 'sabiha' in fn or 'widget' in fn):
        return "3_Banners_and_Logos"

    return "4_UI_and_Icons"

def main():
    parser = argparse.ArgumentParser(description="Organize downloaded archive images into structured categories.")
    parser.add_argument("-i", "--input", default="downloaded_images", help="Folder containing raw downloaded images")
    parser.add_argument("-o", "--output", default="organized_images", help="Destination folder for categorized images")
    args = parser.parse_args()

    input_dir = os.path.abspath(args.input)
    output_dir = os.path.abspath(args.output)

    if not os.path.exists(input_dir):
        print(f"[!] Input directory '{input_dir}' does not exist.")
        return

    raw_files = [f for f in os.listdir(input_dir) if os.path.isfile(os.path.join(input_dir, f))]
    print(f"[*] Found {len(raw_files)} files in '{input_dir}'. Validating...")

    seen_hashes = set()
    unique_items = []

    for fname in raw_files:
        fpath = os.path.join(input_dir, fname)
        if os.path.getsize(fpath) < 100:
            continue
        try:
            with open(fpath, 'rb') as f:
                data = f.read()
            fmt = get_format(data)
            if fmt == "UNKNOWN":
                continue
            
            h = hashlib.sha256(data).hexdigest()
            if h in seen_hashes:
                continue
            seen_hashes.add(h)

            unique_items.append({
                'source_path': fpath,
                'filename': fname,
                'format': fmt,
                'size': len(data),
                'hash': h
            })
        except Exception as e:
            print(f"[!] Error reading {fname}: {e}")

    subfolders = [
        "1_Photos_and_Events",
        "2_News_and_Articles",
        "3_Banners_and_Logos",
        "4_UI_and_Icons"
    ]

    os.makedirs(output_dir, exist_ok=True)
    for sub in subfolders:
        os.makedirs(os.path.join(output_dir, sub), exist_ok=True)

    manifest = []
    counts = {sub: 0 for sub in subfolders}

    for item in unique_items:
        cat = categorize(item['filename'])
        counts[cat] += 1
        
        dest_cat_dir = os.path.join(output_dir, cat)
        dest_file = os.path.join(dest_cat_dir, item['filename'])
        
        c = 1
        b_name, b_ext = os.path.splitext(item['filename'])
        while os.path.exists(dest_file):
            if os.path.getsize(dest_file) == item['size']:
                break
            dest_file = os.path.join(dest_cat_dir, f"{b_name}_{c}{b_ext}")
            c += 1

        shutil.copy2(item['source_path'], dest_file)

        manifest.append({
            'filename': item['filename'],
            'category': cat,
            'format': item['format'],
            'size_bytes': item['size'],
            'sha256': item['hash']
        })

    total_size_mb = sum(it['size'] for it in unique_items) / (1024 * 1024)

    with open(os.path.join(output_dir, "manifest.json"), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    with open(os.path.join(output_dir, "README.txt"), 'w', encoding='utf-8') as f:
        f.write("=================================================================\n")
        f.write(" WAYBACK MACHINE RECOVERED ARCHIVE IMAGES\n")
        f.write("=================================================================\n\n")
        f.write(f"Total Unique Images Recovered: {len(unique_items)}\n")
        f.write(f"Total Archive Size: {total_size_mb:.2f} MB\n\n")
        f.write("ORGANIZED DIRECTORIES:\n")
        f.write("---------------------\n")
        for sub in subfolders:
            f.write(f" - {sub} ({counts[sub]} images)\n")
        f.write("\nSee 'manifest.json' for full technical metadata (formats, hashes, sizes).\n")

    print(f"\n[+] Successfully organized {len(unique_items)} images ({total_size_mb:.2f} MB) into '{output_dir}'.")

if __name__ == "__main__":
    main()
