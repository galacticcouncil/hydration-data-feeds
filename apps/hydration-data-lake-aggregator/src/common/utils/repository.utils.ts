import { ObjectLiteral, Repository } from 'typeorm';

export async function saveInChunks<T extends ObjectLiteral>(
  repository: Repository<T>,
  items: T[],
  chunkSize = 500,
  logger?: { log: (msg: string) => void },
): Promise<void> {
  if (items.length === 0) return;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const result = await repository.manager
      .createQueryBuilder()
      .insert()
      .into(repository.target)
      .values(chunk as T[])
      .orIgnore()
      .execute();
    if (logger) {
      // result.raw[1] is the pg rowCount for INSERT — rows actually written (not conflicted)
      const inserted: number = result.raw?.[1] ?? chunk.length;
      const ignored = chunk.length - inserted;
      logger.log(`saveInChunks: inserted=${inserted} ignored=${ignored} total=${chunk.length}`);
    }
  }
}
