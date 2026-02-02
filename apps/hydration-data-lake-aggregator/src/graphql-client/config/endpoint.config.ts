import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import {
  EndpointConfig,
  NormalizedEndpointConfig,
  MultiEndpointConfig,
} from '../types/endpoint.types';

const logger = new Logger('EndpointConfig');

/**
 * Parse pipe-separated endpoint configuration
 * Expected format: "FROM|TO|URL" on each line
 * Example:
 *   4000001|4500000|https://endpoint1.com/graphql
 *   4500001|5000000|https://endpoint2.com/graphql
 *
 * @param configString - Pipe-separated endpoint configuration
 * @returns Parsed array of endpoint configurations
 */
export function parsePipeSeparatedEndpoints(
  configString: string,
): EndpointConfig[] {
  const endpoints: EndpointConfig[] = [];

  // Split by newlines and filter empty lines
  const lines = configString
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split('|').map((p) => p.trim());

    if (parts.length !== 3) {
      throw new Error(
        `Invalid endpoint format at line ${i + 1}: expected "FROM_BLOCK|TO_BLOCK|URL", got "${line}"`,
      );
    }

    const [fromBlockStr, toBlockStr, apiUrl] = parts;
    const fromBlockHeight = parseInt(fromBlockStr, 10);
    const toBlockHeight =
      toBlockStr === '-1' || toBlockStr === 'HEAD'
        ? -1
        : parseInt(toBlockStr, 10);

    if (isNaN(fromBlockHeight)) {
      throw new Error(
        `Invalid fromBlockHeight at line ${i + 1}: "${fromBlockStr}" is not a valid number`,
      );
    }

    if (isNaN(toBlockHeight)) {
      throw new Error(
        `Invalid toBlockHeight at line ${i + 1}: "${toBlockStr}" must be a number or "-1"`,
      );
    }

    if (!apiUrl || !apiUrl.startsWith('http')) {
      throw new Error(
        `Invalid URL at line ${i + 1}: "${apiUrl}" must be a valid HTTP(S) URL`,
      );
    }

    endpoints.push({
      fromBlockHeight,
      toBlockHeight,
      apiUrl,
    });
  }

  return endpoints;
}

/**
 * Parse endpoint configuration from JSON string
 * Expected format: '[{"fromBlockHeight":4000001,"toBlockHeight":4500000,"apiUrl":"https://..."}]'
 *
 * @param configString - JSON string containing array of endpoint configurations
 * @returns Parsed array of endpoint configurations
 * @throws Error if JSON parsing fails or format is invalid
 */
