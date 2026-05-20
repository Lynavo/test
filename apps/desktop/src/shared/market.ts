export function isGlobalMarket(): boolean {
  return process.env.SYNCFLOW_MARKET === 'global';
}

export function getProductName(): string {
  return isGlobalMarket() ? 'SyncFlow' : 'Vivi Drop';
}
