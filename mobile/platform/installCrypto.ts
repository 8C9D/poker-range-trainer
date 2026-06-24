import { installCryptoRandomUUID } from './cryptoShim';

// Side-effect import: installs the Hermes crypto.randomUUID polyfill the moment
// this module is imported. Imported right after the storage installer in
// app/_layout.tsx so @core id generation has a real-UUID source before any
// screen or @core call runs.
installCryptoRandomUUID();
