import { supabase, isSupabaseConfigured } from './supabase'
import type { Participant, Task, Submission, BoardSize, Identity } from '../types'

// ─── Local storage fallback key ───────────────────────────────────────────────
const LS_PARTICIPANT = 'bingo_participant'
const LS_TASKS = 'bingo_tasks'
const LS_SUBMISSIONS = 'bingo_submissions'

// ─── Default tasks (used when Supabase not configured) ────────────────────────
const DEFAULT_TASKS_3: Task[] = [
  { id: 1, title: '和同学合影', description: '与老同学拍一张合照', icon: '👥', is_active: true, board_size: 3, created_at: '' },
  { id: 2, title: '和班主任合影', description: '与班主任拍合照', icon: '🎓', is_active: true, board_size: 3, created_at: '' },
  { id: 3, title: '参观回忆墙', description: '拍下你最喜欢的回忆', icon: '🖼️', is_active: true, board_size: 3, created_at: '' },
  { id: 4, title: '找到最好的朋友', description: '找到你最好的朋友并合影', icon: '❤️', is_active: true, board_size: 3, created_at: '' },
  { id: 5, title: '拍一张集体自拍', description: '与5人以上拍自拍', icon: '📷', is_active: true, board_size: 3, created_at: '' },
  { id: 6, title: '找到你以前的教室', description: '在你的旧教室前拍照', icon: '🚪', is_active: true, board_size: 3, created_at: '' },
  { id: 7, title: '在礼堂前拍照', description: '在礼堂正门前留影', icon: '🏛️', is_active: true, board_size: 3, created_at: '' },
  { id: 8, title: '在校门口拍照', description: '在校门口来一张', icon: '⭐', is_active: true, board_size: 3, created_at: '' },
]

// ─── Participant ───────────────────────────────────────────────────────────────
export async function createParticipant(
  name: string,
  identity: Identity,
  graduation_year: number | null,
  taskIds: number[]
): Promise<Participant> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('participants')
      .insert({ name, identity, graduation_year, task_order: taskIds })
      .select()
      .single()
    if (error) throw error
    return data
  }
  // localStorage fallback
  const p: Participant = {
    id: crypto.randomUUID(),
    name,
    identity,
    graduation_year,
    task_order: taskIds,
    created_at: new Date().toISOString(),
    submitted_at: null,
  }
  localStorage.setItem(LS_PARTICIPANT, JSON.stringify(p))
  return p
}

export async function getParticipant(id: string): Promise<Participant | null> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase.from('participants').select().eq('id', id).single()
    return data
  }
  const raw = localStorage.getItem(LS_PARTICIPANT)
  if (!raw) return null
  const p = JSON.parse(raw) as Participant
  return p.id === id ? p : null
}

export async function findExistingParticipant(
  name: string,
  identity: Identity,
  graduation_year: number | null
): Promise<Participant | null> {
  const all = await getAllParticipants()
  const normalizedName = name.trim().toUpperCase()
  return all.find(p =>
    p.name.trim().toUpperCase() === normalizedName &&
    p.identity === identity &&
    (identity === 'teacher' || p.graduation_year === graduation_year)
  ) ?? null
}

export async function getAllParticipants(): Promise<Participant[]> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase.from('participants').select().order('created_at', { ascending: false })
    return data || []
  }
  const raw = localStorage.getItem(LS_PARTICIPANT)
  return raw ? [JSON.parse(raw)] : []
}

export async function updateParticipant(id: string, updates: Partial<Participant>): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.from('participants').update(updates).eq('id', id)
    return
  }
  const raw = localStorage.getItem(LS_PARTICIPANT)
  if (raw) {
    const p = JSON.parse(raw) as Participant
    if (p.id === id) localStorage.setItem(LS_PARTICIPANT, JSON.stringify({ ...p, ...updates }))
  }
}

export async function submitParticipant(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase
      .from('submissions')
      .update({ status: 'pending' })
      .eq('participant_id', id)
      .eq('status', 'draft')
  } else {
    const raw = localStorage.getItem(LS_SUBMISSIONS)
    const all: Submission[] = raw ? JSON.parse(raw) : []
    localStorage.setItem(
      LS_SUBMISSIONS,
      JSON.stringify(all.map(s =>
        (s.participant_id === id && s.status === 'draft') ? { ...s, status: 'pending' } : s
      ))
    )
  }
  await updateParticipant(id, { submitted_at: new Date().toISOString() })
}

export async function deleteParticipant(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.from('participants').delete().eq('id', id)
    return
  }
  const raw = localStorage.getItem(LS_PARTICIPANT)
  if (raw) {
    const p = JSON.parse(raw) as Participant
    if (p.id === id) localStorage.removeItem(LS_PARTICIPANT)
  }
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export async function getTasks(boardSize: BoardSize = 3): Promise<Task[]> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('tasks')
      .select()
      .eq('board_size', boardSize)
      .eq('is_active', true)
      .order('id')
    return data || DEFAULT_TASKS_3
  }
  const raw = localStorage.getItem(LS_TASKS)
  return raw ? JSON.parse(raw) : DEFAULT_TASKS_3
}

export async function getAllTasks(): Promise<Task[]> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase.from('tasks').select().order('id')
    return data || DEFAULT_TASKS_3
  }
  const raw = localStorage.getItem(LS_TASKS)
  return raw ? JSON.parse(raw) : DEFAULT_TASKS_3
}

export async function createTask(task: Omit<Task, 'id' | 'created_at'>): Promise<Task> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('tasks').insert(task).select().single()
    if (error) throw error
    return data
  }
  const raw = localStorage.getItem(LS_TASKS)
  const tasks: Task[] = raw ? JSON.parse(raw) : DEFAULT_TASKS_3
  const newTask: Task = { ...task, id: Date.now(), created_at: new Date().toISOString() }
  localStorage.setItem(LS_TASKS, JSON.stringify([...tasks, newTask]))
  return newTask
}

