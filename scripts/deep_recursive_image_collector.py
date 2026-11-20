#!/usr/bin/env python3
"""
Deep Recursive Wayback Machine Image Collector
Collects as many images as possible using both CDX archive queries across all captures
and recursive HTML crawling across pages and subpages, and organizes them cleanly.
"""

import os
import re
import ssl
import sys
import json
import time
import random
import hashlib
import shutil
import argparse
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

# SSL context bypassing verification
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.svg', '.tif', '.tiff')

def safe_makedirs(path):
    os.makedirs(path, exist_ok=True)

def parse_target_input(target_input):
    """
    Parses a Wayback snapshot URL or plain domain.
    Returns (domain, timestamp, start_url)
    """
    wb_match = re.search(r'web\.archive\.org/web/(\d+)(?:[a-z_]+)?/(https?://[^/\s]+|[^/\s]+)(/.*)?', target_input)
    if wb_match:
        ts = wb_match.group(1)
        raw_target = wb_match.group(2)
        path = wb_match.group(3) or '/'
        parsed = urllib.parse.urlparse(raw_target if '://' in raw_target else f"http://{raw_target}")
        domain = parsed.netloc or parsed.path
        start_url = f"http://web.archive.org/web/{ts}id_/http://{domain}{path}"
        return domain, ts, start_url

    clean_dom = re.sub(r'^https?://', '', target_input).split('/')[0]
    return clean_dom, None, f"http://web.archive.org/web/http://{clean_dom}/"

def get_wayback_image_url(original_url, timestamp):
    """Generates direct raw image binary URL using im_ modifier."""
    return f"http://web.archive.org/web/{timestamp}im_/{original_url}"

def fetch_all_cdx_images(domain):
    """
    Queries CDX API to fetch every image ever archived for the domain across all years.
    """
    clean_domain = domain.lower().replace('www.', '')
    cdx_url = (
        f"http://web.archive.org/cdx/search/cdx"
        f"?url={clean_domain}&matchType=domain"
        f"&fl=original,timestamp,mimetype,digest,statuscode"
        f"&filter=statuscode:200"
        f"&output=json"
        f"&limit=5000"
    )
    print(f"[*] Step 1: Querying CDX Archive index for domain '{clean_domain}'...", flush=True)
    images = []
    try:
        req = urllib.request.Request(cdx_url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ctx, timeout=35) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if not data or len(data) <= 1:
                return []
            
            headers = data[0]
            orig_i = headers.index('original')
            ts_i = headers.index('timestamp')
            mime_i = headers.index('mimetype')
            digest_i = headers.index('digest')

            for row in data[1:]:
                orig = row[orig_i]
                mime = row[mime_i].lower()
                parsed = urllib.parse.urlparse(orig)
                path = parsed.path.lower()

                is_img_mime = 'image/' in mime
                is_img_ext = any(path.endswith(ext) for ext in IMAGE_EXTENSIONS)
                
                if 'archive.org' in orig.lower():
                    continue

                if is_img_mime or is_img_ext:
                    images.append({
                        'original': orig,
                        'timestamp': row[ts_i],
                        'mimetype': mime,
                        'digest': row[digest_i],
                        'source': 'CDX_Archive',
                        'download_url': get_wayback_image_url(orig, row[ts_i])
                    })
    except Exception as e:
        print(f"[!] CDX Query issue: {e}", flush=True)

    print(f"[+] Found {len(images)} image records via CDX index.", flush=True)
    return images

