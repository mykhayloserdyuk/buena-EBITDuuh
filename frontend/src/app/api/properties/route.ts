import { NextResponse } from 'next/server'
import { Document } from 'mongodb'
import { getMongoClient } from '@/lib/mongodb'

type Property = {
  id: string
  name: string
  meta: string
  image: string
  houses?: House[]
}

type House = {
  id: string
  name: string
  meta: string
  unitCount?: number
  totalArea?: number
  units: Unit[]
}

type Unit = {
  id: string
  name: string
  meta: string
  location?: string
  kind?: string
  area?: number
  rooms?: number
  ownershipShare?: number
}

const DB_NAME = process.env.MONGODB_DB ?? process.env.MONGO_DB ?? 'buena'
const PROPERTY_IMAGE = '/condominium.webp'
const PROPERTY_TYPES = ['liegenschaft', 'objekt', 'immobilie', 'weg', 'property']
const BUILDING_TYPES = ['haus', 'gebaeude', 'gebäude']
const UNIT_TYPES = ['einheit']

function numberLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`
}

function propertyName(doc: Document) {
  return String(
    doc.name ??
      doc.bezeichnung ??
      doc.titel ??
      doc.adresse ??
      [doc.strasse, doc.plz, doc.ort].filter(Boolean).join(', ') ??
      doc._id ??
      '',
  ).trim()
}

function propertyId(doc: Document) {
  return String(doc.id ?? doc._id ?? '').trim()
}

function toProperty(doc: Document, buildingCount = 0, unitCount = 0): Property | null {
  const id = propertyId(doc)
  const name = propertyName(doc)

  if (!id || !name) return null

  const buildings = Number(doc.buildings ?? doc.haeuser ?? doc.gebaeude ?? doc['gebäude'] ?? buildingCount)
  const units = Number(doc.units ?? doc.einheiten ?? unitCount)
  const metaParts = []

  if (buildings > 0) metaParts.push(numberLabel(buildings, 'Gebäude', 'Gebäude'))
  if (units > 0) metaParts.push(numberLabel(units, 'Einheit', 'Einheiten'))

  return {
    id,
    name,
    meta: String(doc.meta ?? metaParts.join(' · ') ?? '').trim(),
    image: String(doc.image ?? PROPERTY_IMAGE),
  }
}

function unitName(doc: Document) {
  return String(doc.einheit_nr ?? doc.name ?? doc._id ?? '').trim()
}

function unitMeta(doc: Document) {
  const parts = [
    doc.lage ? String(doc.lage) : '',
    doc.typ ? String(doc.typ) : '',
    Number(doc.wohnflaeche_qm) > 0 ? `${Number(doc.wohnflaeche_qm)} qm` : '',
    Number(doc.zimmer) > 0 ? `${Number(doc.zimmer)} Zi.` : '',
  ].filter(Boolean)

  return parts.join(' · ')
}

function toNumber(value: unknown) {
  const next = Number(value)
  return Number.isFinite(next) ? next : undefined
}

async function loadStructuredStammdatenProperties(): Promise<Property[]> {
  const client = await getMongoClient()
  const db = client.db(DB_NAME)
  const liegenschaft = await db.collection('liegenschaft').findOne({})

  if (!liegenschaft) return []

  const [buildingCount, unitCount] = await Promise.all([
    db.collection('gebaeude').countDocuments({}),
    db.collection('einheiten').countDocuments({}),
  ])

  const property = toProperty(liegenschaft, buildingCount, unitCount)
  return property ? [property] : []
}

async function loadEntityProperties(): Promise<Property[]> {
  const client = await getMongoClient()
  const db = client.db(DB_NAME)

  const propertyDocs = await db
    .collection('entities')
    .find({ type: { $in: PROPERTY_TYPES } })
    .project({ _id: 1, id: 1, name: 1, bezeichnung: 1, titel: 1, adresse: 1, strasse: 1, plz: 1, ort: 1, meta: 1, image: 1, buildings: 1, haeuser: 1, gebaeude: 1, einheiten: 1, units: 1 })
    .sort({ name: 1, bezeichnung: 1, _id: 1 })
    .limit(50)
    .toArray()

  if (propertyDocs.length > 0) {
    return propertyDocs.flatMap((doc) => {
      const property = toProperty(doc)
      return property ? [property] : []
    })
  }

  const [buildingCount, unitCount] = await Promise.all([
    db.collection('entities').countDocuments({ type: { $in: BUILDING_TYPES } }),
    db.collection('entities').countDocuments({ type: { $in: UNIT_TYPES } }),
  ])

  const buildingDocs = await db
    .collection('entities')
    .find({ type: { $in: BUILDING_TYPES } })
    .project({ _id: 1, id: 1, name: 1, bezeichnung: 1, adresse: 1, strasse: 1, plz: 1, ort: 1 })
    .sort({ name: 1, bezeichnung: 1, _id: 1 })
    .limit(50)
    .toArray()

  if (buildingDocs.length === 1) {
    const property = toProperty(buildingDocs[0], buildingCount, unitCount)
    return property ? [property] : []
  }

  const buildingProperties = buildingDocs.flatMap((doc) => {
    const property = toProperty(doc, 1, 0)
    return property ? [property] : []
  })

  if (buildingProperties.length > 0) return buildingProperties

  const unitDocs = await db
    .collection('entities')
    .find({ type: 'einheit', haus_id: { $type: 'string', $ne: '' } })
    .project({ _id: 1, haus_id: 1, einheit_nr: 1, lage: 1, typ: 1, wohnflaeche_qm: 1, zimmer: 1, miteigentumsanteil: 1 })
    .sort({ haus_id: 1, einheit_nr: 1, _id: 1 })
    .toArray()

  if (unitDocs.length === 0) return []

  const houseMap = new Map<string, { totalArea: number; units: Unit[] }>()

  for (const doc of unitDocs) {
    const houseId = String(doc.haus_id)
    const house = houseMap.get(houseId) ?? { totalArea: 0, units: [] }

    house.totalArea += Number(doc.wohnflaeche_qm ?? 0)
    house.units.push({
      id: String(doc._id),
      name: unitName(doc),
      meta: unitMeta(doc),
      location: doc.lage ? String(doc.lage) : undefined,
      kind: doc.typ ? String(doc.typ) : undefined,
      area: toNumber(doc.wohnflaeche_qm),
      rooms: toNumber(doc.zimmer),
      ownershipShare: toNumber(doc.miteigentumsanteil),
    })
    houseMap.set(houseId, house)
  }

  const houses = [...houseMap.entries()].map(([houseId, house]) => ({
    id: houseId,
    name: `Haus ${houseId.replace(/^HAUS-/, '')}`,
    meta: [
      numberLabel(house.units.length, 'Einheit', 'Einheiten'),
      house.totalArea > 0 ? `${Math.round(house.totalArea)} qm` : '',
    ].filter(Boolean).join(' · '),
    unitCount: house.units.length,
    totalArea: Math.round(house.totalArea),
    units: house.units,
  }))

  const buildings = houses.length
  const units = unitDocs.length
  const totalArea = houses.reduce((sum, house) => {
    const area = Number(house.meta.match(/(\d+) qm/)?.[1] ?? 0)
    return sum + area
  }, 0)
  const metaParts = []

  if (buildings > 0) metaParts.push(numberLabel(buildings, 'Gebäude', 'Gebäude'))
  if (units > 0) metaParts.push(numberLabel(units, 'Einheit', 'Einheiten'))
  if (totalArea > 0) metaParts.push(`${Math.round(totalArea)} qm`)

  return [
    {
      id: 'portfolio',
      name: 'Gesamtbestand',
      meta: metaParts.join(' · '),
      image: PROPERTY_IMAGE,
      houses,
    },
  ]
}

export async function GET() {
  const hasMongoUri = Boolean(process.env.MONGODB_URI ?? process.env.MONGO_URI)

  console.log('[api/properties] GET start', {
    db: DB_NAME,
    hasMongoUri,
  })

  if (!hasMongoUri) {
    return NextResponse.json(
      {
        properties: [],
        error: 'missing_mongodb_uri',
        message: 'Set MONGODB_URI or MONGO_URI in frontend/.env.local and restart the frontend dev server.',
      },
      { status: 500 },
    )
  }

  try {
    const structuredProperties = await loadStructuredStammdatenProperties()
    console.log('[api/properties] structured properties', structuredProperties)

    if (structuredProperties.length > 0) {
      return NextResponse.json({ properties: structuredProperties })
    }

    const entityProperties = await loadEntityProperties()
    console.log('[api/properties] entity properties', entityProperties)

    return NextResponse.json({ properties: entityProperties })
  } catch (error) {
    console.error('[api/properties] database query failed', error)
    return NextResponse.json(
      {
        properties: [],
        error: 'database_query_failed',
        message: error instanceof Error ? error.message : 'Unknown database error',
      },
      { status: 500 },
    )
  }
}
