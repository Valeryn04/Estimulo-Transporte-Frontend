import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeEsCo from '@angular/common/locales/es-CO';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { erroresInterceptor } from './core/api/errores.interceptor';
import { authInterceptor } from './core/auth/auth.interceptor';
import { routes } from './app.routes';

registerLocaleData(localeEsCo);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Autenticación del portal interno y manejo centralizado de errores (el orden importa: la
    // autenticación necesita ver el error ya convertido en ApiError).
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, erroresInterceptor])),
    { provide: LOCALE_ID, useValue: 'es-CO' },
  ],
};
