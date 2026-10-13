export interface FieldOption { value: string; label: string; }
export interface Condition { field: string; equals?: any; in?: any[]; }
export interface Field {
  key: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'checkbox' | 'checkboxGroup' | 'file' | 'readonly';
  label: string;
  required?: boolean;
  requiredWhen?: Condition;
  visibleWhen?: Condition;
  placeholder?: string;
  help?: string;
  prefix?: string;
  suffix?: string;
  options?: FieldOption[];
  default?: any;
  transform?: 'uppercase';
  width?: 'full' | 'half' | 'third';
  validators?: {
    pattern?: string; patternMessage?: string; min?: number; max?: number;
    minLength?: number; maxLength?: number; minDate?: 'today'; minDateMessage?: string;
  };
}
export interface Page { id: string; title: string; description?: string; fields: Field[]; }
export interface UploadRules { maxFileSizeMB: number; maxFiles: number; accept: string[]; }
export interface FormSchema {
  schemaVersion: string; product: string; title: string; subtitle?: string; country: string;
  currency: string; locale: string; policyTermYears: number; upload: UploadRules; pages: Page[];
}

export interface Quote {
  currency: string; termYears: number; annualPremium: number; termPremium: number;
  levyRate: number; levy: number; totalPayable: number; note: string;
}

export interface UploadItem {
  localId: string;
  name: string;
  size: number;
  status: 'uploading' | 'done' | 'error';
  progress: number;      // 0..100
  elapsedSec: number;    // live while uploading
  uploadSeconds?: number; // final seconds taken
  speedKBps?: number;
  serverId?: string;
  error?: string;
  startedAt: number;
}

export interface JobState {
  key: string; name: string; owner: string;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'WARN' | 'FAILED';
  durationMs?: number; notes?: string;
}
export interface ApplicationDto {
  _id: string; reference: string; status: 'SUBMITTED' | 'UNDERWRITING' | 'APPROVED' | 'REFERRED';
  quote: Quote; jobs: JobState[];
  documents: { fileId: string; name: string; size: number; uploadSeconds: number }[];
  decision?: { outcome: string; decidedBy: string; notes: string[] };
}
