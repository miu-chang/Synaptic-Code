/**
 * Synaptic API Server
 * Provides OpenAI-compatible API for remote access to local LLMs
 */
import http from 'http';
export interface ApiKey {
    key: string;
    name: string;
    created: string;
    lastUsed?: string;
    usageTokens: number;
}
export interface ServerConfig {
    port: number;
    host: string;
    lmStudioUrl: string;
    corsOrigins: string[];
}
/**
 * Generate a new API key
 */
export declare function generateApiKey(name: string): ApiKey;
/**
 * List all API keys (hashed for display)
 */
export declare function listApiKeys(): Array<Omit<ApiKey, 'key'> & {
    keyPreview: string;
}>;
/**
 * Revoke an API key by preview
 */
export declare function revokeApiKey(keyPreview: string): boolean;
/**
 * Create and start the API server
 */
export declare function createServer(config?: Partial<ServerConfig>): http.Server;
/**
 * Start the server
 */
export declare function startServer(config?: Partial<ServerConfig>): Promise<{
    server: http.Server;
    address: string;
    port: number;
}>;
//# sourceMappingURL=index.d.ts.map