export async function updateTask(id: number, updates: Partial<Task>): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.from('tasks').update(updates).eq('id', id)
    return
  }
  const raw = localStorage.getItem(LS_TASKS)
  const tasks: Task[] = raw ? JSON.parse(raw) : DEFAULT_TASKS_3
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks.map(t => t.id === id ? { ...t, ...updates } : t)))
}

export async function deleteTask(id: number): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.from('tasks').delete().eq('id', id)
    return
  }
  const raw = localStorage.getItem(LS_TASKS)
  const tasks: Task[] = raw ? JSON.parse(raw) : []
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks.filter(t => t.id !== id)))
}

// ─── Submissions ──────────────────────────────────────────────────────────────
export async function getSubmissions(participantId: string): Promise<Submission[]> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('submissions')
      .select('*, task:tasks(*)')
      .eq('participant_id', participantId)
    return data || []
  }
  const raw = localStorage.getItem(LS_SUBMISSIONS)
  const all: Submission[] = raw ? JSON.parse(raw) : []
  return all.filter(s => s.participant_id === participantId)
}

export async function getAllSubmissions(): Promise<Submission[]> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('submissions')
      .select('*, task:tasks(*), participant:participants(*)')
      .order('created_at', { ascending: false })
    return data || []
  }
  const raw = localStorage.getItem(LS_SUBMISSIONS)
  return raw ? JSON.parse(raw) : []
}

export async function upsertSubmission(
  participantId: string,
  taskId: number,
  imageUrl: string
): Promise<Submission> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('submissions')
      .upsert(
        { participant_id: participantId, task_id: taskId, image_url: imageUrl, status: 'draft' },
        { onConflict: 'participant_id,task_id' }
      )
      .select()
      .single()
    if (error) throw error
    return data
  }
  const raw = localStorage.getItem(LS_SUBMISSIONS)
  const all: Submission[] = raw ? JSON.parse(raw) : []
  const existing = all.findIndex(s => s.participant_id === participantId && s.task_id === taskId)
  const sub: Submission = {
    id: existing >= 0 ? all[existing].id : crypto.randomUUID(),
    participant_id: participantId,
    task_id: taskId,
    image_url: imageUrl,
    status: 'draft',
    created_at: new Date().toISOString(),
  }
  if (existing >= 0) all[existing] = sub
  else all.push(sub)
  localStorage.setItem(LS_SUBMISSIONS, JSON.stringify(all))
  return sub
}

export async function deleteSubmission(participantId: string, taskId: number): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase
      .from('submissions')
      .delete()
      .eq('participant_id', participantId)
      .eq('task_id', taskId)
    return
  }
  const raw = localStorage.getItem(LS_SUBMISSIONS)
  const all: Submission[] = raw ? JSON.parse(raw) : []
  localStorage.setItem(
    LS_SUBMISSIONS,
    JSON.stringify(all.filter(s => !(s.participant_id === participantId && s.task_id === taskId)))
  )
}

export async function updateSubmissionStatus(
  id: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.from('submissions').update({ status }).eq('id', id)
    return
  }
  const raw = localStorage.getItem(LS_SUBMISSIONS)
  const all: Submission[] = raw ? JSON.parse(raw) : []
  localStorage.setItem(LS_SUBMISSIONS, JSON.stringify(all.map(s => s.id === id ? { ...s, status } : s)))
}

// ─── Image upload ─────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const UPLOAD_MAX_ATTEMPTS = 4

export async function uploadImage(
  participantId: string,
  taskId: number,
  file: File
): Promise<string> {
  const compressed = await compressImage(file)

  if (isSupabaseConfigured()) {
    const path = `submissions/${participantId}/${taskId}.jpg`

    // Small random jitter before the first attempt spreads out simultaneous
    // uploads (e.g. everyone photographing the same task right after an
    // announcement) instead of every device hitting Storage in the same instant.
    await sleep(Math.random() * 600)

    let lastError: unknown
    for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        // Exponential backoff with jitter between retries, load-tested against
        // Supabase Storage returning transient stream errors under concurrency.
        const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000)
        await sleep(backoff + Math.random() * 500)
      }
      const { error } = await supabase.storage
        .from('bingo-images')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
      if (!error) {
        const { data } = supabase.storage.from('bingo-images').getPublicUrl(path)
        return data.publicUrl
      }
      lastError = error
    }
    throw lastError
  }

  // Base64 fallback for local mode
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(compressed)
  })
}

async function compressImage(file: File, maxPx = 1080): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compress failed')), 'image/jpeg', 0.85)
    }
    img.onerror = reject
    img.src = url
  })
}

// ─── Bingo logic ──────────────────────────────────────────────────────────────
export function checkBingo(completedIndices: Set<number>, size: number): number[][] {
  const lines: number[][] = []

  for (let r = 0; r < size; r++) {
    const row = Array.from({ length: size }, (_, c) => r * size + c)
    if (row.every(i => completedIndices.has(i))) lines.push(row)
  }
  for (let c = 0; c < size; c++) {
    const col = Array.from({ length: size }, (_, r) => r * size + c)
    if (col.every(i => completedIndices.has(i))) lines.push(col)
  }
  const diag1 = Array.from({ length: size }, (_, i) => i * size + i)
  if (diag1.every(i => completedIndices.has(i))) lines.push(diag1)
  const diag2 = Array.from({ length: size }, (_, i) => i * size + (size - 1 - i))
  if (diag2.every(i => completedIndices.has(i))) lines.push(diag2)

  return lines
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
