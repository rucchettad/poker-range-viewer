/**
 * POKER RANGE VIEWER — Entry point
 * © 2026 pokerrange.online - Danilo Rucchetta
 */
'use strict';

import { initAuth, ripristinaSessione } from './auth.js?v=20260703c';
import { initApp }   from './app.js?v=20260703c';
import { initTools } from './tools.js?v=20260703c';

initAuth();
initApp();
initTools();

window.addEventListener('DOMContentLoaded', ripristinaSessione);
