import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Search, 
  Globe, 
  Clock,
  Archive,
  Loader2,
  Trash2,
  Plus,
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  Eye
} from 'lucide-react';
import JSZip from 'jszip';

interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: string;
}

interface WaybackUrl {
  timestamp: string;
  original: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  url?: string;
  timestamp?: string;
}

const App: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'idle' | 'discovery' | 'discovered' | 'downloading' | 'zipping' | 'complete'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [discoveredUrls, setDiscoveredUrls] = useState<WaybackUrl[]>([]);
  const [useDirectMode, setUseDirectMode] = useState(false);
  
  // Snapshot Selection State
  const [availableSnapshots, setAvailableSnapshots] = useState<{timestamp: string, readableDate: string}[]>([]);
  const [isFetchingSnapshots, setIsFetchingSnapshots] = useState(false);
  const [showSnapshotSelector, setShowSnapshotSelector] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  const [manualUrl, setManualUrl] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | 'Pages' | 'Scripts' | 'Styles' | 'Assets'>('All');
  const [viewMode, setViewMode] = useState<'list' | 'folder'>('list');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));

  const categories = {
    All: (urls: WaybackUrl[]) => urls,
    Pages: (urls: WaybackUrl[]) => urls.filter(u => {
      const p = u.original.toLowerCase();
      return p.endsWith('.html') || p.endsWith('.php') || p.endsWith('.asp') || !p.split('/').pop()?.includes('.');
    }),
    Scripts: (urls: WaybackUrl[]) => urls.filter(u => u.original.toLowerCase().endsWith('.js')),
    Styles: (urls: WaybackUrl[]) => urls.filter(u => u.original.toLowerCase().endsWith('.css')),
    Assets: (urls: WaybackUrl[]) => urls.filter(u => {
      const p = u.original.toLowerCase();
      return !p.endsWith('.html') && !p.endsWith('.php') && !p.endsWith('.js') && !p.endsWith('.css') && p.split('/').pop()?.includes('.');
    })
  };

  const [isAddingManual, setIsAddingManual] = useState(false);

  const smartAddManualUrl = async () => {
    if (!manualUrl) return;
    const url = manualUrl.trim();
    setIsAddingManual(true);
    
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    
    // 1. Initial Page Entry
    const newEntries: WaybackUrl[] = [{ timestamp, original: url }];
    addLog(`Smart Adding: ${url}...`, 'info');

    // 2. Recursive Discovery (Mini-Spider)
    try {
      const { content, success } = await fetchWithFallback(url, true);
      if (success && content) {
        const text = await (content as Blob).text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        const extract = (selector: string, attr: string) => {
          doc.querySelectorAll(selector).forEach(el => {
            const rawSrc = el.getAttribute(attr);
            if (!rawSrc || rawSrc.startsWith('data:') || rawSrc.startsWith('#')) return;
            try {
              const absUrl = new URL(rawSrc, url).href;
              if (!newEntries.some(e => e.original === absUrl)) {
                newEntries.push({ timestamp, original: absUrl });
              }
            } catch (e) {}
          });
        };

        extract('link[rel="stylesheet"]', 'href');
        extract('script[src]', 'src');
        extract('img[src]', 'src');
      }
    } catch (e) {
      addLog(`Asset spider failed for ${url}, adding only the page.`, 'warning');
    }

    setDiscoveredUrls(prev => {
      const filtered = [...prev];
      newEntries.forEach(entry => {
        if (!filtered.some(f => f.original === entry.original)) {
          filtered.unshift(entry);
        }
      });
      return filtered;
    });

    setManualUrl('');
    setIsAddingManual(false);
    addLog(`Success! Added ${url} and ${newEntries.length - 1} related assets.`, 'success');
  };

  const searchAndRemove = () => {
    if (!manualUrl) return;
    const term = manualUrl.toLowerCase().trim();
    setDiscoveredUrls(prev => {
      const filtered = prev.filter(u => !u.original.toLowerCase().includes(term));
      const removedCount = prev.length - filtered.length;
      if (removedCount > 0) {
        addLog(`Search & Destroy: Removed ${removedCount} items matching "${term}"`, 'warning');
      } else {
        addLog(`No items found matching "${term}"`, 'info');
      }
      return filtered;
    });
    setManualUrl('');
  };

  const removeUrl = (originalUrl: string) => {
    setDiscoveredUrls(prev => prev.filter(u => u.original !== originalUrl));
    addLog(`Removed from list: ${originalUrl.split('/').pop()}`, 'warning');
  };


  // Debounced auto-check

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const proxies = [
    (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?url=${encodeURIComponent(url)}`, 
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
  ];

  const fetchWithFallback = async (targetUrl: string, useRaw = true) => {
    const directFetch = async () => {
      try {
        const response = await fetch(targetUrl);
        if (response.status === 404) {
          addLog(`Resource not found in archive: ${targetUrl.split('/').pop()}`, 'warning');
          return { content: null, success: false };
        }
        if (response.ok) {
          const content = await (useRaw ? response.blob() : response.text());
          return { content, success: true };
        }
      } catch (e) {}
      return { content: null, success: false };
    };

    if (useDirectMode) return await directFetch();

    for (const getProxyUrl of proxies) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const proxyUrl = getProxyUrl(targetUrl);
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429) addLog(`Proxy Rate Limited: ${new URL(proxyUrl).hostname}`, 'warning');
          continue;
        }
        
        let data;
        if (proxyUrl.includes('allorigins.win')) {
          const json = await response.json();
          data = json.contents;
        } else {
          data = await (useRaw ? response.blob() : response.text());
        }
        
        if (data) return { content: data, success: true };
      } catch (e) {
        clearTimeout(timeoutId);
        continue;
      }
    }

    addLog(`All proxies failed. Suggestion: Enable DIRECT MODE and use a CORS extension.`, 'warning');
    return await directFetch();
  };

  const findAlternativeSnapshot = async (originalUrl: string) => {
    const availabilityUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(originalUrl)}`;
    const { content, success } = await fetchWithFallback(availabilityUrl, false);
    if (success && content) {
      try {
        const data = typeof content === 'string' ? JSON.parse(content) : content;
        const closest = data.archived_snapshots?.closest;
        if (closest && closest.available) {
          return closest.timestamp;
        }
      } catch (e) {}
    }
    return null;
  };

  const getPathFromUrl = (url: string) => {
    let path = '';
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
      path = urlObj.pathname;
    } catch (e) {
      path = url.replace(/[^a-z0-9]/gi, '_');
    }
    
    // Normalize index pages
    if (path === '/' || !path) path = 'index.html';
    if (path.startsWith('/')) path = path.substring(1);
    
    const filename = path.split('/').pop() || 'index.html';
    const ext = filename.split('.').pop()?.toLowerCase();

    // Modern Web Structure: Asset Categorization
    if (ext === 'css') return `assets/css/${filename}`;
    if (ext === 'js') return `assets/js/${filename}`;
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')) return `assets/img/${filename}`;
    if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext || '')) return `assets/fonts/${filename}`;
    if (['mp4', 'webm', 'ogg', 'mp3', 'wav'].includes(ext || '')) return `assets/media/${filename}`;

    // For pages, ensure .html extension for offline browsing
    if (!filename.includes('.') && !path.endsWith('.html')) {
      return path.endsWith('/') ? `${path}index.html` : `${path}.html`;
    }
    
    return path;
  };

  const getRelativePath = (fromPath: string, toPath: string) => {
    // If the 'from' file is at the root, the path is already correct
    if (!fromPath.includes('/')) return toPath;
    
    const fromParts = fromPath.split('/');
    // We ignore the actual filename of the current page
    const depth = fromParts.length - 1;
    
    let prefix = '';
    for (let i = 0; i < depth; i++) {
      prefix += '../';
    }
    return prefix + toPath;
  };

  const buildFileTree = (urls: WaybackUrl[]): FileNode => {
    const root: FileNode = { name: 'root', path: '', type: 'folder', children: [] };

    urls.forEach(url => {
      const fullPath = getPathFromUrl(url.original);
      const parts = fullPath.split('/');
      let current = root;

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');
        
        let child = current.children?.find(c => c.name === part);
        if (!child) {
          child = {
            name: part,
            path: currentPath,
            type: isLast ? 'file' : 'folder',
            children: isLast ? undefined : [],
            url: isLast ? url.original : undefined,
            timestamp: isLast ? url.timestamp : undefined
          };
          current.children?.push(child);
        }
        if (!isLast) current = child;
      });
    });

    const sortNodes = (node: FileNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'folder' ? -1 : 1;
        });
        node.children.forEach(sortNodes);
      }
    };
    sortNodes(root);
    return root;
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const removeFolder = (folderPath: string) => {
    setDiscoveredUrls(prev => prev.filter(u => !getPathFromUrl(u.original).startsWith(folderPath)));
    addLog(`Deleted entire folder: ${folderPath}`, 'warning');
  };

  const FileTreeItem: React.FC<{ node: FileNode, depth: number }> = ({ node, depth }) => {
    const isExpanded = expandedFolders.has(node.path);

    if (node.name === 'root') {
      return (
        <div style={{ padding: '5px' }}>
          {node.children?.map(child => (
            <FileTreeItem key={child.path} node={child} depth={0} />
          ))}
        </div>
      );
    }

    return (
      <div style={{ marginLeft: depth > 0 ? '15px' : '0' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '4px 8px',
          borderRadius: '4px',
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.02)',
          marginBottom: '2px',
          transition: 'background 0.2s'
        }}
        onClick={() => node.type === 'folder' && toggleFolder(node.path)}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            {node.type === 'folder' && (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            )}
            {node.type === 'folder' ? <Folder size={14} color="var(--primary)" /> : <FileText size={14} color="var(--text-muted)" />}
            <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {node.name}
            </span>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (node.type === 'folder') removeFolder(node.path);
              else removeUrl(node.url!);
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ff4d4d', padding: '4px', display: 'flex' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
        {node.type === 'folder' && isExpanded && node.children?.map(child => (
          <FileTreeItem key={child.path} node={child} depth={depth + 1} />
        ))}
      </div>
    );
  };


  const fetchSnapshots = async (urlToFetch: string) => {
    setIsFetchingSnapshots(true);
    addLog(`Querying archive history for ${urlToFetch}...`, 'info');
    
    // CDX Query to get all distinct timestamps for the exact URL
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(urlToFetch)}&fl=timestamp&output=json&collapse=timestamp&limit=100`;
    
    try {
      const { content, success } = await fetchWithFallback(cdxUrl, false);
      if (!success || !content) throw new Error('Failed to fetch history');

      const data = JSON.parse(content as string);
      if (data.length <= 1) {
        addLog(`No historical snapshots found for ${urlToFetch}`, 'warning');
        setIsFetchingSnapshots(false);
        return;
      }

      // Skip the header row from CDX output
      const timestamps = data.slice(1).map((row: string[]) => row[0]);
      
      const formattedSnapshots = timestamps.map((ts: string) => {
        // Format YYYYMMDDHHMMSS to "MMM DD, YYYY - HH:MM:SS"
        const year = ts.substring(0, 4);
        const month = ts.substring(4, 6);
        const day = ts.substring(6, 8);
        const hour = ts.substring(8, 10);
        const min = ts.substring(10, 12);
        const sec = ts.substring(12, 14);
        
        const date = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
        const readable = date.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        
        return { timestamp: ts, readableDate: readable };
      }).reverse(); // Most recent first

      setAvailableSnapshots(formattedSnapshots);
      setShowSnapshotSelector(true);
      addLog(`Found ${formattedSnapshots.length} available snapshots.`, 'success');
    } catch (e) {
      addLog(`Error retrieving site history: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    } finally {
      setIsFetchingSnapshots(false);
      setIsProcessing(false);
    }
  };

  const fetchCDXUrls = async (targetDomain: string, targetTimestamp?: string): Promise<WaybackUrl[]> => {
    setIsProcessing(true);
    setStep('discovery');
    const normalizedDomain = targetDomain.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    addLog(`Searching Wayback index for ${normalizedDomain} ${targetTimestamp ? `at ${targetTimestamp}` : ''}...`, 'info');
    
    // Requesting JSON with timestamp and original URL
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${normalizedDomain}/*&output=json&fl=timestamp,original&collapse=urlkey${targetTimestamp ? `&timestamp=${targetTimestamp}` : ''}`;
    
    const { content, success } = await fetchWithFallback(cdxUrl, false);
    
    try {
      if (success && content) {
        let data;
        if (typeof content === 'string') {
          data = JSON.parse(content);
        } else {
          // If it returned a blob (unlikely for discovery but safe)
          const text = await (content as Blob).text();
          data = JSON.parse(text);
        }

        // CDX JSON format: [ ["field1", "field2"], ["val1", "val2"], ... ]
        if (data && data.length > 1) {
          const results: WaybackUrl[] = data.slice(1).map((row: string[]) => ({
            timestamp: row[0],
            original: row[1]
          }));
          addLog(`Discovered ${results.length} archived assets.`, 'success');
          return results;
        }
      }
    } catch (e) {
      addLog(`Failed to parse index data.`, 'error');
    }

    addLog(`Discovery failed or no data found.`, 'error');
    addLog(`💡 TIP: Install and enable "Allow CORS" extension in your browser for 100% reliability.`, 'warning');
    setIsProcessing(false);
    return [];
  };

  const downloadAndZip = async (waybackUrls: WaybackUrl[]) => {
    setIsProcessing(true);
    setStep('downloading');
    const zip = new JSZip();
    const processedUrls = new Set<string>();
    const downloadQueue = [...waybackUrls];
    let successCount = 0;
    const failedItems: WaybackUrl[] = [];

    addLog(`Phase 1: Starting extraction of ${downloadQueue.length} primary assets...`, 'info');

    const CONCURRENCY = 5;
    let totalToProcess = downloadQueue.length;
    let completedCount = 0;

    const processItem = async (item: WaybackUrl, isRetry = false) => {
      if (processedUrls.has(item.original)) return true;
      
      const cleanUrl = item.original.trim().replace(/^\/+/, '');
      const archiveUrl = `https://web.archive.org/web/${item.timestamp}/${cleanUrl}`;
      
      try {
        let { content, success } = await fetchWithFallback(archiveUrl, true);
        
        // --- SMART RECOVERY (FALLBACK FOR 404s) ---
        if (!success || !content) {
          addLog(`Missing from ${item.timestamp}. Searching other snapshots for ${item.original.split('/').pop()}...`, 'info');
          const altTimestamp = await findAlternativeSnapshot(item.original);
          if (altTimestamp) {
            addLog(`Recovered from ${altTimestamp}!`, 'success');
            const altUrl = `https://web.archive.org/web/${altTimestamp}/${cleanUrl}`;
            const altResult = await fetchWithFallback(altUrl, true);
            if (altResult.success) {
              content = altResult.content;
              success = true;
            }
          }
        }

        if (!success || !content) throw new Error('Fetch failed');

        let data = content as Blob;
        const localPath = getPathFromUrl(item.original);

        // --- CSS DEEP-LINKING ENGINE ---
        if (localPath.endsWith('.css')) {
          let text = await data.text();
          
          // Regex to find url(...) references
          const urlRegex = /url\(['"]?([^'")]*?)['"]?\)/g;
          let match;

          while ((match = urlRegex.exec(text)) !== null) {
            let relUrl = match[1];
            if (!relUrl || relUrl.startsWith('data:') || relUrl.startsWith('#')) continue;

            try {
              let absUrl = new URL(relUrl, item.original).href;
              
              // Clean Wayback prefix
              if (absUrl.includes('web.archive.org/web/')) {
                const parts = absUrl.split('/');
                const tsIndex = parts.findIndex(p => p === 'web') + 1;
                if (tsIndex > 0 && tsIndex < parts.length - 1) {
                  const originalStart = parts.slice(tsIndex + 1).join('/');
                  absUrl = originalStart.startsWith('http') ? originalStart : 'http://' + originalStart;
                }
              }

              const urlObj = new URL(absUrl);
              const targetDomain = new URL(item.original.startsWith('http') ? item.original : `http://${item.original}`).hostname;
              
              if (urlObj.hostname.includes(targetDomain)) {
                const mappedPath = getPathFromUrl(absUrl);
                const localRelPath = getRelativePath(localPath, mappedPath);
                
                // Rewrite in CSS
                text = text.replace(match[0], `url("${localRelPath}")`);

                if (!processedUrls.has(absUrl) && !downloadQueue.some(q => q.original === absUrl)) {
                  downloadQueue.push({ timestamp: item.timestamp, original: absUrl });
                  totalToProcess++;
                }
              }
            } catch (e) {}
          }
          data = new Blob([text], { type: 'text/css' });
        }

        // --- UNIVERSAL DISCOVERY ENGINE ---
        if (localPath.endsWith('.html')) {
          const text = await data.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          
          const currentUrlObj = new URL(item.original.startsWith('http') ? item.original : `http://${item.original}`);
          const targetDomain = currentUrlObj.hostname.toLowerCase().replace(/^www\./, '');

          const scanAndRewrite = (selector: string, attr: string) => {
            doc.querySelectorAll(selector).forEach(el => {
              const rawSrc = el.getAttribute(attr);
              if (!rawSrc || rawSrc.startsWith('data:') || rawSrc.startsWith('#') || rawSrc.startsWith('javascript:')) return;
              
              try {
                let absUrl = new URL(rawSrc, item.original).href;
                
                // CRITICAL: If the link is already a Wayback URL, strip it to get the original URL
                if (absUrl.includes('web.archive.org/web/')) {
                  const parts = absUrl.split('/');
                  const tsIndex = parts.indexOf('web') + 1;
                  if (tsIndex > 0 && tsIndex < parts.length - 1) {
                    absUrl = parts.slice(tsIndex + 1).join('/');
                    if (!absUrl.startsWith('http')) absUrl = 'http://' + absUrl;
                  }
                }

                const urlObj = new URL(absUrl);
                const linkDomain = urlObj.hostname.toLowerCase().replace(/^www\./, '');

                // Internal discovery (robust domain check)
                if (linkDomain === targetDomain || linkDomain.endsWith('.' + targetDomain)) {
                  const mappedPath = getPathFromUrl(absUrl);
                  const relPath = getRelativePath(localPath, mappedPath);
                  
                  if (!processedUrls.has(absUrl) && !downloadQueue.some(q => q.original === absUrl)) {
                    addLog(`New content found: ${absUrl.split('/').pop() || absUrl}`, 'info');
                    downloadQueue.push({ timestamp: item.timestamp, original: absUrl });
                    totalToProcess++;
                  }
                  el.setAttribute(attr, relPath);
                }
              } catch (e) {}
            });
          };

          // Comprehensive Tag Scanning
          scanAndRewrite('link[rel="stylesheet"]', 'href');
          scanAndRewrite('link[rel="icon"], link[rel="shortcut icon"]', 'href');
          scanAndRewrite('link[rel="canonical"], link[rel="alternate"]', 'href');
          scanAndRewrite('script[src]', 'src');
          scanAndRewrite('img[src]', 'src');
          scanAndRewrite('a[href]', 'href');
          scanAndRewrite('iframe[src]', 'src');
          scanAndRewrite('form[action]', 'action');
          scanAndRewrite('area[href]', 'href');
          scanAndRewrite('meta[property="og:image"]', 'content');
          scanAndRewrite('meta[property="og:url"]', 'content');

          // --- WAYBACK CLEANER ENGINE ---
          // Strip Wayback Scripts
          doc.querySelectorAll('script').forEach(s => {
            const src = s.getAttribute('src') || '';
            const text = s.textContent || '';
            if (
              src.includes('archive.org') || 
              src.includes('wombat.js') || 
              src.includes('staticweb') ||
              text.includes('_____wombat_____') ||
              text.includes('archive.org')
            ) {
              s.remove();
            }
          });

          // Strip Wayback Toolbar & UI
          doc.querySelectorAll('#wm-ipp, #wm-ipp-base, #wm-ipp-print, .wb_metadata').forEach(el => el.remove());
          
          // Remove Wayback comments (often contains injected metadata)
          const iterator = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_COMMENT);
          let currentComment;
          const toRemove: Node[] = [];
          while (currentComment = iterator.nextNode()) {
            if (currentComment.textContent?.includes('WAYBACK') || currentComment.textContent?.includes('archive.org')) {
              toRemove.push(currentComment);
            }
          }
          toRemove.forEach(n => n.parentNode?.removeChild(n));

          data = new Blob([doc.documentElement.outerHTML], { type: 'text/html' });
        }

        zip.file(localPath, data);
        processedUrls.add(item.original);
        successCount++;
        return true;
      } catch (err) {
        if (!isRetry) failedItems.push(item);
        return false;
      } finally {
        if (!isRetry) {
          completedCount++;
          setProgress(Math.round((completedCount / totalToProcess) * 100));
        }
      }
    };

    // Process queue with concurrency
    let currentIdx = 0;
    while (currentIdx < downloadQueue.length) {
      const batch = downloadQueue.slice(currentIdx, currentIdx + CONCURRENCY);
      await Promise.all(batch.map(item => processItem(item, false)));
      currentIdx += CONCURRENCY;
    }

    // Phase 2: Serial Retry
    if (failedItems.length > 0) {
      addLog(`Phase 2: Retrying ${failedItems.length} failed items...`, 'warning');
      for (const item of failedItems) {
        await processItem(item, true);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setStep('zipping');
    addLog(`Packaging ${successCount} files...`, 'info');
    const zipContent = await zip.generateAsync({ type: 'blob' });
    const downloadUrl = URL.createObjectURL(zipContent);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${domain.replace(/[^a-z0-9]/gi, '_')}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setStep('complete');
    addLog(`Complete! Site extracted with ${successCount} files.`, 'success');
    addLog(`💡 OFFLINE TIP: To avoid CORS errors, don't open index.html directly. Run a local server: Open folder in VS Code → Right click index.html → "Open with Live Server" or run "npx serve" in the folder.`, 'info');
    setIsProcessing(false);
  };

  const handleStart = async () => {
    if (!domain) return;
    
    // Clean up domain
    let cleanDomain = domain.trim();
    if (cleanDomain.includes('web.archive.org/web/')) {
      const parts = cleanDomain.split('/');
      const index = parts.findIndex(p => p === 'web') + 1; 
      if (index > 0 && index < parts.length - 1) {
        cleanDomain = parts.slice(index + 1).join('/');
      }
    }
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').split('/')[0];

    // Reset states
    setIsProcessing(true);
    setLogs([]);
    setProgress(0);
    setDiscoveredUrls([]);
    setAvailableSnapshots([]);
    setShowSnapshotSelector(false);
    
    // Phase 1: Fetch Available Snapshots
    await fetchSnapshots(cleanDomain);
  };

  const startDownload = async () => {
    if (discoveredUrls.length === 0) return;
    await downloadAndZip(discoveredUrls);
  };

  return (
    <div className="container" style={{ maxWidth: '900px', margin: '60px auto', padding: '0 20px' }}>
      <div className="glass" style={{ padding: '40px' }}>
        <header style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', padding: '12px', borderRadius: '15px' }}>
              <Archive size={32} color="white" />
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800 }}>Wayback <span style={{ color: 'var(--primary)' }}>Pro</span></h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Extract and package entire archived sites into a single ZIP</p>
        </header>
        <div className="input-group">
          <input 
            type="text" 
            placeholder="Enter domain (e.g., chromesecuritysystems.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value.replace(/^https?:\/\//, '').replace(/\/$/, ''))}
            disabled={isProcessing}
          />
          <button 
            className="glow-btn"
            style={{ position: 'absolute', right: '8px', top: '8px', padding: '8px 20px' }}
            onClick={handleStart}
            disabled={isProcessing || isFetchingSnapshots || !domain}
          >
            {isProcessing || isFetchingSnapshots ? <Loader2 className="animate-spin" /> : <Search size={20} />}
          </button>
        </div>

        {/* Network & Mode Selector */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '15px' }}>
          <div 
            onClick={() => setUseDirectMode(!useDirectMode)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '20px',
              background: useDirectMode ? 'rgba(0,184,148,0.1)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${useDirectMode ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
              transition: 'all 0.3s'
            }}
          >
            <div style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              background: useDirectMode ? 'var(--primary)' : 'var(--text-muted)' 
            }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: useDirectMode ? 'white' : 'var(--text-muted)' }}>
              DIRECT MODE {useDirectMode ? 'ON' : 'OFF'}
            </span>
          </div>
          {!useDirectMode && (
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, maxWidth: '200px' }}>
              Using Proxy Rotation. Turn ON for 10x speed (CORS extension req).
            </p>
          )}
        </div>

        {/* Reliability Help Card */}
        {step === 'idle' && !isProcessing && (
          <div className="glass" style={{ 
            marginTop: '30px', 
            padding: '15px', 
            background: 'rgba(255,165,0,0.05)', 
            border: '1px dashed rgba(255,165,0,0.3)',
            borderRadius: '15px'
          }}>
            <p style={{ fontSize: '0.8rem', color: '#ffa500', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={14} />
              <span>Connection Reset? Public proxies can be unstable. For 100% reliability, install <b>"Allow CORS"</b> extension and enable <b>Direct Mode</b>.</span>
            </p>
          </div>
        )}

        {/* Snapshot Selection Overlay */}
        {showSnapshotSelector && (
          <div className="glass" style={{ 
            marginTop: '30px', 
            padding: '20px', 
            background: 'var(--card-bg)', 
            border: '1px solid var(--primary)',
            animation: 'fadeIn 0.3s ease-out',
            position: 'relative',
            zIndex: 10
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} className="text-primary" />
              Select Archive Snapshot
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              We found {availableSnapshots.length} versions of <b>{domain}</b>. Choose one to start discovery.
            </p>
            
            <div style={{ 
              maxHeight: '300px', 
              overflowY: 'auto', 
              paddingRight: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {availableSnapshots.map((snap) => (
                <div 
                  key={snap.timestamp}
                  style={{ 
                    padding: '12px 15px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                  className="snapshot-row"
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{snap.readableDate}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{snap.timestamp}</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Preview Button */}
                    <a 
                      href={`https://web.archive.org/web/${snap.timestamp}/${domain.replace(/^https?:\/\//, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glass"
                      style={{ 
                        padding: '8px 12px', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        textDecoration: 'none',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    >
                      <Eye size={14} />
                      Preview
                    </a>

                    {/* Download Button */}
                    <button 
                      onClick={async () => {
                        setIsProcessing(true);
                        setShowSnapshotSelector(false);
                        const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
                        const results = await fetchCDXUrls(cleanDomain, snap.timestamp);
                        if (results && results.length > 0) {
                          setDiscoveredUrls(results);
                          setStep('discovered');
                        }
                      }}
                      className="glow-btn"
                      style={{ 
                        padding: '8px 15px', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}
                    >
                      <Download size={14} />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => {
                setShowSnapshotSelector(false);
                setIsProcessing(false);
              }}
              style={{ 
                marginTop: '20px', 
                width: '100%', 
                padding: '10px', 
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {(isProcessing && (step === 'discovery' || step === 'downloading' || step === 'zipping')) || step === 'complete' || step === 'discovered' ? (
          <div style={{ marginTop: '30px' }}>
            {step === 'discovered' ? (
              <div className="discovery-results">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Results: {discoveredUrls.length} files</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div className="glass" style={{ display: 'flex', padding: '4px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)' }}>
                      <button 
                        onClick={() => setViewMode('list')}
                        style={{ padding: '6px 12px', border: 'none', background: viewMode === 'list' ? 'var(--primary)' : 'transparent', color: viewMode === 'list' ? 'white' : 'var(--text-muted)', borderRadius: '7px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                      >
                        List
                      </button>
                      <button 
                        onClick={() => setViewMode('folder')}
                        style={{ padding: '6px 12px', border: 'none', background: viewMode === 'folder' ? 'var(--primary)' : 'transparent', color: viewMode === 'folder' ? 'white' : 'var(--text-muted)', borderRadius: '7px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                      >
                        Folder
                      </button>
                    </div>
                    <button 
                      className="glow-btn" 
                      onClick={startDownload}
                      style={{ padding: '8px 25px' }}
                    >
                      Start Download
                    </button>
                  </div>
                </div>

                {/* Category Tabs */}
                <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '5px' }}>
                  {(['All', 'Pages', 'Scripts', 'Styles', 'Assets'] as const).map(cat => {
                    const count = categories[cat](discoveredUrls).length;
                    return (
                      <button 
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: '0.75rem', 
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          background: activeCategory === cat ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                          color: activeCategory === cat ? 'white' : 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s'
                        }}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Manual Add Input */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input 
                      type="text" 
                      placeholder="Add URL (Smart) or Search to Delete..."
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      style={{ width: '100%', padding: '10px 40px 10px 12px', fontSize: '0.85rem' }}
                      disabled={isAddingManual}
                    />
                    {manualUrl && (
                      <button 
                        onClick={searchAndRemove}
                        style={{ 
                          position: 'absolute', 
                          right: '8px', 
                          top: '50%', 
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: '#ff4d4d',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        title="Search & Delete matching items"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                  <button 
                    className="glass" 
                    onClick={smartAddManualUrl}
                    disabled={isAddingManual || !manualUrl}
                    style={{ 
                      padding: '8px 15px', 
                      background: isAddingManual ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isAddingManual ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>SMART ADD</span>
                  </button>
                </div>

                <div className="log-container" style={{ maxHeight: '350px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px' }}>
                  {viewMode === 'list' ? (
                    <>
                      {categories[activeCategory](discoveredUrls).map((url, i) => (
                        <div key={i} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          fontSize: '0.8rem', 
                          padding: '8px 12px', 
                          borderBottom: '1px solid rgba(255,255,255,0.05)', 
                          color: 'var(--text-muted)' 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>#{i + 1}</span>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {url.original.replace(/^https?:\/\/[^/]+/, '') || '/index.html'}
                            </span>
                          </div>
                          <button 
                            onClick={() => removeUrl(url.original)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ff4d4d', padding: '4px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {categories[activeCategory](discoveredUrls).length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          No files in this category.
                        </div>
                      )}
                    </>
                  ) : (
                    <FileTreeItem node={buildFileTree(discoveredUrls)} depth={0} />
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '15px' }}>
                  <button 
                    onClick={() => {
                      const toRemove = categories[activeCategory](discoveredUrls).map(u => u.original);
                      setDiscoveredUrls(prev => prev.filter(u => !toRemove.includes(u.original)));
                      addLog(`Removed category: ${activeCategory}`, 'warning');
                    }}
                    style={{ background: 'rgba(255,77,77,0.1)', border: '1px solid #ff4d4d', color: '#ff4d4d', padding: '5px 15px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Clear {activeCategory}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {step === 'discovery' && '🔍 Discovering URLs...'}
                    {step === 'downloading' && '📥 Downloading Assets...'}
                    {step === 'zipping' && '📦 Packaging ZIP...'}
                    {step === 'complete' && '✅ Archive Ready!'}
                  </span>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{progress}%</span>
                </div>
                
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="log-container">
                  {logs.map((log, i) => (
                    <div key={i} className="log-entry" style={{ opacity: i === logs.length - 1 ? 1 : 0.7 }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '10px' }}>[{log.timestamp}]</span>
                      <span style={{ 
                        color: log.type === 'error' ? '#ff4d4d' : 
                               log.type === 'success' ? 'var(--primary)' : 
                               log.type === 'warning' ? '#ffcc00' : 'white' 
                      }}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div className="glass" style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }}>
              <Globe style={{ color: 'var(--primary)', marginBottom: '10px' }} />
              <h3 style={{ fontSize: '0.9rem', marginBottom: '5px' }}>CDX Extraction</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lists every archived page known to Wayback.</p>
            </div>
            <div className="glass" style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }}>
              <Clock style={{ color: 'var(--secondary)', marginBottom: '10px' }} />
              <h3 style={{ fontSize: '0.9rem', marginBottom: '5px' }}>Snapshot Focus</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Downloads the specific snapshot you need.</p>
            </div>
            <div className="glass" style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }}>
              <Download style={{ color: '#fff', marginBottom: '10px' }} />
              <h3 style={{ fontSize: '0.9rem', marginBottom: '5px' }}>ZIP Packaging</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Maintains folder structure for offline browsing.</p>
            </div>
          </div>
        )}
      </div>

      <footer style={{ textAlign: 'center', marginTop: '30px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <p>Built for precision site recovery. Browser-based execution.</p>
      </footer>

      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default App;
