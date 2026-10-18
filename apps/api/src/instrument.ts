// Primeiro import do main.ts: o Sentry precisa iniciar antes do Nest/Express
// para instrumentar HTTP e capturar falhas de inicialização.
import { initSentry } from "./monitoring/sentry";

initSentry();
