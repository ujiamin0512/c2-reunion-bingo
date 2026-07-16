// Lighter "checking my progress" read scenario — mirrors what WelcomePage/
// BingoPage do on load/resume: getTasks() + getSubmissions(participantId)
// with its task join. Represents background/idle polling rather than the
// active photo-upload flow (see upload-flow.js for that).
//
// setup() registers a small shared pool of participants once so VUs have
// real IDs to poll against, instead of every iteration re-registering.
//
// Run:
//   SMOKE_TEST=true k6 run load-test/board-read.js   (quick correctness check, ~30s)
//   k6 run load-test/board-read.js                   (full ramp scenario)

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { REST_URL, restHeaders, randomParticipant } from './lib/config.js'

const readDuration = new Trend('board_read_duration', true)
const readErrors = new Rate('board_read_errors')

const POOL_SIZE = 50
const SMOKE_TEST = __ENV.SMOKE_TEST === 'true'
const TARGET_VUS = Number(__ENV.TARGET_VUS) || 500

export const options = {
  scenarios: SMOKE_TEST
    ? {
        smoke: {
          executor: 'constant-vus',
          vus: Number(__ENV.SMOKE_VUS) || 10,
          duration: __ENV.SMOKE_DURATION || '30s',
          exec: 'boardReadJourney',
        },
      }
    : {
        idle_polling: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: '3m', target: TARGET_VUS },
            { duration: '10m', target: TARGET_VUS },
            { duration: '2m', target: 0 },
          ],
          exec: 'boardReadJourney',
        },
      },
  thresholds: {
    board_read_duration: ['p(95)<600'],
    board_read_errors: ['rate<0.01'],
  },
}

export function setup() {
  const ids = []
  for (let i = 0; i < POOL_SIZE; i++) {
    const { name, identity, graduation_year } = randomParticipant(i, 'setup')
    const res = http.post(
      `${REST_URL}/participants`,
      JSON.stringify({ name, identity, graduation_year, task_order: [0, 1, 2, 3, 4, 5, 6, 7] }),
      { headers: restHeaders({ Prefer: 'return=representation' }) }
    )
    if (res.status === 201) ids.push(res.json()[0].id)
  }
  if (ids.length === 0) throw new Error('setup() failed to register any participants — check credentials/RLS')
  return { participantIds: ids }
}

export function boardReadJourney(data) {
  const participantId = data.participantIds[Math.floor(Math.random() * data.participantIds.length)]

  const tasksRes = http.get(
    `${REST_URL}/tasks?select=*&board_size=eq.3&is_active=eq.true&order=id`,
    { headers: restHeaders(), tags: { name: 'get_tasks' } }
  )
  check(tasksRes, { 'get_tasks 200': (r) => r.status === 200 })

  const subRes = http.get(
    `${REST_URL}/submissions?select=*,task:tasks(*)&participant_id=eq.${participantId}`,
    { headers: restHeaders(), tags: { name: 'get_submissions' } }
  )
  readDuration.add(subRes.timings.duration)
  readErrors.add(subRes.status !== 200)
  check(subRes, { 'get_submissions 200': (r) => r.status === 200 })

  sleep(Math.random() * 5 + 3) // idle time between progress checks
}
