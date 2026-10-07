import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { aApiError } from './api-error';

export const erroresInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) =>
      from(aApiError(error)).pipe(switchMap((apiError) => throwError(() => apiError))),
    ),
  );
