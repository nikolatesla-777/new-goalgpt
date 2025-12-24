/**
 * Base Repository Interface
 * 
 * Generic interface for basic CRUD operations with idempotency support
 */

export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findByExternalId(externalId: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(item: T): Promise<T>;
  update(id: string, item: Partial<T>): Promise<T | null>;
  upsert(item: T, conflictKey: string): Promise<T>;
  delete(id: string): Promise<boolean>;
}
