import { Component, Input } from '@angular/core';
import { Field } from '../core/models';
import { UploadService } from '../core/upload.service';
import { FormStateService } from '../core/form-state.service';
import { mb } from './format';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  template: `
    <div class="field" [class.has-error]="showError">
      <div class="label">{{ field.label }}@if (state.isRequired(field)) {<span class="req"> *</span>}</div>

      <div class="drop" [class.over]="over" (dragover)="$event.preventDefault(); over = true" (dragleave)="over = false"
           (drop)="onDrop($event)">
        <p>Drag files here or</p>
        <label class="btn secondary">
          Choose files
          <input type="file" multiple hidden [accept]="accept" (change)="onPick($event)" />
        </label>
        <p class="help">{{ field.help }} Up to {{ rules.maxFiles }} files, {{ rules.maxFileSizeMB }} MB each.</p>
      </div>

      @if (uploads.message()) { <div class="error" role="alert">{{ uploads.message() }}</div> }
      @if (showError) { <div class="error" role="alert">Upload at least one document</div> }

      @if (uploads.items().length) {
        <ul class="files">
          @for (f of uploads.items(); track f.localId) {
            <li [class.err]="f.status === 'error'">
              <div class="row">
                <span class="name">{{ f.name }}</span>
                <span class="meta">{{ size(f.size) }}</span>
                <button type="button" class="link" (click)="uploads.remove(f.localId)">
                  {{ f.status === 'uploading' ? 'Cancel' : 'Remove' }}
                </button>
              </div>
              @if (f.status === 'uploading') {
                <div class="bar"><div class="fill" [style.width.%]="f.progress"></div></div>
                <div class="meta">{{ f.progress }}% &nbsp;|&nbsp; {{ f.elapsedSec.toFixed(1) }} s elapsed @if (f.speedKBps) { &nbsp;|&nbsp; {{ f.speedKBps }} KB/s }</div>
              }
              @if (f.status === 'done') {
                <div class="meta ok">Uploaded in {{ f.uploadSeconds?.toFixed(1) }} seconds</div>
              }
              @if (f.status === 'error') {
                <div class="meta bad">{{ f.error }} ({{ f.elapsedSec.toFixed(1) }} s)</div>
              }
            </li>
          }
        </ul>
        @if (uploads.activeCount() > 0) {
          <p class="help">You can go back to page 1 or carry on. Uploads keep running in the background.</p>
        }
      }
    </div>
  `,
})
export class FileUploadComponent {
  @Input({ required: true }) field!: Field;
  over = false;
  touched = false;
  constructor(public uploads: UploadService, public state: FormStateService) {}

  get rules() { return this.state.schema()!.upload; }
  get accept() { return this.rules.accept.join(','); }
  get showError() { return this.touched && this.state.isRequired(this.field) && this.uploads.doneItems().length === 0 && this.uploads.activeCount() === 0; }
  size = mb;

  /** Called by the page when the user tries to continue. */
  markTouched(): void { this.touched = true; }

  onPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.files) this.uploads.add(input.files);
    input.value = '';
  }
  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.over = false;
    if (ev.dataTransfer?.files) this.uploads.add(ev.dataTransfer.files);
  }
}
