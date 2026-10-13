import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { FormStateService } from './core/form-state.service';
import { UploadService } from './core/upload.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    {
      // Load the JSON schema (single source for both pages) and restore any saved draft before the UI starts.
      provide: APP_INITIALIZER,
      multi: true,
      deps: [FormStateService, UploadService],
      useFactory: (state: FormStateService, uploads: UploadService) => async () => {
        await state.init();
        if (state.schema()) {
          uploads.setDraft(state.draftId, state.schema()!.upload);
          await uploads.restore();
        }
      },
    },
  ],
};