def crawl_pages_recursively(start_urls, domain, max_pages=40):
    """
    Crawls snapshot pages recursively to discover images embedded in HTML/CSS.
    """
    print(f"[*] Step 2: Recursively crawling snapshot pages and subpages (limit={max_pages})...", flush=True)
    visited_pages = set()
    queue = list(start_urls)
    discovered_images = []
    seen_img_urls = set()

    clean_domain = domain.lower().replace('www.', '')

    while queue and len(visited_pages) < max_pages:
        current_url = queue.pop(0)
        if current_url in visited_pages:
            continue
        visited_pages.add(current_url)

        try:
            time.sleep(random.uniform(0.1, 0.3))
            req = urllib.request.Request(current_url, headers=HEADERS)
            with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
                html = resp.read().decode('utf-8', errors='ignore')

            img_tags = re.findall(r'<img\b[^>]*src=[\'"]?([^\'"\s>]+)', html, re.I)
            bg_tags = re.findall(r'url\([\'"]?([^\'"\)]+)[\'"]?\)', html, re.I)
            a_imgs = re.findall(r'<a\b[^>]*href=[\'"]?([^\'"\s>]+\.(?:jpg|jpeg|png|gif|bmp|webp))', html, re.I)

            all_page_imgs = set(img_tags + bg_tags + a_imgs)
            for src in all_page_imgs:
                if any(x in src.lower() for x in ['archive.org/static', 'analytics.js', 'wombat.js', 'wayback-toolbar']):
                    continue
                
                full_img_url = urllib.parse.urljoin(current_url, src)
                if 'web.archive.org/web/' in full_img_url:
                    full_img_url = re.sub(r'(/web/\d+)(?:[a-z_]+)?/', r'\1im_/', full_img_url)

                if full_img_url not in seen_img_urls:
                    seen_img_urls.add(full_img_url)
                    discovered_images.append({
                        'original': full_img_url,
                        'timestamp': 'crawled',
                        'mimetype': 'image/detected',
                        'digest': '',
                        'source': 'HTML_Crawl',
                        'download_url': full_img_url
                    })

            links = re.findall(r'<a\b[^>]*href=[\'"]?([^\'"\s>]+)', html, re.I)
            for l in links:
                if l.startswith('#') or l.startswith('javascript:') or l.startswith('mailto:'):
                    continue
                full_link = urllib.parse.urljoin(current_url, l)
                if clean_domain in full_link and 'web.archive.org' in full_link:
                    if not any(full_link.lower().endswith(ext) for ext in IMAGE_EXTENSIONS):
                        if full_link not in visited_pages and full_link not in queue:
                            queue.append(full_link)

        except Exception:
            pass

    print(f"[+] Crawled {len(visited_pages)} pages. Discovered {len(discovered_images)} image references.", flush=True)
    return discovered_images

def download_and_validate(item, temp_dir):
    """
    Downloads raw image, validates magic bytes to ensure it's a real image,
    and returns metadata (success, hash, filename, size, format).
    """
    url = item['download_url']
    original = item.get('original', '')

    parsed = urllib.parse.urlparse(original)
    raw_name = os.path.basename(urllib.parse.unquote(parsed.path))
    if not raw_name or '.' not in raw_name:
        h = hashlib.md5(url.encode()).hexdigest()[:10]
        raw_name = f"image_{h}.jpg"

    clean_name = re.sub(r'[\\/*?:"<>|]', '_', raw_name)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            time.sleep(random.uniform(0.15, 0.35))
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
                data = resp.read()
                if len(data) < 100:
                    return False, None, clean_name, 0, "Empty / too small", item
                
                fmt = "UNKNOWN"
                if data.startswith(b'\xff\xd8\xff'):
                    fmt = "JPEG"
                elif data.startswith(b'\x89PNG\r\n\x1a\n'):
                    fmt = "PNG"
                elif data.startswith(b'GIF87a') or data.startswith(b'GIF89a'):
                    fmt = "GIF"
                elif data.startswith(b'BM'):
                    fmt = "BMP"
                elif data.startswith(b'\x00\x00\x01\x00'):
                    fmt = "ICO"
                elif b'<svg' in data[:200]:
                    fmt = "SVG"
                else:
                    if data.startswith(b'<!DOCTYPE') or data.startswith(b'<html'):
                        return False, None, clean_name, 0, "HTML received instead of image", item

                content_hash = hashlib.sha256(data).hexdigest()
                temp_filename = f"{content_hash[:16]}_{clean_name}"
                temp_path = os.path.join(temp_dir, temp_filename)
                
                if not os.path.exists(temp_path):
                    with open(temp_path, 'wb') as f:
                        f.write(data)

                return True, content_hash, clean_name, len(data), fmt, {
                    'temp_path': temp_path,
                    'original_name': clean_name,
                    'format': fmt,
                    'size': len(data),
                    'hash': content_hash,
                    'source_item': item
                }
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep((attempt + 1) * 3)
            elif e.code == 404:
                return False, None, clean_name, 0, "404 Not Found", item
            else:
                if attempt == max_retries - 1:
                    return False, None, clean_name, 0, f"HTTP {e.code}", item
                time.sleep(1.5)
        except Exception as e:
            if attempt == max_retries - 1:
                return False, None, clean_name, 0, str(e), item
            time.sleep(1.5)

    return False, None, clean_name, 0, "Max retries exceeded", item

