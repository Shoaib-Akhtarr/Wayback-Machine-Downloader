import os
import re
import sys
import ssl
import urllib.request
import urllib.parse
from html.parser import HTMLParser

print(f"Executing script path: {__file__}")
print(f"sys.path: {sys.path}")

# Disable SSL verification for maximum compatibility
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

import argparse

# Global Variables (will be overwritten by command-line arguments)
TARGET_HOST = ""
ALT_HOST = ""
TIMESTAMP = ""
START_URL = ""
OUTPUT_DIR = ""
CLOSEST_SNAPSHOTS_FILE = None

# Tracking sets
visited_urls = set()
downloaded_files = {} # Maps original relative path to local file path
missing_assets = []   # Logs 404s or failed downloads

# Headers to impersonate browser
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def clean_wayback_injections(html_content):
    """
    Strips Wayback Machine injected scripts, styles, toolbars, and comments.
    """
    # Remove Wayback toolbar comment block if present
    html_content = re.sub(r'<!-- BEGIN WAYBACK TOOLBAR INSERT -->.*?<!-- END WAYBACK TOOLBAR INSERT -->', '', html_content, flags=re.DOTALL)
    
    # Remove script tags that reference web.archive.org, __wm, archive.org, wombat, or playback.js
    pattern = re.compile(r'<script\b[^>]*>(.*?)</script>', re.DOTALL | re.IGNORECASE)
    def script_replacer(match):
        script_text = match.group(1)
        if any(x in script_text for x in ['__wm', 'archive.org', 'playback.js', 'wombat']):
            return '<!-- Stripped Wayback Injected Script -->'
        return match.group(0)
    
    html_content = pattern.sub(script_replacer, html_content)
    
    # Remove script tags with src pointing to archive.org, containing __wm, playback.js, wombat.js, or _static
    src_pattern = re.compile(r'<script\b[^>]*src=["\']([^"\']*)["\'][^>]*>(.*?)</script>', re.DOTALL | re.IGNORECASE)
    def src_script_replacer(match):
        src = match.group(1)
        if any(x in src.lower() for x in ['archive.org', '__wm', 'playback.js', 'wombat', '_static']):
            return '<!-- Stripped Wayback External Script -->'
        return match.group(0)
    
    html_content = src_pattern.sub(src_script_replacer, html_content)
    
    # Remove injected stylesheet links referencing archive.org or _static
    link_pattern = re.compile(r'<link\b[^>]*href=["\']([^"\']*)["\'][^>]*>', re.IGNORECASE)
    def link_replacer(match):
        href = match.group(1)
        if 'archive.org' in href or '_static' in href:
            return '<!-- Stripped Wayback Style Link -->'
        return match.group(0)
    
    html_content = link_pattern.sub(link_replacer, html_content)

    # Remove any Wayback Machine iframe or banner div structures (e.g. wm-ipp)
    html_content = re.sub(r'<div\s+id=["\']wm-ipp[^>]*>.*?</div>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    
    return html_content

def get_wayback_url(original_url, timestamp=TIMESTAMP):
    """
    Converts a standard URL to a Wayback Machine URL with the id_ modifier.
    Handles encoding of spaces and control characters in paths.
    Uses HTTP to bypass SSL port 443 rate limits.
    """
    parsed = urllib.parse.urlparse(original_url)
    quoted_path = urllib.parse.quote(parsed.path, safe='/')
    clean_url = f"http://{TARGET_HOST}{quoted_path}"
    if parsed.query:
        clean_url += f"?{parsed.query}"
    
    final_url = f"http://web.archive.org/web/{timestamp}id_/{clean_url}"
    return final_url.replace(" ", "%20")

def safe_makedirs(path):
    if not path:
        return
    path = os.path.normpath(path)
    parts = path.split(os.sep)
    curr_path = ""
    if parts[0].endswith(':'):
        curr_path = parts[0] + os.sep
        parts = parts[1:]
    for part in parts:
        if not part:
            continue
        curr_path = os.path.join(curr_path, part)
        if not os.path.exists(curr_path):
            try:
                os.mkdir(curr_path)
            except FileExistsError:
                pass
            except OSError as e:
                if hasattr(e, 'winerror') and e.winerror in [183, 3] or 'already exists' in str(e):
                    pass
                else:
                    raise e

import time

def download_asset(url, local_path):
    """
    Downloads an asset from the given URL and saves it to local_path.
    Follows redirects and returns the final content and redirect url if it succeeded.
    Includes up to 3 retries for connection/transient errors.
    """
    dir_name = os.path.dirname(local_path)
    if dir_name:
        try:
            safe_makedirs(dir_name)
        except Exception as e:
            print(f"Failed to create directory {dir_name}: {e}")
            raise e

    max_retries = 3
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=ctx, timeout=15) as response:
                final_url = response.geturl()
                content = response.read()
                
                with open(local_path, "wb") as f:
                    f.write(content)
                return content, final_url
        except Exception as e:
            # Check if this is a 404
            is_404 = False
            if hasattr(e, 'code') and e.code == 404:
                is_404 = True
                
            if is_404 or attempt == max_retries - 1:
                print(f"Failed to download {url}: {e}")
                missing_assets.append({"url": url, "path": local_path, "error": str(e)})
                return None, None
                
            sleep_time = (attempt + 1) * 2.0
            print(f"Error downloading {url}: {e}. Retrying in {sleep_time} seconds (attempt {attempt+1}/{max_retries})...")
            time.sleep(sleep_time)

class LinkExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.assets = []
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        
        # Hyperlinks
        if tag == 'a' and 'href' in attrs_dict:
            self.links.append(attrs_dict['href'])
            
        # Images
        if tag == 'img' and 'src' in attrs_dict:
            self.assets.append(attrs_dict['src'])
            
        # Stylesheets & Favicon
        if tag == 'link' and 'href' in attrs_dict:
            self.assets.append(attrs_dict['href'])
            
        # Scripts
        if tag == 'script' and 'src' in attrs_dict:
            self.assets.append(attrs_dict['src'])

        # Iframes
        if tag == 'iframe' and 'src' in attrs_dict:
            self.links.append(attrs_dict['src'])

def normalize_link_path(current_page_dir, target_link):
    """
    Translates a link to a relative file path on disk.
    E.g. If current page is "exhibits/exhibit_b.html", and target_link is "/images/logo.png",
    returns "../images/logo.png".
    
    Also renames .php extensions to .html.
    """
    # 1. Parse URL to get the path
    parsed = urllib.parse.urlparse(target_link)
    
    # If it is an external link, leave it unchanged
    if parsed.scheme and parsed.netloc and TARGET_HOST not in parsed.netloc and ALT_HOST not in parsed.netloc and 'web.archive.org' not in parsed.netloc:
        return target_link
        
    path = parsed.path
    if not path:
        return target_link
        
    # Strip leading slash
    clean_path = path.lstrip('/')
    if not clean_path or clean_path.endswith('/'):
        clean_path = os.path.join(clean_path, 'index.html')
        
    # Rename .php to .html
    if clean_path.endswith('.php'):
        clean_path = clean_path[:-4] + '.html'
        
    # Ensure proper file extension for htm/html
    if clean_path.endswith('.htm'):
        clean_path = clean_path[:-4] + '.html'

    # Compute relative path from current page directory to the clean_path
    # E.g. target path: "images/logo.png"
    # current page dir: "exhibits"
    # relative path: "../images/logo.png"
    
    # Split the paths into parts
    curr_parts = [p for p in current_page_dir.replace('\\', '/').split('/') if p]
    target_parts = [p for p in clean_path.replace('\\', '/').split('/') if p]
    
    # Find common prefix
    common_idx = 0
    while common_idx < len(curr_parts) and common_idx < len(target_parts):
        if curr_parts[common_idx] == target_parts[common_idx]:
            common_idx += 1
        else:
            break
            
    # Number of directory ups
    ups = len(curr_parts) - common_idx
    rel_parts = ['..'] * ups + target_parts[common_idx:]
    
    rel_path = '/'.join(rel_parts)
    if not rel_path:
        rel_path = 'index.html'
        
    # Append query string if present (sanitized) to keep files unique if query matters,
    # but for static site we'll strip query strings from paths to ensure filesystem matches.
    return rel_path

