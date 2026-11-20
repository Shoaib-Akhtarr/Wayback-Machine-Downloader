# Wayback Machine Developer Python Scripts

This folder contains Python CLI developer utilities to download, scrape, clean, and verify local site mirrors and assets from the Wayback Machine.

---

## 1. `deep_recursive_image_collector.py` (Deep Recursive Image Scraper & Categorizer)

A complete solution to extract all images from an archived domain. Combines Wayback CDX archive queries across all historical captures with deep recursive HTML subpage crawling. It validates binary magic bytes, deduplicates with SHA-256, and organizes images into structured folders.

### Features
- Discovers images across all historical snapshot dates via the CDX Master Index.
- Recursively crawls internal subpages (articles, news, galleries, activities).
- Uses the `im_` modifier to download raw, pure image binaries without Wayback toolbar injections.
- Validates file integrity via magic bytes (`JPEG`, `PNG`, `GIF`, `BMP`, `ICO`, `SVG`).
- Deduplicates images via SHA-256 hashes to prevent redundant downloads.
- Organizes images automatically into:
  - `1_Photos_and_Events`
  - `2_News_and_Articles`
  - `3_Banners_and_Logos`
  - `4_UI_and_Icons`
- Generates `manifest.json` and `README.txt` catalogues.

### Usage
```bash
python deep_recursive_image_collector.py <target_url_or_domain> [options]
```

### Options
- `target` (Required): Wayback snapshot URL or domain name (e.g. `http://www.example.com/`).
- `-o`, `--output`: Destination directory (default: `organized_archive_images`).
- `--max-pages`: Maximum subpages to crawl recursively (default: `35`).
- `--threads`: Number of concurrent worker threads (default: `3`).

### Example
```bash
python deep_recursive_image_collector.py http://www.gaziemir.k12.tr/ -o output_images --threads 4
```

---

## 2. `image_scraper.py` (Fast Bulk Image Downloader)

A focused CLI tool for high-speed image recovery with rate-limiting, exponential backoff on HTTP 429, and flexible snapshot/year filtering.

### Features
- **CDX Archive Mode**: Instantly fetch all image records ever captured for a domain.
- **Page Crawl Mode**: Scrape images linked on a specific snapshot page.
- Exponential backoff on rate limits (`HTTP 429: Too Many Requests`).
- Content size and binary validation.

### Usage
```bash
python image_scraper.py <target> [options]
```

### Options
- `target` (Required): Wayback snapshot URL or domain name.
- `-o`, `--output`: Folder to save images (default: `downloaded_images`).
- `--year`: Filter CDX by specific year (e.g. `2012`).
- `--all-captures`: Download every historical capture without collapsing duplicates.
- `--page-only`: Only download images directly referenced on this single snapshot page.
- `--threads`: Number of worker threads (default: `3`).

### Example
```bash
python image_scraper.py https://web.archive.org/web/20120112041118/http://www.gaziemir.k12.tr/ -o my_images
```

---

## 3. `organize_images.py` (Image Validator & Categorizer)

Scans any directory containing downloaded images, validates their binary format, eliminates duplicates via SHA-256 hashes, and sorts them into organized subdirectories.

### Usage
```bash
python organize_images.py -i <input_dir> -o <output_dir>
```

---

## 4. `wayback_crawler.py` (Full Site Downloader & Cleaner)

A robust command-line crawler that downloads an entire website mirror from the Wayback Machine, cleans it of all archival injections (toolbars, Wombat JS rewrites), and normalizes internal links to run offline.

### Features
- Pre-populates the download queue from a local CDX JSON file (optional).
- Handles spaces and URL-encoded characters in paths safely.
- Auto-renames `.php` and `.htm` extensions to `.html` and normalizes page links accordingly.
- Strips all Wayback Machine toolbars, comments, and wombats (`wombat.js` / `playback.js`).
- Enforces request delays and retries with backoff to prevent TCP blocks.
- Generates a `missing_assets.md` report for 404s.

### Usage
```bash
python wayback_crawler.py -d <domain> [options]
```

### Options
- `-d`, `--domain` (Required): The domain name to crawl (e.g. `www.example.com`).
- `-t`, `--timestamp`: Target Wayback snapshot timestamp (default: `20211229200858`).
- `-o`, `--output`: Target folder path to save files (default: `extracted_site`).
- `-c`, `--cdx`: Path to a CDX snapshots JSON file (optional).

---

## 5. `verify_links.py` (Local Link Verifier)

A link-checking utility that scans the downloaded site to ensure that all relative links, styles, scripts, and image sources resolve to valid files on the disk.

### Usage
```bash
python verify_links.py -d <extracted_site_directory>
```

---

## 6. `php_to_html.py` (Local PHP to HTML Converter)

A standalone utility script that renames `.php` and `.htm` files in a local directory to `.html` recursively, and updates all code link references inside `.html`, `.css`, and `.js` files to point to the new `.html` filenames.

### Usage
```bash
python php_to_html.py -d <directory_path>
```
