import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { FormStateService } from './core/form-state.service';
import { UploadService } from './core/upload.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <header class="top">
      <div class="wrap">
        <div class="brand">
          <span class="mark" aria-hidden="true"></span>
          <span>{{ state.schema()?.title || 'Building fire insurance' }}</span>
        </div>
        <span class="tag">Ireland | EUR</span>
      </div>
    </header>

    <main class="wrap">
      @if (state.loadError(); as err) {
        <section class="card"><h1>Service unavailable</h1><p class="lead">{{ err }}</p></section>
      } @else {
        <router-outlet />
      }
    </main>

    <!-- Background upload tray: visible on any page except the one that already shows uploads -->
    @if (uploads.activeCount() > 0 && !onUploadPage()) {
      <aside class="tray" aria-live="polite">
        <strong>Uploading {{ uploads.activeCount() }} file(s)</strong>
        @for (f of uploads.items(); track f.localId) {
          @if (f.status === 'uploading') {
            <div class="tray-row">
              <span class="name">{{ f.name }}</span>
              <span class="meta">{{ f.progress }}% | {{ f.elapsedSec.toFixed(1) }} s</span>
              <div class="bar"><div class="fill" [style.width.%]="f.progress"></div></div>
            </div>
          }
        }
      </aside>
    }
  `,
})
export class AppComponent {
  constructor(public state: FormStateService, public uploads: UploadService, private router: Router) {}

  onUploadPage(): boolean {
    const pages = this.state.schema()?.pages ?? [];
    const i = pages.findIndex((p) => p.fields.some((f) => f.type === 'file'));
    return i >= 0 && this.router.url.startsWith('/page/' + (i + 1));
  }
}
