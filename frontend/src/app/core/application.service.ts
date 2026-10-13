import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApplicationDto, Quote } from './models';

@Injectable({ providedIn: 'root' })
export class ApplicationService {
  constructor(private http: HttpClient) {}
  quote(payload: any) { return this.http.post<Quote>('/api/applications/quote', payload); }
  submit(payload: any) { return this.http.post<{ id: string; reference: string; quote: Quote }>('/api/applications', payload); }
  get(id: string) { return this.http.get<ApplicationDto>(`/api/applications/${id}`); }
}
