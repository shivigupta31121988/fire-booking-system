import { Routes } from '@angular/router';
import { WizardPageComponent } from './pages/wizard-page.component';
import { ConfirmationComponent } from './pages/confirmation.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'page/1' },
  { path: 'page/:n', component: WizardPageComponent },
  { path: 'confirmation/:id', component: ConfirmationComponent },
  { path: '**', redirectTo: 'page/1' },
];
