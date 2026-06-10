import { Logger } from '@nestjs/common';
import {
  EndpointConfig,
  NormalizedEndpointConfig,
} from '../types/endpoint.types';

const logger = new Logger('EndpointParser');

/**
 * Parse pipe-separated endpoint configuration
 * Expected format: "FROM|TO|URL" on each line
 * Example:
 *   4000001|4500000|https://endpoint1.com/graphql
 *   4500001|5000000|https://endpoint2.com/graphql
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
 * Parse endpoint configuration from JSON string or pipe-separated format
 * Auto-detects format based on leading character
 */
export function parseEndpointConfig(configString: string): EndpointConfig[] {
  const trimmed = configString.trim();

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
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
 * @throws Error if overlapping ranges are detected or invalid ranges exist
 */
export function validateEndpointConfig(
  endpoints: NormalizedEndpointConfig[],
): void {
  if (endpoints.length === 0) {
    throw new Error('At least one endpoint must be configured');
  }

  const sortedEndpoints = [...endpoints].sort(
    (a, b) => a.fromBlockHeight - b.fromBlockHeight,
  );

  for (const endpoint of sortedEndpoints) {
    if (endpoint.fromBlockHeight < 0) {
      throw new Error(
        `Invalid fromBlockHeight ${endpoint.fromBlockHeight} for endpoint ${endpoint.apiUrl}: must be non-negative`,
      );
    }

    if (endpoint.fromBlockHeight > endpoint.toBlockHeight) {
      throw new Error(
        `Invalid block range for endpoint ${endpoint.apiUrl}: fromBlockHeight (${endpoint.fromBlockHeight}) must be <= toBlockHeight (${endpoint.toBlockHeight})`,
      );
    }
  }

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

    const gap = next.fromBlockHeight - current.toBlockHeight;
    if (gap > 1) {
      logger.warn(
        `Gap detected in block coverage: blocks ${current.toBlockHeight + 1} to ${next.fromBlockHeight - 1} are not covered by any endpoint`,
      );
    }
  }

  const headEndpoints = endpoints.filter((e) => e.isHeadEndpoint);
  if (headEndpoints.length > 1) {
    throw new Error(
      `Multiple head endpoints detected (toBlockHeight: -1): only one endpoint can represent the head`,
    );
  }

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