def categorize_image(filename, original_url):
    """
    Intelligently categorizes images based on their naming patterns and paths.
    """
    fn = filename.lower()
    path = original_url.lower()

    if (fn.startswith('dsc') or fn.startswith('img') or fn.startswith('photo') or 
        fn.startswith('ana') or 'coskun' in fn or fn.startswith('01.') or 'yaziresim' in path):
        if 'yaziresim' in path and not (fn.startswith('dsc') or 'coskun' in fn):
            return "2_News_and_Articles"
        return "1_Photos_and_Events"

    clean_num = re.sub(r'\.(jpg|jpeg|png|gif)$', '', fn)
    if 'yaziresim' in path or clean_num.isdigit() or fn.startswith('image_'):
        return "2_News_and_Articles"

    if ('logo' in fn or 'banner' in fn or 'sponsor' in fn or 'kamu' in fn or 
        'meslek' in fn or 'mesbil' in fn or 'vitamin' in fn or 'kipa' in fn or 
        'e-mezun' in fn or 'bubenimeserim' in fn or 'yesil_ev' in fn or 'sabiha' in fn or 'widget' in fn):
        return "3_Banners_and_Logos"

    return "4_UI_and_Icons"

def main():
    parser = argparse.ArgumentParser(description="Deep Recursive Wayback Machine Image Collector.")
    parser.add_argument("target", help="Wayback snapshot URL or domain name (e.g. http://www.gaziemir.k12.tr/)")
    parser.add_argument("-o", "--output", default="organized_archive_images", help="Target output folder")
    parser.add_argument("--max-pages", type=int, default=35, help="Maximum subpages to crawl recursively")
    parser.add_argument("--threads", type=int, default=3, help="Concurrent worker threads")
    args = parser.parse_args()

    domain, timestamp, start_url = parse_target_input(args.target)
    final_output_dir = os.path.abspath(args.output)
    temp_dir = os.path.join(os.getcwd(), "temp_download_cache")

    safe_makedirs(temp_dir)
    safe_makedirs(final_output_dir)

    print("=================================================================", flush=True)
    print(" Wayback Machine Deep Recursive Image Collector", flush=True)
    print(f" Target Domain:         {domain}", flush=True)
    print(f" Output Location:       {final_output_dir}", flush=True)
    print("=================================================================", flush=True)

    cdx_images = fetch_all_cdx_images(domain)
    crawled_images = crawl_pages_recursively([start_url], domain, max_pages=args.max_pages)

    all_items = []
    seen_urls = set()

    for item in (cdx_images + crawled_images):
        u = item['download_url']
        if u not in seen_urls:
            seen_urls.add(u)
            all_items.append(item)

    print(f"\n[+] Total combined unique candidate image URLs: {len(all_items)}", flush=True)
    print(f"[*] Starting multi-threaded download & content verification ({args.threads} workers)...", flush=True)

    valid_images = []
    unique_hashes = set()
    failed_count = 0

    with ThreadPoolExecutor(max_workers=args.threads) as executor:
        futures = {executor.submit(download_and_validate, it, temp_dir): it for it in all_items}
        for future in as_completed(futures):
            ok, h, name, size, fmt, meta = future.result()
            if ok:
                if h not in unique_hashes:
                    unique_hashes.add(h)
                    valid_images.append(meta)
                    print(f" [✓] ({len(valid_images)}) Valid {fmt} [{size:,} bytes]: {name}", flush=True)
            else:
                failed_count += 1

    print(f"\n[+] Download & verification complete!")
    print(f"[+] Unique verified images: {len(valid_images)}")
    print(f"[+] Inaccessible / Non-image entries filtered: {failed_count}")

    print(f"\n[*] Step 3: Organizing images into structured folders...", flush=True)
    
    categories = {
        "1_Photos_and_Events": os.path.join(final_output_dir, "1_Photos_and_Events"),
        "2_News_and_Articles": os.path.join(final_output_dir, "2_News_and_Articles"),
        "3_Banners_and_Logos": os.path.join(final_output_dir, "3_Banners_and_Logos"),
        "4_UI_and_Icons": os.path.join(final_output_dir, "4_UI_and_Icons")
    }

    for cat_path in categories.values():
        safe_makedirs(cat_path)

    manifest_records = []

    for img in valid_images:
        orig_name = img['original_name']
        orig_url = img['source_item'].get('original', '')
        cat = categorize_image(orig_name, orig_url)
        target_folder = categories[cat]

        dest_file = os.path.join(target_folder, orig_name)
        c = 1
        b_name, b_ext = os.path.splitext(orig_name)
        while os.path.exists(dest_file):
            if os.path.getsize(dest_file) == img['size']:
                break
            dest_file = os.path.join(target_folder, f"{b_name}_{c}{b_ext}")
            c += 1

        if os.path.exists(img['temp_path']):
            shutil.copy2(img['temp_path'], dest_file)

        manifest_records.append({
            'filename': os.path.basename(dest_file),
            'category': cat,
            'format': img['format'],
            'size_bytes': img['size'],
            'original_url': orig_url,
            'timestamp': img['source_item'].get('timestamp', ''),
            'sha256': img['hash']
        })

    shutil.rmtree(temp_dir, ignore_errors=True)

    manifest_path = os.path.join(final_output_dir, "manifest.json")
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest_records, f, indent=2)

    readme_path = os.path.join(final_output_dir, "README.txt")
    total_bytes = sum(r['size_bytes'] for r in manifest_records)
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write("=================================================================\n")
        f.write(f" WAYBACK MACHINE RECOVERED ARCHIVE IMAGES - {domain}\n")
        f.write("=================================================================\n\n")
        f.write(f"Source: http://{domain}/\n")
        f.write(f"Total Unique Images Recovered: {len(manifest_records)}\n")
        f.write(f"Total Archive Size: {total_bytes / (1024*1024):.2f} MB\n\n")
        f.write("FOLDER ORGANIZATION:\n")
        f.write("--------------------\n")
        f.write("1. [1_Photos_and_Events] : Original event photos, student activities, ceremonies.\n")
        f.write("2. [2_News_and_Articles] : Photos attached to news announcements and articles.\n")
        f.write("3. [3_Banners_and_Logos] : School logos, project banners, sponsor graphics.\n")
        f.write("4. [4_UI_and_Icons]      : Website header graphics, buttons, navigation arrows.\n\n")
        f.write("See 'manifest.json' for full technical metadata (original URLs, hashes, timestamps).\n")

    print("\n=================================================================", flush=True)
    print(f" SUCCESS! All data has been saved to:", flush=True)
    print(f" {final_output_dir}", flush=True)
    print(f" Total Organized Images: {len(manifest_records)} ({total_bytes / (1024*1024):.2f} MB)", flush=True)
    print("=================================================================", flush=True)

if __name__ == "__main__":
    main()
