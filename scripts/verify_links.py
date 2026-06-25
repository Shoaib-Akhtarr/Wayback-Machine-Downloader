import os
import urllib.parse
from html.parser import HTMLParser

import argparse

extracted_site_dir = ""

class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'a' and 'href' in attrs_dict:
            self.links.append(('a', attrs_dict['href']))
        elif tag == 'img' and 'src' in attrs_dict:
            self.links.append(('img', attrs_dict['src']))
        elif tag == 'link' and 'href' in attrs_dict:
            self.links.append(('link', attrs_dict['href']))
        elif tag == 'script' and 'src' in attrs_dict:
            self.links.append(('script', attrs_dict['src']))
        elif tag == 'iframe' and 'src' in attrs_dict:
            self.links.append(('iframe', attrs_dict['src']))

def verify_links():
    print(f"Verifying local links in {extracted_site_dir}...")
    broken_links = []
    checked_files = 0
    total_links_checked = 0
    
    for root, dirs, files in os.walk(extracted_site_dir):
        for file in files:
            if file.endswith('.html') or file.endswith('.htm'):
                checked_files += 1
                filepath = os.path.join(root, file)
                rel_file_path = os.path.relpath(filepath, extracted_site_dir)
                
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    collector = LinkCollector()
                    collector.feed(content)
                    
                    for tag, link in collector.links:
                        # Skip empty, fragment-only, mailto, tel, javascript, etc.
                        if not link or link.startswith('#') or link.startswith('javascript:') or link.startswith('mailto:') or link.startswith('tel:'):
                            continue
                            
                        # Parse URL
                        parsed = urllib.parse.urlparse(link)
                        
                        # Skip external links
                        if parsed.scheme and parsed.scheme in ['http', 'https']:
                            # But wait, if it still contains wayback or the target host, it shouldn't be external
                            if 'citizensmakethecall.com' not in parsed.netloc and 'archive.org' not in parsed.netloc:
                                continue
                                
                        total_links_checked += 1
                        
                        # Link is relative. Let's find where it points to on disk
                        # Current page directory relative to extracted_site_dir
                        file_dir = os.path.dirname(filepath)
                        
                        # Clean link from queries and fragments
                        link_path = parsed.path
                        if not link_path:
                            # E.g. empty path but has query, which means it links to the page itself
                            continue
                            
                        # Unquote URL-encoded characters (like %20)
                        link_path = urllib.parse.unquote(link_path)
                        
                        # Target file path on disk
                        target_path = os.path.abspath(os.path.join(file_dir, link_path))
                        
                        # Check existence
                        if not os.path.exists(target_path):
                            broken_links.append({
                                'file': rel_file_path,
                                'tag': tag,
                                'link': link,
                                'resolved_path': target_path
                            })
                            
                except Exception as e:
                    print(f"Error reading {file}: {e}")
                    
    print(f"\nVerification Complete:")
    print(f"  Checked {checked_files} HTML files.")
    print(f"  Checked {total_links_checked} internal links.")
    
    if not broken_links:
        print("  SUCCESS: All internal links exist on disk!")
    else:
        print(f"  WARNING: Found {len(broken_links)} broken links:")
        for bl in broken_links[:20]:
            print(f"    In '{bl['file']}' ({bl['tag']}): Link '{bl['link']}' is broken (points to '{bl['resolved_path']}')")
        if len(broken_links) > 20:
            print(f"    ... and {len(broken_links) - 20} more.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Offline Relative Link Verifier")
    parser.add_argument("-d", "--dir", default="extracted_site", help="Path to local extracted site directory (default: extracted_site)")
    args = parser.parse_args()
    
    extracted_site_dir = os.path.abspath(args.dir)
    verify_links()
