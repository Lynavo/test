import { getAppConfig } from './app-config-service';

export async function getSuggestedPublicWakeHost(): Promise<string | null> {
  try {
    const config = await getAppConfig();
    const host = config.network.callerPublicIp;
    console.log(
      `[public-wake] suggested public host ${
        host ? `resolved host=${host}` : 'unavailable'
      }`,
    );
    return host;
  } catch (error) {
    console.warn('[public-wake] failed to resolve suggested public host', error);
    return null;
  }
}
