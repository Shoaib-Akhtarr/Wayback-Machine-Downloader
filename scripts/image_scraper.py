#!/usr/bin/env python3
"""
Wayback Machine Image Scraper & Bulk Downloader
Allows downloading all archived images from Wayback Machine for any URL or domain.
Includes rate-limit handling, automatic retry with backoff, and CDX discovery.
"""

import os
import re
import ssl
import sys
import json
import time
import random
import hashlib
import argparse
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

# Disable SSL verification for maximum compatibility across proxies / CDNs
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def clean_url_info(target_input):
    """
    Extracts the domain and timestamp from a Wayback URL or normal URL.
    Example: https://web.archive.org/web/20120112041118/http://www.gaziemir.k12.tr/
    Returns: ('gaziemir.k12.tr', '20120112041118', 'http://www.gaziemir.k12.tr/')
    """
    wb_match = re.search(r'web\.archive\.org/web/(\d+)(?:[a-z_]+)?/(https?://[^/\s]+|[^/\s]+)(/.*)?', target_input)
    if wb_match:
        ts = wb_match.group(1)
        raw_target = wb_match.group(2)
        path = wb_match.group(3) or '/'
        parsed = urllib.parse.urlparse(raw_target if '://' in raw_target else f"http://{raw_target}")
        domain = parsed.netloc or parsed.path
        original_url = f"http://{domain}{path}"
        return domain, ts, original_url

    parsed = urllib.parse.urlparse(target_input if '://' in target_input else f"http://{target_input}")
    domain = parsed.netloc or parsed.path
    return domain, None, target_input

