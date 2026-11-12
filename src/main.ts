import './style.css';
import { iniciarAnuncios } from './platform';

document.body.classList.add(`obj-${__OBJETIVO__}`);

if (__OBJETIVO__ === 'web') {
  void import('./ui/web').then((m) => m.iniciarWeb());
} else {
  void import('./ui/app').then((m) => m.iniciarApp());
}

void iniciarAnuncios();
