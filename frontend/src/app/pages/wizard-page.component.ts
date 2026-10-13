import { Component, OnInit, ViewChild, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormStateService } from '../core/form-state.service';
import { UploadService } from '../core/upload.service';
import { ApplicationService } from '../core/application.service';
import { Quote } from '../core/models';
import { FieldComponent } from '../shared/field.component';
import { FileUploadComponent } from '../shared/file-upload.component';
import { eur } from '../shared/format';

@Component({
  selector: 'app-wizard-page',
  standalone: true,
  imports: [FieldComponent, FileUploadComponent],
  template: `
    @if (page(); as p) {
      <nav class="steps" aria-label="Progress">
        @for (s of state.schema()!.pages; track s.id; let i = $index) {
          <button type="button" class="step" [class.current]="i === idx()" (click)="go(i)">
            <span class="n">{{ i + 1 }}</span> {{ s.title }}
          </button>
        }
      </nav>

      <section class="card">
        <h1>{{ p.title }}</h1>
        @if (p.description) { <p class="lead">{{ p.description }}</p> }

        <div class="grid-form">
          @for (f of p.fields; track f.key) {
            @if (state.isVisible(f)) {
              <div class="cell" [class.w-full]="f.width === 'full' || !f.width" [class.w-half]="f.width === 'half'" [class.w-third]="f.width === 'third'">
                @if (f.type === 'file') { <app-file-upload [field]="f" /> }
                @else { <app-field [field]="f" /> }
              </div>
            }
          }
        </div>

        @if (isLast()) {
          <div class="quote">
            <div class="quote-head">
              <h2>Indicative price</h2>
              <button type="button" class="link" (click)="loadQuote()">Recalculate</button>
            </div>
            @if (quote(); as q) {
              <dl>
                <div><dt>Per year</dt><dd>{{ eur(q.annualPremium) }}</dd></div>
                <div><dt>{{ q.termYears }}-year premium</dt><dd>{{ eur(q.termPremium) }}</dd></div>
                <div><dt>Levy ({{ q.levyRate * 100 }}%)</dt><dd>{{ eur(q.levy) }}</dd></div>
                <div class="total"><dt>Total payable</dt><dd>{{ eur(q.totalPayable) }}</dd></div>
              </dl>
              <p class="help">{{ q.note }}</p>
            } @else if (quoteMsg()) {
              <p class="help">{{ quoteMsg() }}</p>
            }
          </div>
        }

        @if (serverErrors().length) {
          <div class="alert" role="alert">
            <strong>Fix these before submitting</strong>
            <ul>@for (e of serverErrors(); track $index) { <li>{{ e }}</li> }</ul>
          </div>
        }

        <div class="actions">
          @if (idx() > 0) { <button type="button" class="btn secondary" (click)="back()">Back</button> }
          <span class="spacer"></span>
          @if (!isLast()) {
            <button type="button" class="btn" (click)="next()">Continue to {{ nextTitle() }}</button>
          } @else {
            <button type="button" class="btn" [disabled]="submitting()" (click)="submit()">
              {{ submitting() ? 'Submitting' : 'Submit application' }}
            </button>
          }
        </div>
        @if (isLast() && uploads.activeCount() > 0) {
          <p class="help right">{{ uploads.activeCount() }} upload(s) still running. Submit unlocks when they finish.</p>
        }
      </section>
    }
  `,
})
export class WizardPageComponent implements OnInit {
  idx = signal(0);
  quote = signal<Quote | null>(null);
  quoteMsg = signal<string | null>(null);
  serverErrors = signal<string[]>([]);
  submitting = signal(false);
  eur = eur;

  @ViewChild(FileUploadComponent) uploader?: FileUploadComponent;

  page = computed(() => this.state.schema()?.pages[this.idx()] ?? null);
  isLast = computed(() => this.idx() === (this.state.schema()?.pages.length ?? 1) - 1);
  nextTitle = computed(() => this.state.schema()?.pages[this.idx() + 1]?.title.toLowerCase() ?? '');

  constructor(
    public state: FormStateService,
    public uploads: UploadService,
    private api: ApplicationService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      const last = (this.state.schema()?.pages.length ?? 1) - 1;
      const n = Math.min(Math.max((Number(p.get('n')) || 1) - 1, 0), last);
      this.idx.set(n);
      this.serverErrors.set([]);
      window.scrollTo({ top: 0 });
      if (n === last) this.loadQuote();
    });
  }

  go(i: number): void { this.router.navigate(['/page', i + 1]); } // navigation never clears data
  back(): void { this.go(this.idx() - 1); }

  next(): void {
    if (!this.state.validatePage(this.idx())) { this.focusFirstError(); return; }
    this.go(this.idx() + 1);
  }

  loadQuote(): void {
    this.quote.set(null);
    this.quoteMsg.set('Calculating');
    this.api.quote(this.state.buildPayload([])).subscribe({
      next: (q) => { this.quote.set(q); this.quoteMsg.set(null); },
      error: (e) => this.quoteMsg.set(e.status === 422 ? 'Complete page 1 to see an indicative price.' : 'Price is not available right now.'),
    });
  }

  submit(): void {
    this.serverErrors.set([]);
    // validate every page, jump to the first with problems
    const schema = this.state.schema()!;
    for (let i = 0; i < schema.pages.length; i++) {
      if (!this.state.validatePage(i)) { if (i !== this.idx()) this.go(i); else this.focusFirstError(); return; }
    }
    this.uploader?.markTouched();
    const docs = this.uploads.doneItems().map((u) => ({ id: u.serverId! }));
    const fileField = schema.pages.flatMap((p) => p.fields).find((f) => f.type === 'file');
    if (this.uploads.activeCount() > 0) { this.serverErrors.set(['Wait for uploads to finish.']); return; }
    if (fileField && this.state.isRequired(fileField) && docs.length === 0) { this.serverErrors.set(['Upload at least one document.']); return; }

    this.submitting.set(true);
    // The whole JSON object goes to the backend; all business logic runs there.
    this.api.submit(this.state.buildPayload(docs)).subscribe({
      next: (res) => {
        this.state.clearDraft();
        this.uploads.clear();
        this.submitting.set(false);
        this.router.navigate(['/confirmation', res.id]);
      },
      error: (e) => {
        this.submitting.set(false);
        const list = e.error?.errors as { message: string }[] | undefined;
        this.serverErrors.set(list ? list.map((x) => x.message) : [e.error?.error || 'Submission failed. Try again.']);
      },
    });
  }

  private focusFirstError(): void {
    setTimeout(() => document.querySelector('.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  }
}
