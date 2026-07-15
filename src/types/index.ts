export type Identity = 'alumni' | 'teacher'
export type SubmissionStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type BoardSize = 3 | 4 | 5

export interface Participant {
  id: string
  name: string
  identity: Identity
  graduation_year: number | null
  task_order: number[]
  created_at: string
  submitted_at: string | null
}

export interface Task {
  id: number
  title: string
  description: string | null
  icon: string
  is_active: boolean
  board_size: BoardSize
  created_at: string
}

export interface Submission {
  id: string
  participant_id: string
  task_id: number
  image_url: string
  status: SubmissionStatus
  created_at: string
  task?: Task
  participant?: Participant
}

export interface BingoCell {
  task: Task | null
  isFree: boolean
  submission: Submission | null
}
