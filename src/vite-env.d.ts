/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_EXPLORER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

interface Window {
  ethereum?: EthereumProvider;
}
