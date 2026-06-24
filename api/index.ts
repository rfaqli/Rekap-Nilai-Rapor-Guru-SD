// Point directly to the bundled CommonJS server to avoid Node.js ESM extension errors in Vercel
// @ts-ignore - The bundle is generated at build time
import serverModule from '../dist/server.cjs';

const app = serverModule.default || serverModule;

export default app;
