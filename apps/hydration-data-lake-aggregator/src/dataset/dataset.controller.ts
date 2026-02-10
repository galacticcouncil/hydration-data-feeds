import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatasetService } from './dataset.service';
import { DatasetMetadataDto } from './dto/dataset-metadata.dto';

@Controller('api/v1/dataset')
@ApiTags('Dataset')
export class DatasetController {
  constructor(private readonly datasetService: DatasetService) {}

  @Get()
  @ApiOperation({
    summary: 'Get dataset metadata',
    description:
      'Returns metadata about the dataset including version, network, indexer info, and data coverage.\n\n' +
      '**Metadata includes:**\n' +
      '• Dataset information (id, version, network)\n' +
      '• Indexer information (id, version, network)\n' +
      '• Coverage bounds (time and block height ranges)\n\n' +
      '**Performance:**\n' +
      '• Coverage data is cached for 5 minutes to avoid expensive DB queries\n' +
      '• First request after cache expiry will query the database',
  })
  @ApiResponse({
    status: 200,
    description: 'Dataset metadata',
    type: DatasetMetadataDto,
  })
  async getMetadata(): Promise<DatasetMetadataDto> {
    return this.datasetService.getMetadata();
  }
}