export function parseEndpointConfig(configString: string): EndpointConfig[] {
  // Auto-detect format: if starts with '[' or '{' it's JSON, otherwise pipe-separated
  const trimmed = configString.trim();

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    // JSON format
    try {
      const parsed = JSON.parse(configString);

      if (!Array.isArray(parsed)) {
        throw new Error('Endpoint configuration must be a JSON array');
      }

      return parsed.map((item, index) => {
        if (
          typeof item.apiUrl !== 'string' ||
          typeof item.fromBlockHeight !== 'number' ||
          typeof item.toBlockHeight !== 'number'
        ) {
          throw new Error(
            `Invalid endpoint configuration at index ${index}: missing or invalid fields (apiUrl, fromBlockHeight, toBlockHeight)`,
          );
        }

        return {
          apiUrl: item.apiUrl,
          fromBlockHeight: item.fromBlockHeight,
          toBlockHeight: item.toBlockHeight,
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to parse JSON endpoint configuration: ${error.message}`,
      );
    }
  } else {
    // Pipe-separated format
    try {
      return parsePipeSeparatedEndpoints(configString);
    } catch (error) {
      throw new Error(
        `Failed to parse pipe-separated endpoint configuration: ${error.message}`,
      );
    }
  }
}

/**
 * Normalize endpoint configuration by converting -1 to Number.MAX_SAFE_INTEGER
 * and tracking which endpoints represent the "head"
 *
 * @param endpoints - Array of endpoint configurations
 * @returns Normalized endpoint configurations
 */
export function normalizeEndpointConfig(
  endpoints: EndpointConfig[],
): NormalizedEndpointConfig[] {
  return endpoints.map((endpoint) => ({
    apiUrl: endpoint.apiUrl,
    fromBlockHeight: endpoint.fromBlockHeight,
    toBlockHeight:
      endpoint.toBlockHeight === -1
        ? Number.MAX_SAFE_INTEGER
        : endpoint.toBlockHeight,
    isHeadEndpoint: endpoint.toBlockHeight === -1,
  }));
}

/**
 * Validate endpoint configurations for overlaps, gaps, and invalid ranges
 *
 * @param endpoints - Array of normalized endpoint configurations
 * @throws Error if overlapping ranges are detected or invalid ranges exist
 */
export function validateEndpointConfig(
  endpoints: NormalizedEndpointConfig[],
): void {
  if (endpoints.length === 0) {
    throw new Error('At least one endpoint must be configured');
  }

  // Sort endpoints by fromBlockHeight for easier validation
  const sortedEndpoints = [...endpoints].sort(
    (a, b) => a.fromBlockHeight - b.fromBlockHeight,
  );

  // Validate each endpoint
  for (const endpoint of sortedEndpoints) {
    // Check for negative block heights (except -1 for toBlockHeight which is already normalized)
    if (endpoint.fromBlockHeight < 0) {
      throw new Error(
        `Invalid fromBlockHeight ${endpoint.fromBlockHeight} for endpoint ${endpoint.apiUrl}: must be non-negative`,
      );
    }

    if (endpoint.toBlockHeight < 0) {
      throw new Error(
        `Invalid toBlockHeight ${endpoint.toBlockHeight} for endpoint ${endpoint.apiUrl}: must be non-negative or -1 for head`,
      );
    }

    // Check that fromBlockHeight <= toBlockHeight
    if (endpoint.fromBlockHeight > endpoint.toBlockHeight) {
      throw new Error(
        `Invalid block range for endpoint ${endpoint.apiUrl}: fromBlockHeight (${endpoint.fromBlockHeight}) must be <= toBlockHeight (${endpoint.toBlockHeight})`,
      );
    }
  }

  // Check for overlapping ranges
  for (let i = 0; i < sortedEndpoints.length - 1; i++) {
    const current = sortedEndpoints[i];
    const next = sortedEndpoints[i + 1];

    if (current.toBlockHeight >= next.fromBlockHeight) {
      throw new Error(
        `Overlapping block ranges detected:\n` +
          `- Endpoint ${current.apiUrl}: blocks ${current.fromBlockHeight}-${current.toBlockHeight}\n` +
          `- Endpoint ${next.apiUrl}: blocks ${next.fromBlockHeight}-${next.toBlockHeight}`,
      );
    }

    // Check for gaps and warn (but don't throw)
    const gap = next.fromBlockHeight - current.toBlockHeight;
    if (gap > 1) {
      logger.warn(
        `Gap detected in block coverage: blocks ${current.toBlockHeight + 1} to ${next.fromBlockHeight - 1} are not covered by any endpoint`,
      );
    }
  }

  // Ensure only one endpoint can be marked as "head" endpoint
  const headEndpoints = endpoints.filter((e) => e.isHeadEndpoint);
  if (headEndpoints.length > 1) {
    throw new Error(
      `Multiple head endpoints detected (toBlockHeight: -1): only one endpoint can represent the head`,
    );
  }

  // If there's a head endpoint, it should be the last one (highest fromBlockHeight)
  if (headEndpoints.length === 1) {
    const headEndpoint = headEndpoints[0];
    const lastEndpoint = sortedEndpoints[sortedEndpoints.length - 1];
    if (headEndpoint.fromBlockHeight !== lastEndpoint.fromBlockHeight) {
      logger.warn(
        `Head endpoint (toBlockHeight: -1) is not the last endpoint. This may indicate a configuration issue.`,
      );
    }
  }
}

/**
 * Load endpoint configuration from JSON file
 * Looks for endpoints.json in the config directory
 *
 * @returns Parsed endpoint configurations from file
 * @throws Error if file doesn't exist or is invalid
 */
export function loadEndpointsFromFile(): EndpointConfig[] {
  const configFilePath = path.join(__dirname, 'endpoints.json');

  if (!fs.existsSync(configFilePath)) {
    throw new Error(`Endpoints configuration file not found at: ${configFilePath}`);
  }

  try {
    const fileContent = fs.readFileSync(configFilePath, 'utf-8');
    return parseEndpointConfig(fileContent);
  } catch (error) {
    throw new Error(`Failed to load endpoints from file: ${error.message}`);
  }
}

/**
 * Get complete multi-endpoint configuration from ConfigService
 * Loads endpoints from JSON file (endpoints.json) or falls back to environment variable
 *
 * @param configService - NestJS ConfigService instance
 * @returns Complete multi-endpoint configuration
 */
export function getMultiEndpointConfig(
  configService: ConfigService,
): MultiEndpointConfig {
  const enabled = configService.get<boolean>(
    'GRAPHQL_MULTI_ENDPOINT_ENABLED',
    false,
  );
  const fallbackUrl = configService.get<string>('GRAPHQL_ENDPOINT', '');

  if (!enabled) {
    logger.log('Multi-endpoint mode is disabled, using legacy single endpoint');
    return {
      enabled: false,
      endpoints: [],
      fallbackUrl,
    };
  }

  try {
    let rawEndpoints: EndpointConfig[];

    // Try to load from JSON file first
    try {
      rawEndpoints = loadEndpointsFromFile();
      logger.log('Loaded endpoint configuration from endpoints.json file');
    } catch (fileError) {
      // Fallback to environment variable
      logger.warn(
        `Failed to load endpoints from file: ${fileError.message}. Falling back to GRAPHQL_ENDPOINTS environment variable`,
      );
      const endpointsJson = configService.get<string>('GRAPHQL_ENDPOINTS', '[]');
      rawEndpoints = parseEndpointConfig(endpointsJson);
    }

    const normalizedEndpoints = normalizeEndpointConfig(rawEndpoints);
    validateEndpointConfig(normalizedEndpoints);

    logger.log(
      `Multi-endpoint mode enabled with ${normalizedEndpoints.length} endpoints`,
    );

    normalizedEndpoints.forEach((endpoint, index) => {
      const toBlock = endpoint.isHeadEndpoint ? '∞ (head)' : endpoint.toBlockHeight;
      logger.log(
        `Endpoint ${index + 1}: ${endpoint.apiUrl} (blocks ${endpoint.fromBlockHeight}-${toBlock})`,
      );
    });

    return {
      enabled: true,
      endpoints: normalizedEndpoints,
      fallbackUrl,
    };
  } catch (error) {
    logger.error(`Failed to initialize multi-endpoint configuration: ${error.message}`);
    throw error;
  }
}
