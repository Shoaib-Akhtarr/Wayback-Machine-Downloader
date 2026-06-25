import JSZip from 'jszip';

export interface ExtractionProgress {
  status: 'idle' | 'discovering' | 'downloading' | 'packaging' | 'completed' | 'error';
  current: number;
  total: number;
  message: string;
}

/**
 * Strips Wayback Machine injected scripts, styles, toolbars, and comments.
 */
export const cleanWaybackInjections = (html: string): string => {
  // Remove Wayback toolbar comment block if present
  let cleaned = html.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, '');

  // Remove script tags that reference web.archive.org, __wm, archive.org, wombat, or playback.js
  cleaned = cleaned.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (match, body) => {
    if (['__wm', 'archive.org', 'playback.js', 'wombat'].some(x => body.includes(x))) {
      return '<!-- Stripped Wayback Injected Script -->';
    }
    return match;
  });

  // Remove script tags with src pointing to archive.org, containing __wm, playback.js, wombat.js, or _static
  cleaned = cleaned.replace(/<script\b[^>]*src=["']([^"']*)["'][^>]*>([\s\S]*?)<\/script>/gi, (match, src) => {
    if (['archive.org', '__wm', 'playback.js', 'wombat', '_static'].some(x => src.toLowerCase().includes(x))) {
      return '<!-- Stripped Wayback External Script -->';
    }
    return match;
  });

  // Remove injected stylesheet links referencing archive.org or _static
  cleaned = cleaned.replace(/<link\b[^>]*href=["']([^"']*)["'][^>]*>/gi, (match, href) => {
    if (href.includes('archive.org') || href.includes('_static')) {
      return '<!-- Stripped Wayback Style Link -->';
    }
    return match;
  });

  // Remove any Wayback Machine iframe or banner div structures (e.g. wm-ipp)
  cleaned = cleaned.replace(/<div\s+id=["']wm-ipp[^>]*>[\s\S]*?<\/div>/gi, '');

  return cleaned;
};

/**
 * Translates a link to a relative file path on disk.
 */
export const normalizeLinkPath = (
  currentPageDir: string,
  targetLink: string,
  domain: string
): string => {
  let parsedUrl: URL;
  try {
    // Treat relative links as relative to the domain root
    parsedUrl = new URL(targetLink, `https://${domain}`);
  } catch (e) {
    return targetLink;
  }

  const targetHost = domain;
  const altHost = domain.replace(/^www\./, '');
  const host = parsedUrl.host;
  
  // If it is an external link, leave it unchanged
  if (host && !host.includes(targetHost) && !host.includes(altHost) && !host.includes('archive.org')) {
    return targetLink;
  }

  let path = parsedUrl.pathname;
  if (!path) return targetLink;

  // Clean leading slash
  let cleanPath = path.replace(/^\//, '');
  if (!cleanPath || cleanPath.endsWith('/')) {
    cleanPath = cleanPath + (cleanPath.endsWith('/') ? '' : '/') + 'index.html';
  }

  // Rename extensions
  if (cleanPath.endsWith('.php')) {
    cleanPath = cleanPath.slice(0, -4) + '.html';
  } else if (cleanPath.endsWith('.htm')) {
    cleanPath = cleanPath.slice(0, -4) + '.html';
  }

  // Compute relative path from current page directory to the cleanPath
  const currParts = currentPageDir.split('/').filter(Boolean);
  const targetParts = cleanPath.split('/').filter(Boolean);

  let commonIdx = 0;
  while (commonIdx < currParts.length && commonIdx < targetParts.length) {
    if (currParts[commonIdx] === targetParts[commonIdx]) {
      commonIdx++;
    } else {
      break;
    }
  }

  const ups = currParts.length - commonIdx;
  const relParts = [...Array(ups).fill('..'), ...targetParts.slice(commonIdx)];
  let relPath = relParts.join('/');
  
  if (!relPath) {
    relPath = 'index.html';
  }

  return relPath;
};

/**
 * Finds and rewrites all links in the HTML content to be relative.
 */
export const rewritePageLinks = (
  html: string,
  currentPagePath: string,
  domain: string
): string => {
  const parts = currentPagePath.split('/');
  parts.pop(); // Remove file name
  const currentPageDir = parts.join('/');

  return html.replace(/(href|src)=["']([^"']*)["']/gi, (match, attr, val) => {
    if (!val || val.startsWith('#') || val.startsWith('javascript:') || val.startsWith('mailto:') || val.startsWith('tel:')) {
      return match;
    }

    let cleanVal = val;
    // Clean Wayback wrappers
    if (val.includes('web.archive.org/web/')) {
      const matchWayback = val.match(/web\.archive\.org\/web\/\d+(?:id_|if_)?\/(https?:\/\/.*)/);
      if (matchWayback) {
        cleanVal = matchWayback[1];
      } else {
        const matchWaybackRel = val.match(/\/web\/\d+(?:id_|if_)?\/(https?:\/\/.*)/);
        if (matchWaybackRel) {
          cleanVal = matchWaybackRel[1];
        }
      }
    }

    let isInternal = false;
    if (cleanVal.startsWith('/') || !cleanVal.includes('://')) {
      isInternal = true;
    } else {
      try {
        const url = new URL(cleanVal);
        if (url.host.includes(domain) || url.host.includes(domain.replace(/^www\./, ''))) {
          isInternal = true;
        }
      } catch (e) {
        // Ignored
      }
    }

    if (isInternal) {
      // Check if already relative
      if (!cleanVal.startsWith('/') && !cleanVal.includes('://')) {
        if (cleanVal.endsWith('.php')) {
          return `${attr}="${cleanVal.slice(0, -4)}.html"`;
        } else if (cleanVal.endsWith('.htm')) {
          return `${attr}="${cleanVal.slice(0, -4)}.html"`;
        }
        return match;
      }

      const newRelPath = normalizeLinkPath(currentPageDir, cleanVal, domain);
      return `${attr}="${newRelPath}"`;
    }

    return match;
  });
};

export const startExtraction = async (
  domain: string,
  onProgress: (progress: ExtractionProgress) => void
) => {
  const zip = new JSZip();
  const isDevelopment = (import.meta as any).env?.DEV || 
                        window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.hostname.startsWith('192.168.');
  const proxyUrl = isDevelopment ? '/local-proxy' : '/api/proxy';

  try {
    // 1. Discover URLs via CDX API
    onProgress({ status: 'discovering', current: 0, total: 0, message: 'Searching Wayback Machine for archived pages...' });
    
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}/*&output=json&fl=original,timestamp,mimetype&filter=statuscode:200&limit=50`;
    const cdxResponse = await fetch(`${proxyUrl}?url=${encodeURIComponent(cdxUrl)}`);
    
    if (!cdxResponse.ok) {
      const errorText = await cdxResponse.text();
      throw new Error(`Failed to fetch CDX data: ${errorText || cdxResponse.statusText}`);
    }

    const cdxData = await cdxResponse.json();
    if (!cdxData || cdxData.length <= 1) {
      throw new Error('No archived pages found for this domain.');
    }

    // Skip the header row [original, timestamp, mimetype]
    const records = cdxData.slice(1);
    
    // Filter for unique URLs (taking the latest timestamp for each)
    const uniqueRecordsMap = new Map<string, { timestamp: string; mimetype: string }>();
    records.forEach(([original, timestamp, mimetype]: string[]) => {
      uniqueRecordsMap.set(original, { timestamp, mimetype });
    });

    const uniqueRecords = Array.from(uniqueRecordsMap.entries());
    const totalFiles = uniqueRecords.length;

    onProgress({ status: 'downloading', current: 0, total: totalFiles, message: `Found ${totalFiles} unique pages. Starting download...` });

    // 2. Download Snapshots
    for (let i = 0; i < uniqueRecords.length; i++) {
      const [original, { timestamp, mimetype }] = uniqueRecords[i];
      const snapshotUrl = `https://web.archive.org/web/${timestamp}id_/${original}`;
      
      let displayPath = '/';
      try {
        displayPath = new URL(original).pathname || '/';
      } catch (e) {
        displayPath = original;
      }

      onProgress({ 
        status: 'downloading', 
        current: i + 1, 
        total: totalFiles, 
        message: `Downloading: ${displayPath}` 
      });

      try {
        const response = await fetch(`${proxyUrl}?url=${encodeURIComponent(snapshotUrl)}`);
        if (response.ok) {
          // Resolve file path from original URL
          let filePath = '/index.html';
          try {
            filePath = new URL(original).pathname;
            if (filePath === '/' || !filePath) {
              filePath = '/index.html';
            } else if (!filePath.includes('.')) {
              filePath += '/index.html';
            }
          } catch (e) {
            // Fallback for invalid URLs
            filePath = '/index.html';
          }
          
          // Rename extensions to .html
          if (filePath.endsWith('.php')) {
            filePath = filePath.slice(0, -4) + '.html';
          } else if (filePath.endsWith('.htm')) {
            filePath = filePath.slice(0, -4) + '.html';
          }

          const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
          const isHtml = mimetype?.includes('text/html') || cleanPath.endsWith('.html');

          if (isHtml) {
            const htmlText = await response.text();
            
            // Clean injected scripts, comments and toolbars
            const cleanedHtml = cleanWaybackInjections(htmlText);
            
            // Rewrite all links to make them local relative
            const finalHtml = rewritePageLinks(cleanedHtml, cleanPath, domain);
            
            zip.file(cleanPath, finalHtml);
          } else {
            const blob = await response.blob();
            zip.file(cleanPath, blob);
          }
        }
      } catch (err) {
        console.error(`Failed to download ${original}:`, err);
      }

      // Add a small delay to be polite to the proxy/Wayback
      if (i < uniqueRecords.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // 3. Package and Download ZIP
    onProgress({ status: 'packaging', current: totalFiles, total: totalFiles, message: 'Compiling your ZIP package...' });
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const downloadUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${domain.replace(/\./g, '_')}_wayback_archive.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    onProgress({ status: 'completed', current: totalFiles, total: totalFiles, message: 'Extraction complete! Your ZIP is ready.' });

  } catch (error: any) {
    console.error('Extraction error:', error);
    onProgress({ status: 'error', current: 0, total: 0, message: error.message || 'An unexpected error occurred.' });
  }
};
