import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { UploadItem, UploadRules } from './models';

/**
 * Root-level service, so uploads keep running in the background while the user moves between
 * pages. Each file is its own request, so every file has its own progress and "seconds taken".
 */
@Injectable({ providedIn: 'root' })
export class UploadService {
  items = signal<UploadItem[]>([]);
  message = signal<string | null>(null);
  activeCount = computed(() => this.items().filter((i) => i.status === 'uploading').length);
  doneItems = computed(() => this.items().filter((i) => i.status === 'done'));

  private draftId = '';
  private rules: UploadRules = { maxFileSizeMB: 200, maxFiles: 10, accept: [] };
  private xhrs = new Map<string, XMLHttpRequest>();
  private timer: any = null;

  constructor(private http: HttpClient) {}

  setDraft(draftId: string, rules: UploadRules): void { this.draftId = draftId; this.rules = rules; }

  /** Re-load files already uploaded for this draft (after a browser refresh). */
  async restore(): Promise<void> {
    try {
      const list = await firstValueFrom(this.http.get<any[]>(`/api/uploads?draftId=${this.draftId}`));
      this.items.set(list.map((f) => ({
        localId: f.id, serverId: f.id, name: f.name, size: f.size, status: 'done' as const,
        progress: 100, elapsedSec: f.uploadSeconds ?? 0, uploadSeconds: f.uploadSeconds, startedAt: 0,
      })));
    } catch { /* offline: nothing to restore */ }
  }

  add(files: FileList | File[]): void {
    this.message.set(null);
    for (const file of Array.from(files)) {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      if (this.rules.accept.length && !this.rules.accept.includes(ext)) {
        this.message.set(`${file.name}: ${ext} files are not accepted. Allowed: ${this.rules.accept.join(', ')}`); continue;
      }
      if (file.size > this.rules.maxFileSizeMB * 1048576) {
        this.message.set(`${file.name} is larger than ${this.rules.maxFileSizeMB} MB`); continue;
      }
      if (this.items().filter((i) => i.status !== 'error').length >= this.rules.maxFiles) {
        this.message.set(`You can upload up to ${this.rules.maxFiles} files`); break;
      }
      this.start(file);
    }
  }

  private patch(id: string, p: Partial<UploadItem>): void {
    this.items.update((l) => l.map((i) => (i.localId === id ? { ...i, ...p } : i)));
  }

  private start(file: File): void {
    const localId = 'u-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const startedAt = Date.now();
    this.items.update((l) => [...l, {
      localId, name: file.name, size: file.size, status: 'uploading', progress: 0, elapsedSec: 0, startedAt,
    }]);

    const xhr = new XMLHttpRequest();
    this.xhrs.set(localId, xhr);
    xhr.open('POST', `/api/uploads?draftId=${encodeURIComponent(this.draftId)}`);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const secs = Math.max((Date.now() - startedAt) / 1000, 0.1);
      this.patch(localId, { progress: Math.round((e.loaded / e.total) * 100), speedKBps: Math.round(e.loaded / 1024 / secs) });
    };
    xhr.onload = () => {
      this.xhrs.delete(localId);
      const seconds = Math.round(((Date.now() - startedAt) / 1000) * 10) / 10;
      if (xhr.status === 201) {
        const body = JSON.parse(xhr.responseText);
        this.patch(localId, { status: 'done', progress: 100, elapsedSec: seconds, uploadSeconds: seconds, serverId: body.id });
      } else {
        let msg = 'Upload failed';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* keep default */ }
        this.patch(localId, { status: 'error', error: msg, elapsedSec: seconds });
      }
    };
    xhr.onerror = () => { this.xhrs.delete(localId); this.patch(localId, { status: 'error', error: 'Network error' }); };

    const body = new FormData();
    body.append('file', file, file.name);
    xhr.send(body);
    this.ensureTimer();
  }

  /** Ticks a live seconds counter for every file still uploading. */
  private ensureTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      this.items.update((l) => l.map((i) => (i.status === 'uploading' ? { ...i, elapsedSec: Math.round(((now - i.startedAt) / 1000) * 10) / 10 } : i)));
      if (this.activeCount() === 0) { clearInterval(this.timer); this.timer = null; }
    }, 200);
  }

  /** Cancel an upload in progress, or delete a finished one. */
  async remove(localId: string): Promise<void> {
    const item = this.items().find((i) => i.localId === localId);
    if (!item) return;
    const xhr = this.xhrs.get(localId);
    if (xhr) { xhr.abort(); this.xhrs.delete(localId); }
    if (item.status === 'done' && item.serverId) {
      try { await firstValueFrom(this.http.delete(`/api/uploads/${item.serverId}`)); } catch { /* already gone */ }
    }
    this.items.update((l) => l.filter((i) => i.localId !== localId));
  }

  clear(): void { this.items.set([]); this.message.set(null); }
}
