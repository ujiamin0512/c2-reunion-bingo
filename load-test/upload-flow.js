// Main/heaviest scenario: one full user journey per VU, mirroring
// RegisterPage -> BingoPage -> ProfilePage in the real app:
//   register -> getTasks -> 8x (Storage upload photo + upsertSubmission) -> submit
//
// This is the scenario that should be run at full 500-VU scale first — it's
// the closest proxy for "the actual reunion event happening."
//
// Run:
//   SMOKE_TEST=true k6 run load-test/upload-flow.js   (quick correctness check, ~1m)
//   k6 run load-test/upload-flow.js                   (full ramp+spike scenarios)

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import {
  REST_URL,
  STORAGE_URL,
  restHeaders,
  storageHeaders,
  samplePhoto,
  randomParticipant,
} from './lib/config.js'

const uploadDuration = new Trend('photo_upload_duration', true)
const uploadErrors = new Rate('photo_upload_errors')
const submissionWriteDuration = new Trend('submission_write_duration', true)
const submissionWriteErrors = new Rate('submission_write_errors')
const journeyDuration = new Trend('full_journey_duration', true)

const TASK_COUNT = 8 // matches the 3x3 board (8 tasks + 1 free center tile)

const SMOKE_TEST = __ENV.SMOKE_TEST === 'true'
const TARGET_VUS = Number(__ENV.TARGET_VUS) || 500

export const options = {
  scenarios: SMOKE_TEST
    ? {
        smoke: {
          executor: 'constant-vus',
          vus: Number(__ENV.SMOKE_VUS) || 10,
          duration: __ENV.SMOKE_DURATION || '1m',
          exec: 'uploadJourney',
        },
      }
    : {
        ramp: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: '5m', target: TARGET_VUS },
            { duration: '10m', target: TARGET_VUS }, // hold — people complete tasks throughout the event
            { duration: '2m', target: 0 },
          ],
          exec: 'uploadJourney',
        },
        spike: {
          executor: 'ramping-vus',
          startVUs: 0,
          startTime: '18m',
          stages: [
            { duration: '15s', target: TARGET_VUS }, // "everyone photograph this task now" burst
            { duration: '2m', target: TARGET_VUS },
            { duration: '15s', target: 0 },
          ],
          exec: 'uploadJourney',
        },
      },
  thresholds: {
    photo_upload_duration: ['p(95)<3000'],
    photo_upload_errors: ['rate<0.02'],
    submission_write_duration: ['p(95)<800'],
    submission_write_errors: ['rate<0.01'],
  },
}

function registerParticipant() {
  const { name, identity, graduation_year } = randomParticipant(__VU, __ITER)
  const res = http.post(
    `${REST_URL}/participants`,
    JSON.stringify({ name, identity, graduation_year, task_order: [0, 1, 2, 3, 4, 5, 6, 7] }),
    { headers: restHeaders({ Prefer: 'return=representation' }), tags: { name: 'register' } }
  )
  check(res, { 'register 201': (r) => r.status === 201 })
  if (res.status !== 201) return null
  return res.json()[0].id
}

function getTasks() {
  const res = http.get(
    `${REST_URL}/tasks?select=*&board_size=eq.3&is_active=eq.true&order=id`,
    { headers: restHeaders(), tags: { name: 'get_tasks' } }
  )
  check(res, { 'get_tasks 200': (r) => r.status === 200 })
  return res.status === 200 ? res.json() : []
}

function uploadPhoto(participantId, taskId) {
  const path = `submissions/${participantId}/${taskId}.jpg`
  const res = http.post(
    `${STORAGE_URL}/object/bingo-images/${path}`,
    samplePhoto,
    { headers: storageHeaders('image/jpeg'), tags: { name: 'storage_upload' } }
  )
  uploadDuration.add(res.timings.duration)
  uploadErrors.add(res.status !== 200)
  check(res, { 'storage upload 200': (r) => r.status === 200 })
  if (res.status !== 200) return null

  const publicUrl = `${STORAGE_URL}/object/public/bingo-images/${path}`

  const subRes = http.post(
    `${REST_URL}/submissions?on_conflict=participant_id,task_id`,
    JSON.stringify({
      participant_id: participantId,
      task_id: taskId,
      image_url: publicUrl,
      status: 'draft',
    }),
    {
      headers: restHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      tags: { name: 'upsert_submission' },
    }
  )
  submissionWriteDuration.add(subRes.timings.duration)
  submissionWriteErrors.add(subRes.status !== 201 && subRes.status !== 200)
  check(subRes, { 'upsert submission ok': (r) => r.status === 201 || r.status === 200 })
}

function submit(participantId) {
  http.patch(
    `${REST_URL}/submissions?participant_id=eq.${participantId}&status=eq.draft`,
    JSON.stringify({ status: 'pending' }),
    { headers: restHeaders(), tags: { name: 'submit_status' } }
  )
  http.patch(
    `${REST_URL}/participants?id=eq.${participantId}`,
    JSON.stringify({ submitted_at: new Date().toISOString() }),
    { headers: restHeaders(), tags: { name: 'submit_timestamp' } }
  )
}

export function uploadJourney() {
  const start = Date.now()

  const participantId = registerParticipant()
  if (!participantId) return
  sleep(1) // reading the board before starting to photograph tasks

  const tasks = getTasks()
  const taskIds = tasks.length ? tasks.map((t) => t.id) : Array.from({ length: TASK_COUNT }, (_, i) => i + 1)

  for (const taskId of taskIds.slice(0, TASK_COUNT)) {
    uploadPhoto(participantId, taskId)
    sleep(Math.random() * 3 + 1) // time to walk to next task / take the photo
  }

  submit(participantId)
  journeyDuration.add(Date.now() - start)
}
