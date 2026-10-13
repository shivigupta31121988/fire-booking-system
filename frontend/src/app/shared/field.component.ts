import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Field } from '../core/models';
import { FormStateService } from '../core/form-state.service';

@Component({
  selector: 'app-field',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @if (ctrl) {
      <div class="field" [class.has-error]="showError">
        @if (field.type === 'checkbox') {
          <label class="check single">
            <input type="checkbox" [formControl]="ctrl" />
            <span>{{ field.label }}</span>
          </label>
        } @else {
          <label class="label" [attr.for]="'f-' + field.key" [id]="'l-' + field.key">
            {{ field.label }}@if (state.isRequired(field)) {<span class="req" aria-hidden="true"> *</span>}
          </label>
        }

        @switch (field.type) {
          @case ('text') {
            <input class="input" type="text" [id]="'f-' + field.key" [formControl]="ctrl" [placeholder]="field.placeholder || ''"
                   [attr.autocomplete]="autocomplete" />
          }
          @case ('textarea') {
            <textarea class="input" rows="4" [id]="'f-' + field.key" [formControl]="ctrl"></textarea>
          }
          @case ('number') {
            <div class="affix">
              @if (field.prefix) { <span class="pre">{{ field.prefix }}</span> }
              <input class="input" type="number" inputmode="decimal" [id]="'f-' + field.key" [formControl]="ctrl" />
              @if (field.suffix) { <span class="suf">{{ field.suffix }}</span> }
            </div>
          }
          @case ('date') {
            <input class="input" type="date" [id]="'f-' + field.key" [formControl]="ctrl" />
          }
          @case ('select') {
            <select class="input" [id]="'f-' + field.key" [formControl]="ctrl">
              <option value="">{{ field.placeholder || 'Select' }}</option>
              @for (o of field.options; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
            </select>
          }
          @case ('radio') {
            <div class="choices" role="radiogroup" [attr.aria-labelledby]="'l-' + field.key">
              @for (o of field.options; track o.value) {
                <label class="check"><input type="radio" [value]="o.value" [formControl]="ctrl" /><span>{{ o.label }}</span></label>
              }
            </div>
          }
          @case ('checkboxGroup') {
            <div class="choices grid">
              @for (o of field.options; track o.value) {
                <label class="check">
                  <input type="checkbox" [checked]="has(o.value)" (change)="toggle(o.value, $event)" />
                  <span>{{ o.label }}</span>
                </label>
              }
            </div>
          }
          @case ('readonly') {
            <div class="readonly">{{ ctrl.value }}</div>
          }
        }

        @if (showError) { <div class="error" role="alert">{{ ctrl.errors?.['msg'] }}</div> }
        @else if (field.help) { <div class="help">{{ field.help }}</div> }
      </div>
    }
  `,
})
export class FieldComponent {
  @Input({ required: true }) field!: Field;
  constructor(public state: FormStateService) {}

  get ctrl(): FormControl | null { return this.state.form.get(this.field.key) as FormControl | null; }
  get showError(): boolean { return !!this.ctrl && this.ctrl.touched && this.ctrl.invalid; }
  get autocomplete(): string {
    return ({ email: 'email', phone: 'tel', applicantName: 'name', addressLine1: 'address-line1', addressLine2: 'address-line2', eircode: 'postal-code' } as any)[this.field.key] || 'off';
  }

  has(v: string): boolean { return ((this.ctrl?.value as string[]) || []).includes(v); }
  toggle(v: string, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    const cur: string[] = [...((this.ctrl?.value as string[]) || [])];
    const next = checked ? [...new Set([...cur, v])] : cur.filter((x) => x !== v);
    this.ctrl?.setValue(next);
    this.ctrl?.markAsTouched();
  }
}
