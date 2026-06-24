import type { VercelRequest, VercelResponse } from '@vercel/node';

let appHandler: ((req: any, res: any) => void) | null = null;

async function getApp() {
  if (!appHandler) {
    const { default: app } = await import('../src/serverApp');
    appHandler = app;
  }
  return appHandler;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error: any) {
    console.error('[Vercel Handler] Fatal error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
}