def rewrite_page_links(html_content, current_page_path):
    """
    Finds and rewrites all links in the HTML file to be local relative paths.
    Also strips any leftover Wayback domains from absolute links.
    """
    # Normalize current_page_path relative to OUTPUT_DIR
    rel_page_path = os.path.relpath(current_page_path, OUTPUT_DIR)
    current_page_dir = os.path.dirname(rel_page_path)
    
    # Match href and src attributes
    pattern = re.compile(r'(href|src)=["\']([^"\']*)["\']', re.IGNORECASE)
    
    def link_rewriter(match):
        attr = match.group(1)
        val = match.group(2)
        
        # Skip empty or anchor-only links
        if not val or val.startswith('#') or val.startswith('javascript:'):
            return match.group(0)
            
        # Clean Wayback URL wrappers (e.g. https://web.archive.org/web/20211229200858/https://www.citizensmakethecall.com/exhibit_b.htm)
        clean_val = val
        if 'web.archive.org/web/' in val:
            # Extract the actual URL
            m = re.search(r'web\.archive\.org/web/\d+(?:id_|if_)?/(https?://.*)', val)
            if m:
                clean_val = m.group(1)
            else:
                # Might be relative path inside Wayback
                # e.g., /web/20211229200858/https://www.citizensmakethecall.com/exhibit_b.htm
                m = re.search(r'/web/\d+(?:id_|if_)?/(https?://.*)', val)
                if m:
                    clean_val = m.group(1)
                    
        # If it matches citizensmakethecall
        parsed = urllib.parse.urlparse(clean_val)
        
        # Check if already relative (no scheme, no netloc, and doesn't start with /)
        if not parsed.scheme and not parsed.netloc and not clean_val.startswith('/'):
            if clean_val.endswith('.php'):
                return f'{attr}="{clean_val[:-4]}.html"'
            elif clean_val.endswith('.htm'):
                return f'{attr}="{clean_val[:-4]}.html"'
            return match.group(0)
            
        is_internal = False
        if not parsed.netloc: # Relative path
            is_internal = True
        elif TARGET_HOST in parsed.netloc or ALT_HOST in parsed.netloc:
            is_internal = True
            
        if is_internal:
            new_rel_path = normalize_link_path(current_page_dir, clean_val)
            return f'{attr}="{new_rel_path}"'
            
        return match.group(0)
        
    return pattern.sub(link_rewriter, html_content)

