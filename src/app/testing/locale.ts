import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';

// Las pantallas formatean cifras y fechas con «es-CO»; en las pruebas hay que registrar sus datos.
registerLocaleData(localeEsCo);
