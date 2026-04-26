import { MongoClient } from 'mongodb'

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>
}

export function getMongoClient() {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI

  if (!uri) {
    throw new Error('Set MONGODB_URI or MONGO_URI for frontend API database access.')
  }

  globalForMongo.mongoClientPromise ??= new MongoClient(uri).connect()

  return globalForMongo.mongoClientPromise
}
