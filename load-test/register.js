// Registration scenario: mirrors createParticipant() in src/lib/db.ts.
// On ~30% of iterations also runs the full getAllParticipants() select that
// findExistingParticipant() does client-side on every registration attempt —
// this is the operation most likely to degrade as the participants table
// grows during check-in-time concurrency.
//
// Run:
//   SMOKE_TEST=true k6 run load-test/register.js   (quick correctness check, ~30s)
//   k6 run load-test/register.js                   (full ramp+spike scenarios)

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { REST_URL, restHeaders, randomParticipant } from './lib/config.js'

const registerErrors = new Rate('register_errors')
const registerDuration = new Trend('register_duration', true)
const dedupCheckErrors = new Rate('dedup_check_errors')
const dedupCheckDuration = new Trend('dedup_check_duration', true)

const SMOKE_TEST = __ENV.SMOKE_TEST === 'true'
const TARGET_VUS = Number(__ENV.TARGET_VUS) || 500

export const options = {
  scenarios: SMOKE_TEST
    ? {
        smoke: {
          executor: 'constant-vus',
          vus: Number(__ENV.SMOKE_VUS) || 10,
          duration: __ENV.SMOKE_DURATION || '30s',
          exec: 'registerJourney',
        },
      }
    : {
        ramp: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: '5m', target: TARGET_VUS }, // people arriving at check-in
            { duration: '5m', target: TARGET_VUS }, // hold at peak
            { duration: '2m', target: 0 },
          ],
          exec: 'registerJourney',
        },
        spike: {
          executor: 'ramping-vus',
          startVUs: 0,
          startTime: '13m', // runs after the ramp scenario finishes
          stages: [
            { duration: '10s', target: TARGET_VUS }, // near-simultaneous check-in burst
            { duration: '1m', target: TARGET_VUS },
            { duration: '10s', target: 0 },
          ],
          exec: 'registerJourney',
        },
      },
  thresholds: {
    register_duration: ['p(95)<800'],
    register_errors: ['rate<0.01'],
    dedup_check_duration: ['p(95)<1500'],
    dedup_check_errors: ['rate<0.01'],
  },
}

export function registerJourney() {
  const { name, identity, graduation_year } = randomParticipant(__VU, __ITER)

  // ~30% of users trigger the full-table dedup scan before registering,
  // same as findExistingParticipant() -> getAllParticipants() in the app.
  if (Math.random() < 0.3) {
    const res = http.get(
      `${REST_URL}/participants?select=*&order=created_at.desc`,
      { headers: restHeaders(), tags: { name: 'dedup_check' } }
    )
    dedupCheckDuration.add(res.timings.duration)
    dedupCheckErrors.add(res.status !== 200)
    check(res, { 'dedup check 200': (r) => r.status === 200 })
  }

  const payload = JSON.stringify({
    name,
    identity,
    graduation_year,
    task_order: [0, 1, 2, 3, 4, 5, 6, 7],
  })

  const res = http.post(`${REST_URL}/participants`, payload, {
    headers: restHeaders({ Prefer: 'return=representation' }),
    tags: { name: 'register' },
  })
  registerDuration.add(res.timings.duration)
  registerErrors.add(res.status !== 201)
  check(res, { 'register 201': (r) => r.status === 201 })

  sleep(1)
}
