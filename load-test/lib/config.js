// Shared config/helpers for all k6 scripts in this suite.
// Requires K6_SUPABASE_URL and K6_SUPABASE_ANON_KEY env vars — point these at a
// throwaway test Supabase project, NOT the live c2-reunion-bingo-2026 project.

export const SUPABASE_URL = __ENV.K6_SUPABASE_URL
export const SUPABASE_ANON_KEY = __ENV.K6_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Set K6_SUPABASE_URL and K6_SUPABASE_ANON_KEY env vars before running (see load-test/README.md).'
  )
}

export const REST_URL = `${SUPABASE_URL}/rest/v1`
export const STORAGE_URL = `${SUPABASE_URL}/storage/v1`

export function restHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export function storageHeaders(contentType) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': contentType,
  }
}

// Loaded once per VU init context, shared across iterations — mirrors the
// ~150-400KB JPEG the app's client-side canvas compression (1080px, q0.85)
// actually produces. Real payload size matters for Storage bottleneck testing.
export const samplePhoto = open('../fixtures/sample-photo.jpg', 'b')

const IDENTITIES = ['alumni', 'alumni', 'alumni', 'teacher'] // ~75% alumni mix
const NAMES = [
  '张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵磊', '黄敏',
  '周杰', '吴超', '徐婷', '孙涛', '马丽', '朱军', '胡雪', '林峰',
]

export function randomParticipant(vuId, iter) {
  const name = `${NAMES[(vuId + iter) % NAMES.length]}_k6_${vuId}_${iter}`
  const identity = IDENTITIES[vuId % IDENTITIES.length]
  const graduation_year = identity === 'teacher' ? null : 2016 + (vuId % 8)
  return { name, identity, graduation_year }
}
