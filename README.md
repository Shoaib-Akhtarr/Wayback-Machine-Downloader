# Wayback Machine Downloader & Site Extractor 🚀

A comprehensive, production-ready toolkit to download, scrape, clean, and rebuild offline mirrors and asset libraries from the Internet Archive's Wayback Machine.

Includes both a **modern interactive Web Dashboard** and a **Python CLI utility suite** with deep recursive crawling and CDX Master Index discovery.

---

## ✨ Features

- **🌐 Interactive Web Application**:
  - Built with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Framer Motion**.
  - In-browser archive discovery, URL rewriting, toolbar cleaning, and ZIP packaging powered by **JSZip**.
  - Built-in serverless proxy (`api/proxy.js`) to bypass CORS restrictions.
- **📸 Deep Recursive Image Collector**:
  - Queries Archive.org's CDX Master Index across all historical captures.
  - Crawls subpages, news articles, and galleries recursively to locate deep media.
  - Automatically validates binary magic bytes (`JPEG`, `PNG`, `GIF`, `BMP`, `ICO`, `SVG`) and deduplicates using SHA-256 hashes.
  - Categorizes images into `1_Photos_and_Events`, `2_News_and_Articles`, `3_Banners_and_Logos`, and `4_UI_and_Icons`.
- **🛠️ Offline Site Mirroring**:
  - Automatically strips Wayback Machine toolbars, tracking scripts (`wombat.js`, `playback.js`), and comment blocks.
  - Rewrites internal `.php` and `.htm` links to valid offline `.html` relative paths.
  - Verifies local link integrity and flags broken/missing assets.
- **🛡️ Rate-Limit & Connection Protection**:
  - Polite concurrency with exponential backoff on `HTTP 429: Too Many Requests`.
  - Uses direct binary modifiers (`im_` / `id_`) to ensure pure, uncorrupted media downloads.

---

## 📁 Repository Structure

```
wayback-downloader/
├── api/
│   └── proxy.js                     # Serverless CORS fetch proxy
├── scripts/
│   ├── deep_recursive_image_collector.py  # Deep multi-page image scraper & categorizer
│   ├── image_scraper.py                   # Fast CDX bulk image scraper with backoff
│   ├── organize_images.py                 # File validator, deduplicator & sorter
│   ├── wayback_crawler.py                 # Full static site mirror crawler & cleaner
│   ├── verify_links.py                    # Local offline link integrity checker
│   ├── php_to_html.py                     # Recursive PHP-to-HTML converter
│   └── README.md                          # Detailed CLI documentation
├── src/
│   ├── components/                  # Layout and navigation components
│   ├── pages/                       # Home, About, Services, Portfolio, Blog, Contact
│   ├── utils/
│   │   └── downloader.ts            # Browser-based Wayback cleaner & ZIP packager
│   ├── App.tsx                      # App router & views
│   └── main.tsx                     # Entry point
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Quick Start

### 1. Web Application

#### Prerequisites
- Node.js 18+ & npm

#### Installation & Development
```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev

# Build production bundle
npm run build
```

---

### 2. Python CLI Utilities

All Python utilities run using Python 3 standard library modules—**no extra pip packages required**.

#### Deep Image Extraction & Organization
Extracts all images from a domain across all historical Wayback captures and organizes them into categorized folders:
```bash
python scripts/deep_recursive_image_collector.py http://www.example.com/ -o my_images
```

#### Fast Bulk Image Scraper
Quickly download images from a specific snapshot or across the entire archive with rate-limit handling:
```bash
python scripts/image_scraper.py https://web.archive.org/web/20120112041118/http://www.example.com/ -o downloaded_images
```

#### Download an Entire Site for Offline Browsing
Crawls, strips Wayback injections, and rewrites relative links:
```bash
python scripts/wayback_crawler.py -d www.example.com -o extracted_site
```

#### Check Local Link Integrity
```bash
python scripts/verify_links.py -d extracted_site
```

For more CLI parameters and options, see [scripts/README.md](scripts/README.md).

---

## 📄 License
MIT License. Free for developer and commercial use.
