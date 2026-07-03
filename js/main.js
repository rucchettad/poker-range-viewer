/**
 * POKER RANGE VIEWER — Entry point
 * © 2026 pokerrange.online - Danilo Rucchetta
 */
'use strict';

import { initAuth, ripristinaSessione } from './auth.js';
import { initApp }   from './app.js';
import { initTools } from './tools.js';

initAuth();
initApp();
initTools();

window.addEventListener('DOMContentLoaded', ripristinaSessione);
