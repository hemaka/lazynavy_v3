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
  const createdVesselModelIds: string[] = []
  const createdVoyageIds: string[] = []
  const createdLogIds: string[] = []
  const createdPoiIds: string[] = []
  const createdDiscoveryPointIds: string[] = []
  const createdDiscoveryUnlockIds: string[] = []
  const createdSupplyIds: string[] = []
  const createdInvitationIds: string[] = []
  const createdEquipmentTemplateIds: string[] = []
  const createdEquipmentIds: string[] = []
  const createdMaintenanceIds: string[] = []
  const createdManualIds: string[] = []
  const createdChatThreadIds: string[] = []
  const createdChatMessageIds: string[] = []
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

    console.log('v3-core selftest: toolbox')
    const unitConversion = await get<Json>(`${baseUrl}/toolbox/units?value=1&from=nm&to=km`)
    assert.equal(Math.round(unitConversion.result * 1000), 1852)
    const currencyConversion = await get<Json>(`${baseUrl}/toolbox/currency?amount=10&from=USD&to=EUR`)
    assert.ok(currencyConversion.result > 0)
    const regionInfo = await get<Json>(`${baseUrl}/toolbox/region?code=US`)
    assert.equal(regionInfo.vhfEmergency, 'VHF 16')
    const marineWeather = await get<Json>(`${baseUrl}/weather/marine?lat=37.8&lng=-122.4`)
    assert.equal(marineWeather.source, 'static-marine-default')
    const crewContext = await get<Json>(`${baseUrl}/weather/crew-context?vesselStatus=docked`)
    assert.equal(crewContext.suggestedCrewStatus, 'ashore')

    console.log('v3-core selftest: create vessel')
    const vesselModel = await post<Json>(`${baseUrl}/vessels/models`, {
      brand: `Selftest Brand ${suffix}`,
      model: `Selftest Model ${suffix}`,
      type: 'sailboat',
      lengthFt: 38,
      equipmentDefaultsJson: [
        { name: `Selftest Factory Engine ${suffix}`, category: 'engine', maintenanceIntervalDays: 90, location: 'Engine room' },
      ],
    })
    createdVesselModelIds.push(vesselModel.id)
    const vessel = await post<Json>(`${baseUrl}/vessels?userId=${captain.id}`, {
      modelId: vesselModel.id,
      name: `Selftest Vessel ${suffix}`,
      type: 'sailboat',
      homePort: 'Test Marina',
    })
    createdVesselIds.push(vessel.id)
    assert.equal(vessel.memberships[0].role, 'captain')
    assert.equal(vessel.setupSteps.length, 4)
    const captainThreads = await get<Json[]>(`${baseUrl}/messages/threads?userId=${captain.id}`)
    const boatThread = captainThreads.find((thread) => thread.vesselId === vessel.id)
    assert.ok(boatThread)
    createdChatThreadIds.push(boatThread.id)

    const roles = await get<Json[]>(`${baseUrl}/vessels/roles`)
    assert.ok(roles.some((role) => role.key === 'captain'))

    const updatedVessel = await patch<Json>(`${baseUrl}/vessels/${vessel.id}?userId=${captain.id}`, {
      registeredName: `LN-${suffix}`,
      buildYear: 2025,
      sceneTemplate: 'marina_night',
      operationalStatus: 'underway',
    })
    assert.equal(updatedVessel.registeredName, `LN-${suffix}`)
    assert.equal(updatedVessel.sceneTemplate, 'marina_night')
    assert.equal(updatedVessel.operationalStatus, 'underway')
    const copiedEquipment = await get<Json[]>(`${baseUrl}/equipment?vesselId=${vessel.id}&status=pending_confirmation&userId=${captain.id}`)
    assert.ok(copiedEquipment.some((item) => item.name === `Selftest Factory Engine ${suffix}`))

    const invite = await post<Json>(`${baseUrl}/vessels/${vessel.id}/invitations?userId=${captain.id}`, { role: 'crew', expiresInDays: 7 })
    createdInvitationIds.push(invite.id)
    assert.equal(invite.status, 'active')

    const inviteList = await get<Json[]>(`${baseUrl}/vessels/${vessel.id}/invitations?userId=${captain.id}`)
    assert.ok(inviteList.some((item) => item.id === invite.id))

    const joined = await post<Json>(`${baseUrl}/vessels/join?userId=${crew.id}`, { code: invite.code })
    assert.equal(joined.vessel.id, vessel.id)
    assert.equal(joined.membership.role, 'crew')
    const crewThreads = await get<Json[]>(`${baseUrl}/messages/threads?userId=${crew.id}`)
    assert.ok(crewThreads.some((thread) => thread.id === boatThread.id))
    const chatMessage = await post<Json>(`${baseUrl}/messages/threads/${boatThread.id}/messages?userId=${crew.id}`, { body: 'Selftest crew onboard' })
    createdChatMessageIds.push(chatMessage.id)
    const chatMessages = await get<Json[]>(`${baseUrl}/messages/threads/${boatThread.id}?userId=${captain.id}`)
    assert.ok(chatMessages.some((message) => message.id === chatMessage.id))

    const setupSteps = await get<Json[]>(`${baseUrl}/vessels/${vessel.id}/setup-steps?userId=${captain.id}`)
    assert.equal(setupSteps.length, 4)
    await patch<Json>(`${baseUrl}/vessels/${vessel.id}/setup-steps/profile/complete?userId=${captain.id}`, {})
    await patch<Json>(`${baseUrl}/vessels/${vessel.id}/setup-steps/home_port/complete?userId=${captain.id}`, {})
    await patch<Json>(`${baseUrl}/vessels/${vessel.id}/setup-steps/supplies/skip?userId=${captain.id}`, {})
    await patch<Json>(`${baseUrl}/vessels/${vessel.id}/setup-steps/crew/complete?userId=${captain.id}`, {})
    const afterSetup = await get<Json[]>(`${baseUrl}/rewards/ledger?userId=${captain.id}`)
    assert.ok(afterSetup.some((item) => item.ruleKey === 'boat.setup.completed' && item.sourceId === vessel.id))

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
    const waiver = await post<Json>(`${baseUrl}/voyages/${voyage.id}/documents?userId=${captain.id}`, {
      title: `Selftest Waiver ${suffix}`,
      type: 'waiver',
      contentText: 'Crew liability waiver accepted for this voyage.',
    })
    createdManualIds.push(waiver.id)
    const voyageDocuments = await get<Json[]>(`${baseUrl}/voyages/${voyage.id}/documents?userId=${crew.id}`)
    assert.ok(voyageDocuments.some((item) => item.id === waiver.id))

    console.log('v3-core selftest: complete voyage')
    await patch<Json>(`${baseUrl}/voyages/${voyage.id}/confirm?userId=${crew.id}`, {})
    await assertRejectsStatus(() => patch<Json>(`${baseUrl}/voyages/${voyage.id}/start?userId=${captain.id}`, {}), 'Pre-voyage checklist is incomplete')
    const checklist = await get<Json[]>(`${baseUrl}/voyages/${voyage.id}/checklist?userId=${captain.id}`)
    assert.equal(checklist.length, 3)
    for (const item of checklist) {
      await patch<Json>(`${baseUrl}/voyages/${voyage.id}/checklist/${item.id}/complete?userId=${crew.id}`, {})
    }
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
    await patch<Json>(`${baseUrl}/vessels/${vessel.id}/supplies/${supply.id}/adjust?userId=${captain.id}`, { delta: -40 })

    console.log('v3-core selftest: equipment and maintenance')
    const equipmentTemplate = await post<Json>(`${baseUrl}/equipment-templates`, {
      name: `Selftest Engine Template ${suffix}`,
      category: 'engine',
      brand: 'Lazy',
      model: 'Navy 30',
      defaultMaintenanceDays: 30,
      specsJson: { hp: 30 },
      partsJson: [{ name: 'Oil filter', quantity: 1 }],
    })
    createdEquipmentTemplateIds.push(equipmentTemplate.id)
    const installedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString()
    const equipment = await post<Json>(`${baseUrl}/equipment?userId=${captain.id}`, {
      vesselId: vessel.id,
      templateId: equipmentTemplate.id,
      name: `Selftest Engine ${suffix}`,
      category: 'engine',
      status: 'active',
      installedAt,
      maintenanceIntervalDays: 30,
    })
    createdEquipmentIds.push(equipment.id)
    assert.ok(equipment.nextDueAt)
    const dueEquipment = await get<Json[]>(`${baseUrl}/equipment/due?vesselId=${vessel.id}&withinDays=10&userId=${captain.id}`)
    assert.ok(dueEquipment.some((item) => item.id === equipment.id))

    console.log('v3-core selftest: manuals and documents')
    const vesselManual = await post<Json>(`${baseUrl}/manuals?userId=${captain.id}`, {
      vesselId: vessel.id,
      title: `Selftest Vessel Manual ${suffix}`,
      type: 'vessel_manual',
      contentText: 'Engine startup and safety checklist',
      offlinePriority: 'high',
    })
    createdManualIds.push(vesselManual.id)
    const equipmentManual = await post<Json>(`${baseUrl}/manuals?userId=${captain.id}`, {
      vesselId: vessel.id,
      equipmentId: equipment.id,
      title: `Selftest Engine Manual ${suffix}`,
      type: 'equipment_manual',
      contentText: 'Oil filter replacement and belt inspection',
    })
    createdManualIds.push(equipmentManual.id)
    const vesselManuals = await get<Json[]>(`${baseUrl}/vessels/${vessel.id}/manuals?userId=${captain.id}`)
    assert.ok(vesselManuals.some((item) => item.id === vesselManual.id))
    const equipmentManuals = await get<Json[]>(`${baseUrl}/equipment/${equipment.id}/manuals?userId=${captain.id}`)
    assert.ok(equipmentManuals.some((item) => item.id === equipmentManual.id))
    const searchManuals = await get<Json[]>(`${baseUrl}/manuals/search?q=filter&userId=${captain.id}`)
    assert.ok(searchManuals.some((item) => item.id === equipmentManual.id))

    const serviceRecord = await post<Json>(`${baseUrl}/equipment/${equipment.id}/maintenance?userId=${captain.id}`, {
      type: 'service',
      status: 'done',
      title: 'Selftest service',
      performedAt: new Date().toISOString(),
      cost: 12.5,
    })
    createdMaintenanceIds.push(serviceRecord.id)
    assert.equal(serviceRecord.status, 'done')
    const afterServiceDue = await get<Json[]>(`${baseUrl}/equipment/due?vesselId=${vessel.id}&withinDays=10&userId=${captain.id}`)
    assert.ok(!afterServiceDue.some((item) => item.id === equipment.id))
    const faultRecord = await post<Json>(`${baseUrl}/equipment/${equipment.id}/maintenance?userId=${captain.id}`, {
      type: 'fault',
      status: 'open',
      title: 'Selftest fault',
    })
    createdMaintenanceIds.push(faultRecord.id)
    const equipmentDetail = await get<Json>(`${baseUrl}/equipment/${equipment.id}?userId=${captain.id}`)
    assert.ok((equipmentDetail.maintenanceRecords as Json[]).some((item) => item.id === serviceRecord.id))
    const maintenanceLedger = await get<Json[]>(`${baseUrl}/rewards/ledger?userId=${captain.id}`)
    assert.ok(maintenanceLedger.some((item) => item.ruleKey === 'maintenance.completed' && item.sourceId === serviceRecord.id))
    const unreadNotifications = await get<Json[]>(`${baseUrl}/notifications?status=unread&userId=${captain.id}`)
    assert.ok(unreadNotifications.some((item) => item.type === 'boat.invitation.created'))
    assert.ok(unreadNotifications.some((item) => item.type === 'boat.invitation.claimed'))
    assert.ok(unreadNotifications.some((item) => item.type === 'voyage.checklist.incomplete'))
    assert.ok(unreadNotifications.some((item) => item.type === 'supply.low_stock'))
    assert.ok(unreadNotifications.some((item) => item.type === 'maintenance.due'))
    assert.ok(unreadNotifications.some((item) => item.type === 'maintenance.completed'))
    await patch<Json>(`${baseUrl}/notifications/${unreadNotifications[0].id}/read?userId=${captain.id}`, {})
    const deletedEquipment = await del<Json>(`${baseUrl}/equipment/${equipment.id}?userId=${captain.id}`)
    assert.ok(deletedEquipment.deletedAt)

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
      'checklist.completed',
      'checklist.completed',
      'checklist.completed',
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
      await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } })
      await prisma.manualDocument.deleteMany({ where: { id: { in: createdManualIds } } })
      await prisma.maintenanceRecord.deleteMany({ where: { id: { in: createdMaintenanceIds } } })
      await prisma.equipment.deleteMany({ where: { OR: [{ id: { in: createdEquipmentIds } }, { vesselId: { in: createdVesselIds } }] } })
      await prisma.equipmentTemplate.deleteMany({ where: { id: { in: createdEquipmentTemplateIds } } })
      await prisma.voyageAuditEvent.deleteMany({ where: { voyageId: { in: createdVoyageIds } } })
      await prisma.voyageChecklistItem.deleteMany({ where: { voyageId: { in: createdVoyageIds } } })
      await prisma.voyageParticipant.deleteMany({ where: { voyageId: { in: createdVoyageIds } } })
      await prisma.voyage.deleteMany({ where: { id: { in: createdVoyageIds } } })
      await prisma.vesselInvitation.deleteMany({ where: { id: { in: createdInvitationIds } } })
      await prisma.vesselSetupStep.deleteMany({ where: { vesselId: { in: createdVesselIds } } })
      await prisma.chatMessage.deleteMany({ where: { id: { in: createdChatMessageIds } } })
      await prisma.chatMember.deleteMany({ where: { threadId: { in: createdChatThreadIds } } })
      await prisma.chatThread.deleteMany({ where: { id: { in: createdChatThreadIds } } })
      await prisma.vesselMembership.deleteMany({ where: { OR: [{ userId: { in: createdUserIds } }, { vesselId: { in: createdVesselIds } }] } })
      await prisma.vessel.deleteMany({ where: { id: { in: createdVesselIds } } })
      await prisma.vesselModel.deleteMany({ where: { id: { in: createdVesselModelIds } } })
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

async function del<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' })
  return parse<T>(res)
}

async function assertRejectsStatus(fn: () => Promise<unknown>, expectedText: string) {
  try {
    await fn()
  } catch (err: any) {
    assert.ok(String(err?.message ?? err).includes(expectedText))
    return
  }
  assert.fail(`Expected request to reject with ${expectedText}`)
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
