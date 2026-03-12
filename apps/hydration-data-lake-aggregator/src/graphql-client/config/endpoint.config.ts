import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EndpointConfig, MultiEndpointConfig } from '../types/endpoint.types';
import {
  parseEndpointConfig,
  normalizeEndpointConfig,
  validateEndpointConfig,
} from './endpoint-parser.utils';

export {
  parsePipeSeparatedEndpoints,
  parseEndpointConfig,
  normalizeEndpointConfig,
  validateEndpointConfig,
} from './endpoint-parser.utils';

const logger = new Logger('EndpointConfig');

/**
 * Load endpoint configuration from JSON file
 * Looks for endpoints.json in the config directory
 *
 * @returns Parsed endpoint configurations from file
 * @throws Error if file doesn't exist or is invalid
 */
export async function loadEndpointsFromFile(): Promise<EndpointConfig[]> {
  const configFilePath = path.join(__dirname, 'endpoints.json');

  try {
    const fileContent = await fs.readFile(configFilePath, 'utf-8');
    return parseEndpointConfig(fileContent);
  } catch (error) {
    throw new Error(`Failed to load endpoints from file: ${error.message}`);
  }
}

/**
 * Get complete multi-endpoint configuration from ConfigService
 * Loads endpoints from JSON file (endpoints.json) or falls back to environment variable
 */
export async function getMultiEndpointConfig(
  configService: ConfigService,
): Promise<MultiEndpointConfig> {
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
      rawEndpoints = await loadEndpointsFromFile();
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