def crawl_site():
    print(f"Starting crawl at: {START_URL}")
    print(f"Output directory: {OUTPUT_DIR}")
    
    # Initialize queue with (original_url, is_html)
    # We will seed it with the homepage and standard indexes
    queue = [
        (f"https://{TARGET_HOST}/", True),
        (f"https://{TARGET_HOST}/index.php", True),
        (f"https://{TARGET_HOST}/index.html", True),
    ]
    
    # We can also load all known URLs from closest_snapshots.json to make sure we get PDFs and images!
    if CLOSEST_SNAPSHOTS_FILE and os.path.exists(CLOSEST_SNAPSHOTS_FILE):
        import json
        try:
            with open(CLOSEST_SNAPSHOTS_FILE, "r") as f:
                snapshots = json.load(f)
                print(f"Loaded {len(snapshots)} snapshots from {CLOSEST_SNAPSHOTS_FILE} to crawl queue.")
                for snap in snapshots:
                    url = snap["url"]
                    mime = snap["mimetype"]
                    is_html = "text/html" in mime
                    # Clean up port :80 from URLs
                    url = url.replace(":80/", "/")
                    url = url.replace(":80", "")
                    queue.append((url, is_html))
        except Exception as e:
            print(f"Error reading {CLOSEST_SNAPSHOTS_FILE}: {e}")

    # Remove duplicates from queue while preserving order
    seen_in_queue = set()
    unique_queue = []
    for url, is_html in queue:
        # Normalize protocol and host
        parsed = urllib.parse.urlparse(url)
        norm_url = f"https://{TARGET_HOST}{parsed.path}"
        if parsed.query:
            norm_url += f"?{parsed.query}"
            
        if norm_url not in seen_in_queue:
            seen_in_queue.add(norm_url)
            unique_queue.append((norm_url, is_html))
            
    queue = unique_queue

    # Crawl loop
    while queue:
        curr_url, is_html = queue.pop(0)
        
        # Check if already visited
        if curr_url in visited_urls:
            continue
        visited_urls.add(curr_url)
        
        # Determine local path
        parsed = urllib.parse.urlparse(curr_url)
        path = parsed.path.lstrip('/')
        if not path or path.endswith('/'):
            path = os.path.join(path, "index.html")
            
        # Normalize extensions for files
        if path.endswith('.php'):
            path = path[:-4] + '.html'
        elif path.endswith('.htm'):
            path = path[:-4] + '.html'
            
        local_path = os.path.join(OUTPUT_DIR, path)
        
        # Check if file already exists and is non-empty
        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            print(f"Skipping download, file already exists: {local_path}")
            if is_html:
                try:
                    with open(local_path, "r", encoding='utf-8', errors='ignore') as f:
                        html_text = f.read()
                    
                    # 1. Clean Wayback injected scripts
                    cleaned_html = clean_wayback_injections(html_text)
                    
                    # 2. Extract links for queue
                    extractor = LinkExtractor()
                    extractor.feed(cleaned_html)
                    
                    for link in extractor.links + extractor.assets:
                        if not link or link.startswith('#') or link.startswith('javascript:') or link.startswith('mailto:') or link.startswith('tel:'):
                            continue
                        resolved = urllib.parse.urljoin(curr_url, link)
                        if 'web.archive.org/web/' in resolved:
                            m = re.search(r'web\.archive\.org/web/\d+(?:id_|if_)?/(https?://.*)', resolved)
                            if m:
                                resolved = m.group(1)
                        
                        parsed_res = urllib.parse.urlparse(resolved)
                        if parsed_res.scheme and parsed_res.scheme not in ['http', 'https']:
                            continue
                        
                        if TARGET_HOST in parsed_res.netloc or ALT_HOST in parsed_res.netloc or not parsed_res.netloc:
                            res_path = parsed_res.path.lower()
                            is_res_html = any(res_path.endswith(ext) for ext in ['.htm', '.html', '.php', '/']) or not os.path.splitext(res_path)[1]
                            norm_res = f"https://{TARGET_HOST}{parsed_res.path}"
                            if parsed_res.query:
                                norm_res += f"?{parsed_res.query}"
                                
                            if norm_res not in visited_urls and norm_res not in seen_in_queue:
                                seen_in_queue.add(norm_res)
                                queue.append((norm_res, is_res_html))
                    
                    # 3. Rewrite page links to local relative paths
                    final_html = rewrite_page_links(cleaned_html, local_path)
                    
                    with open(local_path, "w", encoding='utf-8') as f:
                        f.write(final_html)
                except Exception as e:
                    print(f"Error processing existing HTML file {local_path}: {e}")
            continue

        # Download
        wayback_download_url = get_wayback_url(curr_url)
        result = download_asset(wayback_download_url, local_path)
        
        # Respectful delay between requests to prevent IP rate-limiting/blocks
        time.sleep(2.0)
        
        if result[0] is None:
            # Failed to download
            continue
            
        content, final_url = result
        
        # If it's HTML, we need to parse it for further links and clean it up
        if is_html:
            try:
                html_text = content.decode('utf-8', errors='ignore')
                
                # 1. Clean Wayback injected scripts
                cleaned_html = clean_wayback_injections(html_text)
                
                # 2. Extract links for queue
                extractor = LinkExtractor()
                extractor.feed(cleaned_html)
                
                # Process discovered links
                for link in extractor.links + extractor.assets:
                    # Skip empty, fragment, or non-http links
                    if not link or link.startswith('#') or link.startswith('javascript:') or link.startswith('mailto:') or link.startswith('tel:'):
                        continue
                        
                    # Resolve relative link to absolute URL
                    resolved = urllib.parse.urljoin(curr_url, link)
                    
                    # Clean Wayback wrapper if present in resolved link
                    if 'web.archive.org/web/' in resolved:
                        m = re.search(r'web\.archive\.org/web/\d+(?:id_|if_)?/(https?://.*)', resolved)
                        if m:
                            resolved = m.group(1)
                    
                    # Filter: Only crawl internal links
                    parsed_res = urllib.parse.urlparse(resolved)
                    if parsed_res.scheme and parsed_res.scheme not in ['http', 'https']:
                        continue
                        
                    if TARGET_HOST in parsed_res.netloc or ALT_HOST in parsed_res.netloc or not parsed_res.netloc:
                        # Determine if HTML or asset
                        res_path = parsed_res.path.lower()
                        is_res_html = any(res_path.endswith(ext) for ext in ['.htm', '.html', '.php', '/']) or not os.path.splitext(res_path)[1]
                        
                        # Add to queue if not already visited
                        norm_res = f"https://{TARGET_HOST}{parsed_res.path}"
                        if parsed_res.query:
                            norm_res += f"?{parsed_res.query}"
                            
                        if norm_res not in visited_urls and norm_res not in seen_in_queue:
                            seen_in_queue.add(norm_res)
                            queue.append((norm_res, is_res_html))
                            
                # 3. Rewrite page links to local relative paths
                final_html = rewrite_page_links(cleaned_html, local_path)
                
                # Write back the cleaned, rewritten HTML
                with open(local_path, "w", encoding='utf-8') as f:
                    f.write(final_html)
                    
            except Exception as e:
                print(f"Error parsing HTML from {curr_url}: {e}")

    # Generate Missing Assets Report
    generate_report()

