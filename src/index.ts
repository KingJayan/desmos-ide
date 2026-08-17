// public api

export * from './compile';

export { registerLanguage, LANGUAGE_ID, errorToMarker } from './monaco/language';
export type { DiagnosticMarker } from './monaco/language';
