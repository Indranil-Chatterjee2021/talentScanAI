import {
  MongoClient,
  Db,
  Collection,
  Filter,
  UpdateFilter,
  Document,
  FindOptions,
  OptionalUnlessRequiredId,
  UpdateResult,
} from "mongodb";

// ─── Singleton connection (self-hosted / Express) ────────────────────────────

let _client: MongoClient | null = null;
let _db: Db | null = null;

async function getDb(): Promise<Db> {
  if (_db) return _db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MongoDB is not configured. Set MONGODB_URI in your environment.');
  const dbName = process.env.MONGODB_DB_NAME;
  if (!dbName) throw new Error('Database name is not configured. Set MONGODB_DB_NAME in your environment.');
  if (!_client) {
    _client = new MongoClient(uri, { maxPoolSize: 10 });
    await _client.connect();
  }
  _db = _client.db(dbName);
  return _db;
}

// ─── Per-URI connection (Vercel / user-provided URIs) ────────────────────────

const _clientMap = new Map<string, MongoClient>();

export async function getDbForUri(uri: string, dbName: string): Promise<Db> {
  if (!_clientMap.has(uri)) {
    const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
    await client.connect();
    _clientMap.set(uri, client);
  }
  return _clientMap.get(uri)!.db(dbName);
}

export type ConnOpts = { uri: string; dbName: string };

async function resolveDb(connOpts?: ConnOpts): Promise<Db> {
  if (connOpts) return getDbForUri(connOpts.uri, connOpts.dbName);
  return getDb();
}

export async function getCollection<T extends Document>(
  name: string,
  connOpts?: ConnOpts,
): Promise<Collection<T>> {
  const db = await resolveDb(connOpts);
  return db.collection<T>(name);
}

// ─── Generic CRUD operations ─────────────────────────────────────────────────

/** Find a single document matching the filter. Returns null if not found. */
export async function dbFindOne<T extends Document>(
  collectionName: string,
  filter: Filter<T>,
  connOpts?: ConnOpts,
): Promise<T | null> {
  const col = await getCollection<T>(collectionName, connOpts);
  return col.findOne(filter) as Promise<T | null>;
}

/** Find multiple documents with optional sort, limit, and projection. */
export async function dbFindMany<T extends Document>(
  collectionName: string,
  filter: Filter<T>,
  options?: Pick<FindOptions, "sort" | "limit" | "projection">,
  connOpts?: ConnOpts,
): Promise<T[]> {
  const col = await getCollection<T>(collectionName, connOpts);
  return col.find(filter, options).toArray() as Promise<T[]>;
}

/** Update a single document and return the updated version. */
export async function dbFindOneAndUpdate<T extends Document>(
  collectionName: string,
  filter: Filter<T>,
  update: UpdateFilter<T>,
  options: { upsert?: boolean } = {},
  connOpts?: ConnOpts,
): Promise<T | null> {
  const col = await getCollection<T>(collectionName, connOpts);
  return col.findOneAndUpdate(filter, update, {
    returnDocument: "after",
    upsert: options.upsert ?? false,
  }) as Promise<T | null>;
}

/** Update a single document without returning it (fire-and-forget write). */
export async function dbUpdateOne<T extends Document>(
  collectionName: string,
  filter: Filter<T>,
  update: UpdateFilter<T>,
  options: { upsert?: boolean } = {},
  connOpts?: ConnOpts,
): Promise<UpdateResult> {
  const col = await getCollection<T>(collectionName, connOpts);
  return col.updateOne(filter, update, { upsert: options.upsert ?? false });
}

export async function dbInsertOne<T extends Document>(
  collectionName: string,
  doc: OptionalUnlessRequiredId<T>,
  connOpts?: ConnOpts,
): Promise<void> {
  const col = await getCollection<T>(collectionName, connOpts);
  await col.insertOne(doc);
}
