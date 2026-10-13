import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, switchMap, takeWhile, timer } from 'rxjs';
import { ApplicationService } from '../core/application.service';
import { ApplicationDto } from '../core/models';
import { eur, mb } from '../shared/format';

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="card">
      @if (app(); as a) {
        <h1>Application {{ a.reference }}</h1>
        <p class="lead">Saved to our database. Underwriters and actuaries are now checking your details.</p>

        @if (a.status === 'APPROVED') {
          <div class="banner ok" role="status">
            <strong>Approved</strong>
            <span>{{ a.decision?.decidedBy }}. Your {{ a.quote.termYears }}-year fire cover has been approved.</span>
          </div>
        } @else if (a.status === 'REFERRED') {
          <div class="banner warn" role="status">
            <strong>Referred to an underwriter</strong>
            <span>One or more checks need a person to review. We will contact you.</span>
          </div>
        } @else {
          <div class="banner wait" role="status"><strong>Checks in progress</strong><span>{{ done(a) }} of {{ a.jobs.length }} jobs complete</span></div>
        }

        <h2>Underwriting and actuarial jobs</h2>
        <ol class="jobs">
          @for (j of a.jobs; track j.key) {
            <li [class]="'job ' + j.status.toLowerCase()">
              <span class="dot" aria-hidden="true"></span>
              <div>
                <div class="job-title">{{ j.name }} <span class="owner">{{ j.owner }}</span></div>
                <div class="job-state">
                  {{ label(j.status) }}@if (j.durationMs) { in {{ (j.durationMs / 1000).toFixed(1) }} s }
                </div>
                @if (j.notes) { <div class="job-notes">{{ j.notes }}</div> }
              </div>
            </li>
          }
        </ol>

        @if (a.decision?.notes?.length) {
          <h2>{{ a.status === 'APPROVED' ? 'Conditions and notes' : 'Why it was referred' }}</h2>
          <ul class="plain">@for (n of a.decision!.notes; track $index) { <li>{{ n }}</li> }</ul>
        }

        <h2>Price</h2>
        <dl class="price">
          <div><dt>Per year</dt><dd>{{ eur(a.quote.annualPremium) }}</dd></div>
          <div><dt>{{ a.quote.termYears }}-year premium</dt><dd>{{ eur(a.quote.termPremium) }}</dd></div>
          <div><dt>Levy</dt><dd>{{ eur(a.quote.levy) }}</dd></div>
          <div class="total"><dt>Total payable</dt><dd>{{ eur(a.quote.totalPayable) }}</dd></div>
        </dl>

        @if (a.documents.length) {
          <h2>Your documents</h2>
          <ul class="plain">
            @for (d of a.documents; track d.fileId) {
              <li>
                {{ d.name }} ({{ size(d.size) }}, uploaded in {{ d.uploadSeconds }} s)
                <a [href]="'/api/files/' + d.fileId + '?inline=1'" target="_blank" rel="noopener">View</a>
                <a [href]="'/api/files/' + d.fileId">Download</a>
              </li>
            }
          </ul>
        }

        <div class="actions"><span class="spacer"></span><a class="btn secondary" routerLink="/page/1">Start another application</a></div>
      } @else if (error()) {
        <h1>Application not found</h1>
        <p class="lead">{{ error() }}</p>
        <a class="btn" routerLink="/page/1">Start a new application</a>
      } @else {
        <p class="lead">Loading</p>
      }
    </section>
  `,
})
export class ConfirmationComponent implements OnInit, OnDestroy {
  app = signal<ApplicationDto | null>(null);
  error = signal<string | null>(null);
  eur = eur;
  size = mb;
  private sub?: Subscription;

  constructor(private route: ActivatedRoute, private api: ApplicationService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    // Poll until the actuarial sign-off is done.
    this.sub = timer(0, 1500).pipe(
      switchMap(() => this.api.get(id)),
      takeWhile((a) => a.status !== 'APPROVED' && a.status !== 'REFERRED', true)
    ).subscribe({ next: (a) => this.app.set(a), error: () => this.error.set('We could not find that application.') });
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  done(a: ApplicationDto): number { return a.jobs.filter((j) => !['PENDING', 'RUNNING'].includes(j.status)).length; }
  label(s: string): string {
    return ({ PENDING: 'Waiting', RUNNING: 'Running', PASSED: 'Passed', WARN: 'Passed with condition', FAILED: 'Needs review' } as any)[s] || s;
  }
}