def get_images_via_cdx(domain, year=None, collapse_by='digest', limit=1000):
    """
    Queries Wayback Machine's CDX Server API.
    Fetches image assets archived for the domain across all captures.
    """
    clean_domain = domain.lower().replace('www.', '')
    cdx_url = (
        f"http://web.archive.org/cdx/search/cdx"
        f"?url={clean_domain}&matchType=domain"
        f"&fl=original,timestamp,mimetype,digest,statuscode"
        f"&filter=mimetype:image/.*"
        f"&filter=statuscode:200"
        f"&output=json"
        f"&limit={limit}"
    )
    if collapse_by:
        cdx_url += f"&collapse={collapse_by}"
    if year:
        cdx_url += f"&from={year}&to={year}"

    print(f"[*] Querying CDX API for images across {domain}...", flush=True)
    try:
        req = urllib.request.Request(cdx_url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if not data or len(data) <= 1:
                return []
            
            headers = data[0]
            orig_idx = headers.index('original')
            ts_idx = headers.index('timestamp')
            mime_idx = headers.index('mimetype')
            digest_idx = headers.index('digest')
            
            results = []
            for row in data[1:]:
                orig = row[orig_idx]
                ts = row[ts_idx]
                results.append({
                    'original': orig,
                    'timestamp': ts,
                    'mimetype': row[mime_idx],
                    'digest': row[digest_idx],
                    'download_url': f"https://web.archive.org/web/{ts}im_/{orig}"
                })
            return results
    except Exception as e:
        print(f"[!] CDX Query error: {e}", flush=True)
        return []

def get_images_from_html(snapshot_url):
    """
    Scrapes images directly referenced inside a specific snapshot page.
    """
    print(f"[*] Fetching snapshot page: {snapshot_url}", flush=True)
    images = set()
    try:
        req = urllib.request.Request(snapshot_url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            html = resp.read().decode('utf-8', errors='ignore')

        img_srcs = re.findall(r'<img\b[^>]*src=[\'"]?([^\'"\s>]+)', html, re.I)
        bg_srcs = re.findall(r'url\([\'"]?([^\'"\)]+)[\'"]?\)', html, re.I)

        for src in (img_srcs + bg_srcs):
            if any(x in src.lower() for x in ['archive.org/static', 'analytics.js', 'wombat.js']):
                continue
            full_url = urllib.parse.urljoin(snapshot_url, src)
            if 'web.archive.org/web/' in full_url:
                full_url = re.sub(r'(/web/\d+)(?:[a-z_]+)?/', r'\1im_/', full_url)
            images.add(full_url)
    except Exception as e:
        print(f"[!] Error fetching page HTML: {e}", flush=True)

    return list(images)

def download_image_file(item, output_dir, max_retries=4):
    """
    Downloads raw image binary with rate-limit handling & backoff.
    """
    if isinstance(item, dict):
        url = item['download_url']
        original = item.get('original', '')
    else:
        url = item
        original = item

    # Parse filename from original URL
    parsed = urllib.parse.urlparse(original)
    filename = os.path.basename(urllib.parse.unquote(parsed.path))
    if not filename or '.' not in filename:
        h = hashlib.md5(url.encode()).hexdigest()[:10]
        filename = f"image_{h}.jpg"

    # Clean filename
    filename = re.sub(r'[\\/*?:"<>|]', '_', filename)
    target_path = os.path.join(output_dir, filename)

    # Avoid duplicate name overwrites
    base, ext = os.path.splitext(filename)
    counter = 1
    while os.path.exists(target_path):
        # If file already downloaded and not empty, skip re-download
        if os.path.getsize(target_path) > 100:
            return True, os.path.basename(target_path), os.path.getsize(target_path)
        target_path = os.path.join(output_dir, f"{base}_{counter}{ext}")
        counter += 1

    for attempt in range(max_retries):
        try:
            # Polite jitter to avoid triggering 429
            time.sleep(random.uniform(0.1, 0.4))

            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
                data = resp.read()
                if len(data) < 100:
                    return False, filename, "File too small or 0 bytes"
                if data.startswith(b'<!DOCTYPE') or data.startswith(b'<html'):
                    return False, filename, "Received HTML instead of image"
                
                with open(target_path, 'wb') as f:
                    f.write(data)
                return True, os.path.basename(target_path), len(data)

        except urllib.error.HTTPError as e:
            if e.code == 429: # Rate limited
                wait = (attempt + 1) * 3 + random.uniform(0.5, 1.5)
                # print(f" [Rate limit 429 on {filename}, waiting {wait:.1f}s...]", flush=True)
                time.sleep(wait)
            elif e.code == 404:
                return False, filename, "404 Not Found"
            else:
                if attempt == max_retries - 1:
                    return False, filename, f"HTTP Error {e.code}"
                time.sleep(2)
        except Exception as e:
            if attempt == max_retries - 1:
                return False, filename, str(e)
            time.sleep(1.5)

    return False, filename, "Max retries exceeded"

def main():
    parser = argparse.ArgumentParser(description="Download only images from Wayback Machine.")
    parser.add_argument("target", help="Wayback snapshot URL or domain name (e.g. https://web.archive.org/web/20120112041118/http://www.gaziemir.k12.tr/)")
    parser.add_argument("-o", "--output", default="downloaded_images", help="Target output folder for images")
    parser.add_argument("--year", help="Filter CDX by specific year (e.g. 2012)")
    parser.add_argument("--all-captures", action="store_true", help="Download every historical capture without collapsing duplicates")
    parser.add_argument("--page-only", action="store_true", help="Only download images directly referenced on this single snapshot page")
    parser.add_argument("--threads", type=int, default=3, help="Number of concurrent download threads (default: 3)")

    args = parser.parse_args()
    domain, timestamp, original_url = clean_url_info(args.target)

    print("===================================================", flush=True)
    print(f" Wayback Machine Image Downloader", flush=True)
    print(f" Target Domain:    {domain}", flush=True)
    if timestamp:
        print(f" Snapshot Time:    {timestamp}", flush=True)
    print(f" Output Folder:    {args.output}", flush=True)
    print("===================================================", flush=True)

    os.makedirs(args.output, exist_ok=True)
    image_items = []
    seen = set()

    # Strategy 1: Page Scraper
    if args.page_only or (timestamp and not args.year and not args.all_captures):
        page_url = args.target if 'web.archive.org' in args.target else f"https://web.archive.org/web/{timestamp or ''}/http://{domain}/"
        page_imgs = get_images_from_html(page_url)
        print(f"[+] Found {len(page_imgs)} images on the specific snapshot page.", flush=True)
        for u in page_imgs:
            if u not in seen:
                seen.add(u)
                image_items.append({'download_url': u, 'original': u})

    # Strategy 2: CDX Archive (to pick more and more images!)
    if not args.page_only:
        collapse = None if args.all_captures else 'digest'
        cdx_imgs = get_images_via_cdx(domain, year=args.year, collapse_by=collapse)
        print(f"[+] Found {len(cdx_imgs)} archived image files across all Wayback captures.", flush=True)
        for item in cdx_imgs:
            u = item['download_url']
            if u not in seen:
                seen.add(u)
                image_items.append(item)

    print(f"\n[+] Total unique images to download: {len(image_items)}", flush=True)
    if not image_items:
        print("[!] No images found.", flush=True)
        return

    print(f"[*] Downloading images using {args.threads} worker threads (with automatic retry)...\n", flush=True)
    success_count = 0
    fail_count = 0

    with ThreadPoolExecutor(max_workers=args.threads) as executor:
        future_map = {executor.submit(download_image_file, item, args.output): item for item in image_items}
        for future in as_completed(future_map):
            ok, name, info = future.result()
            if ok:
                success_count += 1
                print(f"[✓] ({success_count}/{len(image_items)}) {name} ({info:,} bytes)", flush=True)
            else:
                fail_count += 1
                print(f"[x] Failed: {name} - {info}", flush=True)

    print("\n===================================================", flush=True)
    print(f" Download Complete!", flush=True)
    print(f" Successfully saved: {success_count} images in '{args.output}'", flush=True)
    if fail_count > 0:
        print(f" Skipped / Inaccessible: {fail_count}", flush=True)
    print("===================================================", flush=True)

if __name__ == "__main__":
    main()
