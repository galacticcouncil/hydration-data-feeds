import type { CodegenConfig } from '@graphql-codegen/cli';

import * as dotenv from 'dotenv';

dotenv.config({
  path: (() => {
    return `${__dirname}/../.env`;
  })(),
});

const config: CodegenConfig = {
  overwrite: true,
  schema: process.env.MAIN_INDEXER_GRAPHQL_ENDPOINT,
  documents: 'src/modules/dataSource/graphqlSupport/main/queries/*.ts',
  // ignoreNoDocuments: true,
  silent: false,
  verbose: true,
  debug: true,
  hooks: {
    onError: (e) => console.log(e),
  },
  generates: {
    ['src/modules/dataSource/graphqlSupport/main/apiTypes.ts']: {
      plugins: ['typescript', 'typescript-operations', 'typescript-document-nodes'],
    },
  },
};

export default config;