def generate_report():
    parent_dir = os.path.dirname(os.path.abspath(OUTPUT_DIR))
    report_path = os.path.join(parent_dir, "missing_assets.md")
    print(f"\nGenerating missing assets report: {report_path}")
    with open(report_path, "w") as f:
        f.write("# Wayback Machine Missing Assets Report\n\n")
        f.write(f"Extraction Timestamp: {TIMESTAMP}\n\n")
        
        if not missing_assets:
            f.write("No missing assets! All requested URLs and discovered links were successfully captured.\n")
        else:
            f.write("The following assets were linked or expected but could not be downloaded from the Wayback Machine (returned 404 or connection failures):\n\n")
            f.write("| Original URL | Local Target Path | Error/Reason |\n")
            f.write("| --- | --- | --- |\n")
            for item in missing_assets:
                f.write(f"| {item['url']} | {item['path']} | {item['error']} |\n")
                
    print("Report generated successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wayback Machine Snapshot Downloader & Cleaner CLI")
    parser.add_argument("-d", "--domain", required=True, help="Target domain (e.g. www.citizensmakethecall.com)")
    parser.add_argument("-t", "--timestamp", default="20211229200858", help="Wayback snapshot timestamp (default: 20211229200858)")
    parser.add_argument("-o", "--output", default="extracted_site", help="Local directory to save extracted files")
    parser.add_argument("-c", "--cdx", help="Path to local CDX snapshots JSON file (optional)")
    
    args = parser.parse_args()
    
    TARGET_HOST = args.domain
    ALT_HOST = args.domain.replace("www.", "") if args.domain.startswith("www.") else f"www.{args.domain}"
    TIMESTAMP = args.timestamp
    START_URL = f"http://web.archive.org/web/{TIMESTAMP}id_/http://{args.domain}/"
    OUTPUT_DIR = os.path.abspath(args.output)
    CLOSEST_SNAPSHOTS_FILE = os.path.abspath(args.cdx) if args.cdx else None
    
    crawl_site()
