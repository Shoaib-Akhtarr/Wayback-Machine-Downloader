# Wayback Machine Developer Python Scripts

This folder contains Python CLI developer utilities to download, clean, and verify local site mirrors from the Wayback Machine.

---

## 1. `wayback_crawler.py` (Site Downloader & Cleaner)

A robust command-line crawler that downloads a website from the Wayback Machine, cleans it of all archival injections (like toolbars and Wombat JS rewrites), and normalizes internal links to run offline.

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

### Example
```bash
python wayback_crawler.py -d www.citizensmakethecall.com -t 20211229200858 -o extracted_site -c closest_snapshots.json
```

---

## 2. `verify_links.py` (Local Link Verifier)

A link-checking utility that scans the downloaded site to ensure that all relative links, styles, scripts, and image sources resolve to valid files on the disk.

### Features
- Scans `<a>`, `<img>`, `<link>`, `<script>`, and `<iframe>` tags.
- Verifies relative paths correctly based on directory depth.
- Logs a summary of checked links and a list of any broken links.

### Usage
```bash
python verify_links.py -d <extracted_site_directory>
```

### Options
- `-d`, `--dir`: Path to the extracted static folder (default: `extracted_site`).

### Example
```bash
python verify_links.py -d extracted_site
```

---

## 3. `php_to_html.py` (Local PHP to HTML Converter)

A standalone utility script that renames `.php` and `.htm` files in a local directory to `.html` recursively, and updates all code link references inside `.html`, `.css`, and `.js` files to point to the new `.html` filenames.

### Usage
```bash
python php_to_html.py -d <directory_path>
```

### Options
- `-d`, `--dir`: Path to the directory containing files to convert (default: `extracted_site`).

### Example
```bash
python php_to_html.py -d extracted_site
```
