import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import html2canvas from 'html2canvas-pro'
import { Download } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import { getParticipant, getTasks, getSubmissions, checkBingo, REQUIRED_LINES } from '../lib/db'
import type { Participant, Task, Submission } from '../types'

const PARTICIPANT_KEY = 'bingo_participant_id'
const BOARD_SIZE = 3
const TOTAL = BOARD_SIZE * BOARD_SIZE
const FREE_INDEX = Math.floor(TOTAL / 2)

export default function ProfilePage() {
  const navigate = useNavigate()
  const boardRef = useRef<HTMLDivElement>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem(PARTICIPANT_KEY)
    if (!id) { navigate('/', { replace: true }); return }
    Promise.all([getParticipant(id), getTasks(3), getSubmissions(id)]).then(([p, ts, subs]) => {
      if (!p) { navigate('/register', { replace: true }); return }
      setParticipant(p)
      setTasks(ts)
      setSubmissions(subs)
      setLoading(false)
    })
  }, [navigate])

  const handleSave = async () => {
    if (!boardRef.current || saving) return
    setSaving(true)
    try {
      const canvas = await html2canvas(boardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#FFF8E7',
      })
      const link = document.createElement('a')
      link.download = `bingo-${participant?.name || 'card'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      console.error(e)
      alert('保存图片失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-dvh cream-bg flex items-center justify-center"><div className="text-amber-400 text-4xl animate-spin">◎</div></div>
  if (!participant) return null

  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const submissionMap = new Map(submissions.map(s => [s.task_id, s]))
  const completedIndices = new Set<number>([FREE_INDEX])
  const orderedTasks: (Task | null)[] = Array(TOTAL).fill(null)
  let slot = 0
  for (let i = 0; i < TOTAL; i++) {
    if (i === FREE_INDEX) continue
    const taskId = participant.task_order[slot++]
    const task = taskMap.get(taskId) ?? null
    orderedTasks[i] = task
    if (task && submissionMap.has(task.id) && submissionMap.get(task.id)!.status !== 'rejected') {
      completedIndices.add(i)
    }
  }
  const bingoLines = checkBingo(completedIndices, BOARD_SIZE)
  const completedCount = submissions.filter(s => s.status !== 'rejected').length
  const isFinished = bingoLines.length >= REQUIRED_LINES

  const roleLabel = participant.identity === 'alumni' ? '校友' : '老师'
  const roleYearLabel = participant.identity === 'alumni'
    ? `${roleLabel} · ${participant.graduation_year}届`
    : roleLabel
  const hiddenCardLabel = participant.identity === 'alumni'
    ? `Class of ${participant.graduation_year}`
    : 'Teacher'

  const rows: { label: string; value: string | number }[] = [
    { label: '姓名', value: participant.name },
    { label: '身份', value: roleLabel },
    ...(participant.identity === 'alumni'
      ? [{ label: '毕业年份', value: participant.graduation_year ?? '' }]
      : []),
    { label: '注册时间', value: new Date(participant.created_at).toLocaleString('zh-CN') },
    { label: '已完成任务', value: `${completedCount} / ${TOTAL - 1}` },
    { label: 'Bingo线', value: `${bingoLines.length} / ${REQUIRED_LINES}` },
  ]

  return (
    <div className="min-h-dvh cream-bg flex flex-col items-center pb-24 px-6">
      <div className="w-full max-w-sm pt-10 flex flex-col items-center gap-2">
        <div className="w-20 h-20 rounded-full orange-gradient flex items-center justify-center text-white font-bold text-3xl">
          {participant.name.charAt(0).toUpperCase()}
        </div>
        <div className="text-xl font-bold text-amber-900">{participant.name}</div>
        <div className="text-amber-500 text-sm">{roleYearLabel}</div>
      </div>

      <div className="w-full max-w-sm bg-white/80 rounded-3xl mt-6 card-shadow divide-y divide-amber-100">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3.5">
            <span className="text-amber-600 text-sm">{label}</span>
            <span className="font-semibold text-amber-900 text-sm">{value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-amber-600 text-sm">完成状态</span>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            isFinished ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
          }`}>
            {isFinished ? '已完成' : '进行中'}
          </span>
        </div>
      </div>

      <motion.button
        onClick={handleSave}
        disabled={saving}
        className="w-full max-w-sm orange-gradient text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 mt-6"
        whileTap={{ scale: 0.97 }}
      >
        <Download size={18} />
        {saving ? '生成中...' : '下载我的Bingo'}
      </motion.button>

      {/* Hidden shareable card used only for html2canvas capture */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        <div
          ref={boardRef}
          className="w-[380px] rounded-3xl p-5"
          style={{ background: 'linear-gradient(135deg, #FFF8E7 0%, #FFE8A0 100%)' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full orange-gradient flex items-center justify-center text-white font-bold text-lg">
              {participant.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-amber-900 text-lg">{participant.name}</div>
              <div className="text-amber-500 text-sm">{hiddenCardLabel} · 十周年聚会</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-black text-amber-600">{bingoLines.length}</div>
              <div className="text-xs text-amber-400">条Bingo</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {orderedTasks.map((task, i) => {
              const isFree = i === FREE_INDEX
              const sub = task ? submissionMap.get(task.id) : undefined
              const isComplete = isFree || (sub && sub.status !== 'rejected')
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-xl flex items-center justify-center text-lg overflow-hidden p-1 ${
                    isFree ? 'orange-gradient' : isComplete ? 'bg-amber-200' : 'bg-white/60'
                  }`}
                >
                  {isFree ? (
                    <img src="/logo.jpeg" alt="Free" className="w-full h-full object-contain" />
                  ) : sub?.image_url ? (
                    <img src={sub.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base opacity-60">{task?.icon || '📷'}</span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-amber-500">
            <span>{completedCount + 1}/{TOTAL} 任务完成</span>
            <span>{new Date().toLocaleDateString('zh-CN')}</span>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
