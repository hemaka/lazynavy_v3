import 'reflect-metadata'
import assert from 'node:assert/strict'
import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { AppModule } from '../app.module'
import { DEFAULT_DATABASE_URL } from '../config/env'

type Json = Record<string, any>

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL }),
})

async function main() {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10000)}`
  const captainEmail = `selftest-captain-${suffix}`
  const crewEmail = `selftest-crew-${suffix}`
  const createdUserIds: string[] = []
  const createdVesselIds: string[] = []
  const createdVoyageIds: string[] = []
  const createdLogIds: string[] = []
  const createdPoiIds: string[] = []
  const createdDiscoveryPointIds: string[] = []
  const createdDiscoveryUnlockIds: string[] = []
  const createdSupplyIds: string[] = []
  let app: INestApplication | null = null

  try {
    console.log('v3-core selftest: seed users')
    const captain = await prisma.user.create({ data: { nickname: captainEmail, title: 'Selftest Captain' } })
    const crew = await prisma.user.create({ data: { nickname: crewEmail, title: 'Selftest Crew' } })
    createdUserIds.push(captain.id, crew.id)

    console.log('v3-core selftest: start app')
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false, abortOnError: false })
    app.setGlobalPrefix('api')
    await app.listen(0, '127.0.0.1')
    const address = app.getHttpServer().address()
    assert.equal(typeof address, 'object')
    const baseUrl = `http://127.0.0.1:${address.port}/api`

    console.log('v3-core selftest: empty hud')
    const emptyHud = await get<Json>(`${baseUrl}/home/captain-hud?empty=1`)
    assert.equal(emptyHud.currentVessel, null)
    assert.deepEqual(emptyHud.shortcuts, [])

    console.log('v3-core selftest: create vessel')
    const vessel = await post<Json>(`${baseUrl}/vessels?userId=${captain.id}`, {
      name: `Selftest Vessel ${suffix}`,
      type: 'sailboat',
      homePort: 'Test Marina',
    })
    createdVesselIds.push(vessel.id)
    assert.equal(vessel.memberships[0].role, 'captain')

    await post<Json>(`${baseUrl}/vessels/${vessel.id}/crew?userId=${captain.id}`, { userId: crew.id, role: 'navigator' })
    await patch<Json>(`${baseUrl}/vessels/${vessel.id}/current?userId=${captain.id}`, {})

    console.log('v3-core selftest: create voyage')
    const voyage = await post<Json>(`${baseUrl}/voyages?userId=${captain.id}`, {
      vesselId: vessel.id,
      name: `Selftest Voyage ${suffix}`,
      departureName: 'Test Marina',
      destinationName: 'Blue Point',
      needsConfirmation: true,
      participantUserIds: [crew.id],
    })
    createdVoyageIds.push(voyage.id)
    assert.equal(voyage.needsConfirmation, true)
    assert.equal(voyage.participants.length, 2)

    const hudWithVoyage = await get<Json>(`${baseUrl}/home/captain-hud?userId=${captain.id}`)
    assert.equal(hudWithVoyage.currentVessel.id, vessel.id)
    assert.equal(hudWithVoyage.activeVoyage.id, voyage.id)
    assert.equal(hudWithVoyage.activeVoyage.needsConfirmation, true)

    console.log('v3-core selftest: complete voyage')
    await patch<Json>(`${baseUrl}/voyages/${voyage.id}/confirm?userId=${crew.id}`, {})
    const started = await patch<Json>(`${baseUrl}/voyages/${voyage.id}/start?userId=${captain.id}`, {})
    assert.equal(started.status, 'active')

    const completed = await patch<Json>(`${baseUrl}/voyages/${voyage.id}/complete?userId=${captain.id}`, {})
    assert.equal(completed.status, 'completed')

    console.log('v3-core selftest: rewards')
    const ledger = await get<Json[]>(`${baseUrl}/rewards/ledger?userId=${captain.id}`)
    const voyageReward = ledger.find((item) => item.ruleKey === 'voyage.completed' && item.sourceId === voyage.id)
    assert.ok(voyageReward)
    assert.equal(voyageReward.mileageStatus, 'pending')
    assert.equal(voyageReward.mileageAmount, 20)

    const afterRewardHud = await get<Json>(`${baseUrl}/home/captain-hud?userId=${captain.id}`)
    assert.equal(afterRewardHud.user.pendingMileagePoints, 20)
    assert.equal(afterRewardHud.currentVessel.pendingMileagePoints, 20)

    const duplicateGrant = await post<Json>(`${baseUrl}/rewards/grant`, {
      ruleKey: 'voyage.completed',
      userId: captain.id,
      vesselId: vessel.id,
      sourceType: 'voyage',
      sourceId: voyage.id,
    })
    assert.equal(duplicateGrant.id, voyageReward.id)

    console.log('v3-core selftest: logs, supplies, poi, discovery')
    const log = await post<Json>(`${baseUrl}/logs?userId=${captain.id}`, {
      vesselId: vessel.id,
      voyageId: voyage.id,
      type: 'note',
      title: `Selftest Log ${suffix}`,
      body: 'Routine log entry',
    })
    createdLogIds.push(log.id)
    const logLedger = await get<Json[]>(`${baseUrl}/rewards/ledger?userId=${captain.id}`)
    assert.ok(logLedger.some((item) => item.ruleKey === 'log.created' && item.sourceId === log.id))

    const supply = await post<Json>(`${baseUrl}/vessels/${vessel.id}/supplies?userId=${captain.id}`, {
      name: 'Fresh Water',
      category: 'water',
      unit: 'L',
      quantity: 20,
      capacity: 200,
      warnBelow: 50,
    })
    createdSupplyIds.push(supply.id)
    const lowStock = await get<Json[]>(`${baseUrl}/vessels/${vessel.id}/supplies?userId=${captain.id}&low=1`)
    assert.ok(lowStock.some((item) => item.id === supply.id))
    const adjustedSupply = await patch<Json>(`${baseUrl}/vessels/${vessel.id}/supplies/${supply.id}/adjust?userId=${captain.id}`, { delta: 60 })
    assert.equal(adjustedSupply.quantity, 80)

    const poi = await post<Json>(`${baseUrl}/pois?userId=${captain.id}`, {
      name: `Selftest Light ${suffix}`,
      type: 'lighthouse',
      scope: 'public',
      lat: 37.8001,
      lng: -122.4101,
      description: 'Visible from the bay',
    })
    createdPoiIds.push(poi.id)
    await patch<Json>(`${baseUrl}/pois/${poi.id}/confirm?userId=${crew.id}`, {})

    const point = await post<Json>(`${baseUrl}/discovery-points`, {
      poiId: poi.id,
      name: `Selftest Discovery ${suffix}`,
      type: 'lighthouse',
      lat: 37.8001,
      lng: -122.4101,
      radiusM: 300,
      description: 'A safe visible landmark',
    })
    createdDiscoveryPointIds.push(point.id)

    const unlock = await post<Json>(`${baseUrl}/discovery-unlocks?userId=${captain.id}`, {
      pointId: point.id,
      voyageId: voyage.id,
      photoUrl: 'https://example.com/discovery.jpg',
      lat: 37.80011,
      lng: -122.41009,
    })
    createdDiscoveryUnlockIds.push(unlock.id)
    if (unlock.logEntryId) createdLogIds.push(unlock.logEntryId)
    const discoveryLedger = await get<Json[]>(`${baseUrl}/rewards/ledger?userId=${captain.id}`)
    assert.ok(discoveryLedger.some((item) => item.ruleKey === 'discovery.unlocked' && item.sourceId === unlock.id))

    console.log('v3-core selftest: settle mileage')
    await patch<Json>(`${baseUrl}/rewards/ledger/${voyageReward.id}/settle-mileage`, { approved: true, reviewNote: 'selftest' })
    const settledHud = await get<Json>(`${baseUrl}/home/captain-hud?userId=${captain.id}`)
    assert.equal(settledHud.user.pendingMileagePoints, 10)
    assert.equal(settledHud.user.availableMileagePoints, 20)
    assert.equal(settledHud.currentVessel.availableMileagePoints, 20)
    assert.equal(settledHud.currentVessel.pendingMileagePoints, 10)

    const auditEvents = await prisma.voyageAuditEvent.findMany({ where: { voyageId: voyage.id }, orderBy: { createdAt: 'asc' } })
    assert.deepEqual(auditEvents.map((event) => event.type), [
      'voyage.created',
      'participant.confirmed',
      'voyage.started',
      'voyage.completed',
    ])

    console.log('v3-core selftest passed')
  } finally {
    console.log('v3-core selftest: cleanup')
    try {
      if (app) await app.close()
      await prisma.discoveryUnlock.deleteMany({ where: { id: { in: createdDiscoveryUnlockIds } } })
      await prisma.discoveryPoint.deleteMany({ where: { id: { in: createdDiscoveryPointIds } } })
      await prisma.poiConfirm.deleteMany({ where: { poiId: { in: createdPoiIds } } })
      await prisma.poi.deleteMany({ where: { id: { in: createdPoiIds } } })
      await prisma.rewardLedger.deleteMany({ where: { OR: [{ userId: { in: createdUserIds } }, { vesselId: { in: createdVesselIds } }] } })
      await prisma.logEntry.deleteMany({ where: { id: { in: createdLogIds } } })
      await prisma.supplyItem.deleteMany({ where: { id: { in: createdSupplyIds } } })
      await prisma.voyageAuditEvent.deleteMany({ where: { voyageId: { in: createdVoyageIds } } })
      await prisma.voyageParticipant.deleteMany({ where: { voyageId: { in: createdVoyageIds } } })
      await prisma.voyage.deleteMany({ where: { id: { in: createdVoyageIds } } })
      await prisma.vesselMembership.deleteMany({ where: { OR: [{ userId: { in: createdUserIds } }, { vesselId: { in: createdVesselIds } }] } })
      await prisma.vessel.deleteMany({ where: { id: { in: createdVesselIds } } })
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
    } catch (cleanupErr) {
      console.error('v3-core selftest cleanup failed', cleanupErr)
      throw cleanupErr
    } finally {
      await prisma.$disconnect()
    }
  }
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  return parse<T>(res)
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return parse<T>(res)
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return parse<T>(res)
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${res.url}: ${text}`)
  return text ? JSON.parse(text) as T : ({} as T)
}

void main().catch((err) => {
  console.error('v3-core selftest failed', err)
  process.exit(1)
})
