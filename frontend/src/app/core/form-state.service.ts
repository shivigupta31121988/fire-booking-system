import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Condition, Field, FormSchema } from './models';

const LS_DRAFT = 'ie.draftId';
const LS_VALUES = 'ie.draftValues';

/**
 * Holds ONE FormGroup for the whole schema (both pages). It lives in a root service, so values
 * stay in memory while the user moves between pages, and are mirrored to localStorage so a
 * browser refresh does not lose them. Cleared only after a successful submit.
 */
@Injectable({ providedIn: 'root' })
export class FormStateService {
  schema = signal<FormSchema | null>(null);
  loadError = signal<string | null>(null);
  form: FormGroup = new FormGroup({});
  draftId = '';

  constructor(private http: HttpClient) {}

  async init(): Promise<void> {
    try {
      const schema = await firstValueFrom(this.http.get<FormSchema>('/api/form-schema'));
      this.draftId = localStorage.getItem(LS_DRAFT) || this.newDraftId();
      localStorage.setItem(LS_DRAFT, this.draftId);
      this.buildForm(schema);
      this.schema.set(schema);
    } catch {
      this.loadError.set('Could not reach the server. Check that the backend is running on port 3000.');
    }
  }

  private newDraftId(): string {
    return (crypto as any).randomUUID ? crypto.randomUUID() : 'd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  private defaultFor(f: Field): any {
    if (f.default !== undefined) return f.default;
    if (f.type === 'checkbox') return false;
    if (f.type === 'checkboxGroup') return [];
    if (f.type === 'number') return null;
    return '';
  }

  private buildForm(schema: FormSchema): void {
    let saved: Record<string, any> = {};
    try { saved = JSON.parse(localStorage.getItem(LS_VALUES) || '{}'); } catch { saved = {}; }

    this.form = new FormGroup({});
    for (const page of schema.pages) {
      for (const f of page.fields) {
        if (f.type === 'file') continue; // files are handled by UploadService
        const initial = f.key in saved ? saved[f.key] : this.defaultFor(f);
        this.form.addControl(f.key, new FormControl(initial, this.makeValidator(f)));
      }
    }
    this.form.valueChanges.subscribe((v) => {
      try { localStorage.setItem(LS_VALUES, JSON.stringify(v)); } catch { /* storage full or blocked */ }
    });
  }

  // ---- conditional logic (same rules the backend applies) ----
  cond(c?: Condition): boolean {
    if (!c) return true;
    const v = this.form.get(c.field)?.value;
    if (c.equals !== undefined) return v === c.equals;
    if (c.in) return c.in.includes(v);
    return true;
  }
  isVisible(f: Field): boolean { return this.cond(f.visibleWhen); }
  isRequired(f: Field): boolean { return !!f.required || (f.requiredWhen ? this.cond(f.requiredWhen) : false); }

  private makeValidator(f: Field): ValidatorFn {
    return (c: AbstractControl): ValidationErrors | null => {
      if (!this.form || !this.form.get(f.key)) return null; // still constructing
      if (!this.isVisible(f)) return null;
      const v = c.value;
      const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) ||
        (f.type === 'checkbox' && v === false);
      if (empty) {
        return this.isRequired(f) ? { msg: f.type === 'checkbox' ? 'You must confirm to continue' : 'This field is required' } : null;
      }
      const val = f.validators || {};
      if (f.type === 'number') {
        if (typeof v !== 'number' || !isFinite(v)) return { msg: 'Enter a number' };
        if (val.min !== undefined && v < val.min) return { msg: `Must be at least ${val.min}` };
        if (val.max !== undefined && v > val.max) return { msg: `Must be at most ${val.max}` };
      }
      if (f.type === 'text' || f.type === 'textarea') {
        const s = String(v).trim();
        if (val.minLength !== undefined && s.length < val.minLength) return { msg: `Enter at least ${val.minLength} characters` };
        if (val.maxLength !== undefined && s.length > val.maxLength) return { msg: `Use at most ${val.maxLength} characters` };
        if (val.pattern && !new RegExp(val.pattern, 'i').test(s)) return { msg: val.patternMessage || 'This value is not valid' };
      }
      if (f.type === 'date' && val.minDate === 'today') {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (String(v) < local) return { msg: val.minDateMessage || 'Date cannot be in the past' };
      }
      return null;
    };
  }

  // ---- page-level helpers ----
  fieldsOfPage(i: number): Field[] { return this.schema()?.pages[i]?.fields ?? []; }

  /** Re-runs validators for every field on a page and marks them touched. Returns true if valid. */
  validatePage(i: number): boolean {
    let ok = true;
    for (const f of this.fieldsOfPage(i)) {
      const c = this.form.get(f.key);
      if (!c) continue;
      c.updateValueAndValidity({ emitEvent: false });
      c.markAsTouched();
      if (c.invalid) ok = false;
    }
    return ok;
  }

  /** The JSON object sent to the backend. Only visible fields, the schema drives which. */
  buildPayload(documents: { id: string }[]): any {
    const schema = this.schema()!;
    const raw = this.form.getRawValue();
    const answers: Record<string, any> = {};
    for (const page of schema.pages) {
      for (const f of page.fields) {
        if (f.type === 'file' || f.type === 'readonly' || !this.isVisible(f)) continue;
        let v = raw[f.key];
        if (typeof v === 'string') v = v.trim();
        if (v === '' || v === null || v === undefined) continue;
        answers[f.key] = v;
      }
    }
    return {
      schemaVersion: schema.schemaVersion,
      product: schema.product,
      country: schema.country,
      currency: schema.currency,
      policyTermYears: schema.policyTermYears,
      draftId: this.draftId,
      answers,
      documents,
    };
  }

  /** Called after a successful submit: forget the draft. */
  clearDraft(): void {
    localStorage.removeItem(LS_VALUES);
    localStorage.removeItem(LS_DRAFT);
    const schema = this.schema();
    if (!schema) return;
    this.draftId = this.newDraftId();
    localStorage.setItem(LS_DRAFT, this.draftId);
    const defaults: Record<string, any> = {};
    schema.pages.forEach((p) => p.fields.forEach((f) => { if (f.type !== 'file') defaults[f.key] = this.defaultFor(f); }));
    this.form.reset(defaults, { emitEvent: false });
    localStorage.removeItem(LS_VALUES);
  }
}
