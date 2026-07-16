// Admin dashboard scenario: getAllSubmissions() — an unpaginated join across
// submissions + tasks + participants. Only 1-2 admins would realistically use
// this during the event, but it's worth checking how it degrades as the
// submissions table grows while upload-flow.js is also running, since it's
// the heaviest single read query in the app.
//
// Run this concurrently with upload-flow.js against the same test project to
// see realistic admin-dashboard latency under write load, e.g.:
//   k6 run load-test/upload-flow.js &
//   k6 run load-test/admin-read.js
//
// SMOKE_TEST=true k6 run load-test/admin-read.js   for a quick ~30s check.

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { REST_URL, restHeaders } from './lib/config.js'

const adminReadDuration = new Trend('admin_read_duration', true)
const adminReadErrors = new Rate('admin_read_errors')

const SMOKE_TEST = __ENV.SMOKE_TEST === 'true'

export const options = {
  scenarios: {
    admin_polling: {
      executor: 'constant-vus',
      vus: SMOKE_TEST ? Number(__ENV.SMOKE_VUS) || 2 : 2, // realistically 1-2 admins with the dashboard open, polling
      duration: SMOKE_TEST ? __ENV.SMOKE_DURATION || '30s' : '20m',
      exec: 'adminReadJourney',
    },
  },
  thresholds: {
    admin_read_duration: ['p(95)<2000'],
    admin_read_errors: ['rate<0.01'],
  },
}

export function adminReadJourney() {
  const res = http.get(
    `${REST_URL}/submissions?select=*,task:tasks(*),participant:participants(*)&order=created_at.desc`,
    { headers: restHeaders(), tags: { name: 'get_all_submissions' } }
  )
  adminReadDuration.add(res.timings.duration)
  adminReadErrors.add(res.status !== 200)
  check(res, { 'get_all_submissions 200': (r) => r.status === 200 })

  sleep(5) // admin dashboard polling interval
}
