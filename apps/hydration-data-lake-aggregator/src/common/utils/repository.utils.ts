import { ObjectLiteral, Repository } from 'typeorm';

export async function saveInChunks<T extends ObjectLiteral>(
  repository: Repository<T>,
  items: T[],
  chunkSize = 500,
): Promise<void> {
  if (items.length === 0) return;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await repository.manager
      .createQueryBuilder()
      .insert()
      .into(repository.target)
      .values(chunk as any[])
      .orIgnore()
      .execute();
  }
}
