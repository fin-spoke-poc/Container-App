declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  platform: string;
};

declare const console: {
  log(message?: unknown, ...optionalParams: unknown[]): void;
};

declare class Buffer extends Uint8Array {
  static from(data: string | ArrayLike<number>): Buffer;
  static concat(chunks: readonly Uint8Array[]): Buffer;
  static isBuffer(value: unknown): value is Buffer;
  toString(encoding?: string): string;
}

declare module "node:crypto" {
  export function randomUUID(): string;
  export function createHash(algorithm: string): {
    update(data: string | Uint8Array): { digest(encoding: string): string };
  };
}

declare module "node:fs/promises" {
  export function mkdir(path: string | URL, options?: { recursive?: boolean }): Promise<void>;
  export function readFile(path: string | URL, encoding: string): Promise<string>;
  export function rm(path: string | URL, options?: { force?: boolean; recursive?: boolean }): Promise<void>;
  export function writeFile(path: string | URL, data: string, encoding?: string): Promise<void>;
}

declare module "node:child_process" {
  export function spawn(
    command: string,
    args?: string[],
    options?: { shell?: boolean; stdio?: string },
  ): {
    once(event: "error", listener: (error: Error) => void): void;
    once(event: "close", listener: (code: number | null) => void): void;
  };
}

declare module "node:events" {
  export function once(target: { once(event: string, listener: (...args: unknown[]) => void): void }, event: string): Promise<unknown[]>;
}

declare module "node:net" {
  export interface AddressInfo {
    address: string;
    family: string;
    port: number;
  }
}

declare module "node:http" {
  export interface IncomingMessage extends AsyncIterable<Uint8Array | string> {
    headers: Record<string, string | undefined>;
    method?: string;
    url?: string;
  }

  export interface ServerResponse {
    writeHead(statusCode: number, headers?: Record<string, string>): void;
    end(chunk?: string): void;
  }

  export interface Server {
    address(): unknown;
    close(): void;
    listen(port: number, callback?: () => void): void;
    once(event: string, listener: (...args: unknown[]) => void): void;
  }

  export function createServer(
    handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>,
  ): Server;
}

declare module "node:assert/strict" {
  const assert: {
    deepEqual(actual: unknown, expected: unknown): void;
    equal(actual: unknown, expected: unknown): void;
    ok(value: unknown): void;
  };

  export default assert;
}

declare module "node:test" {
  export interface TestContext {
    after(callback: () => void): void;
  }

  export default function test(name: string, fn: (context: TestContext) => void | Promise<void>): void;
}