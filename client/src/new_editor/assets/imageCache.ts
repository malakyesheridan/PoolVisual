// LRU Image Cache for Asset Library
// Separate caches for full images and thumbnails

import { ImageCacheEntry } from './types';

interface CacheNode {
  key: string;
  value: ImageCacheEntry;
  prev: CacheNode | null;
  next: CacheNode | null;
}

class LRUImageCache {
  private capacity: number;
  private cache: Map<string, CacheNode>;
  private head: CacheNode;
  private tail: CacheNode;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    
    // Create dummy head and tail nodes
    this.head = { key: '', value: {} as ImageCacheEntry, prev: null, next: null };
    this.tail = { key: '', value: {} as ImageCacheEntry, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  private addNode(node: CacheNode): void {
    // Add after head
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: CacheNode): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private moveToHead(node: CacheNode): void {
    this.removeNode(node);
    this.addNode(node);
  }

  private popTail(): CacheNode {
    const lastNode = this.tail.prev!;
    this.removeNode(lastNode);
    return lastNode;
  }

  get(key: string): ImageCacheEntry | null {
    const node = this.cache.get(key);
    if (node) {
      this.moveToHead(node);
      return node.value;
    }
    return null;
  }

  set(key: string, value: ImageCacheEntry): void {
    const node = this.cache.get(key);
    
    if (node) {
      // Update existing node
      node.value = value;
      this.moveToHead(node);
    } else {
      // Add new node
      const newNode: CacheNode = {
        key,
        value,
        prev: null,
        next: null
      };
      
      this.cache.set(key, newNode);
      this.addNode(newNode);
      
      // Evict if over capacity
      if (this.cache.size > this.capacity) {
        const tail = this.popTail();
        this.cache.delete(tail.key);
      }
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (node) {
      this.removeNode(node);
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { hits: number; misses: number; evictions: number } {
    // This would need to be implemented with counters if we want detailed stats
    return { hits: 0, misses: 0, evictions: 0 };
  }
}

// Image loading utility
export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    
    img.src = src;
  });
}

// Cache instances
export const imageCacheFull = new LRUImageCache(64);   // 64 full images
export const imageCacheThumb = new LRUImageCache(128); // 128 thumbnails

// Cache management functions
export async function getCachedImage(
  key: string, 
  src: string, 
  cache: LRUImageCache
): Promise<ImageCacheEntry> {
  // Check cache first
  const cached = cache.get(key);
  if (cached && cached.status === 'ready') {
    return cached;
  }

  // If loading or not in cache, start loading
  if (!cached || cached.status === 'error') {
    const entry: ImageCacheEntry = {
      img: new Image(),
      w: 0,
      h: 0,
      status: 'loading'
    };
    
    cache.set(key, entry);
    
    try {
      const img = await loadImage(src);
      entry.img = img;
      entry.w = img.naturalWidth;
      entry.h = img.naturalHeight;
      entry.status = 'ready';
      
      cache.set(key, entry);
      return entry;
    } catch (error) {
      entry.status = 'error';
      cache.set(key, entry);
      throw error;
    }
  }

  // Return loading entry
  return cached;
}

export function preloadImage(src: string): Promise<HTMLImageElement> {
  return loadImage(src);
}

export function clearImageCache(): void {
  imageCacheFull.clear();
  imageCacheThumb.clear();
}

// Export cache instances for stats
export { LRUImageCache };
