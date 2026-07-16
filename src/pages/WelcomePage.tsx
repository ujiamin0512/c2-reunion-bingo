import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getParticipant, getSubmissions, checkBingo, REQUIRED_LINES } from '../lib/db'
import type { Participant, Submission } from '../types'

const PARTICIPANT_KEY = 'bingo_participant_id'
const BOARD_SIZE = 3
const TOTAL = BOARD_SIZE * BOARD_SIZE // 9 tiles
const FREE_INDEX = Math.floor(TOTAL / 2) // center

export default function WelcomePage() {
  const navigate = useNavigate()
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = localStorage.getItem(PARTICIPANT_KEY)
    if (!id) { navigate('/', { replace: true }); return }

    Promise.all([getParticipant(id), getSubmissions(id)]).then(([p, subs]) => {
      if (!p) { navigate('/register', { replace: true }); return }
      setParticipant(p)
      setSubmissions(subs)
      setLoading(false)
    })
  }, [navigate])

  if (loading) return <div className="min-h-dvh cream-bg flex items-center justify-center"><div className="text-amber-400 text-4xl animate-spin">⭕</div></div>
  if (!participant) return null

  const completedTaskIds = new Set(submissions.filter(s => s.status !== 'rejected').map(s => s.task_id))
  const completedIndices = new Set<number>()
  completedIndices.add(FREE_INDEX) // free tile always complete
  participant.task_order.forEach((taskId, i) => {
    const gridIndex = i < FREE_INDEX ? i : i + 1
    if (completedTaskIds.has(taskId)) completedIndices.add(gridIndex)
  })
  const completedCount = submissions.filter(s => s.status !== 'rejected').length + 1 // +1 for free
  const bingoLines = checkBingo(completedIndices, BOARD_SIZE)

  const identityLabel = participant.identity === 'alumni'
    ? `Alumni · Class of ${participant.graduation_year}`
    : 'Teacher'

  const handleLogout = () => {
    localStorage.removeItem(PARTICIPANT_KEY)
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh cream-bg flex flex-col items-center justify-center px-6">
      <motion.div
        className="w-full max-w-sm space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-2">
          <div className="text-4xl mb-2">👋</div>
          <h2 className="text-2xl font-bold text-amber-900">
            欢迎回来，{participant.name}！
          </h2>
          <p className="text-amber-600 mt-1">准备好继续你的聚会Bingo了吗?</p>
        </div>

        {/* Profile card */}
        <div className="bg-white/80 rounded-3xl p-5 card-shadow space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full orange-gradient flex items-center justify-center text-white font-bold text-lg">
              {participant.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-amber-900">{participant.name}</div>
              <div className="text-sm text-amber-500">{identityLabel}</div>
            </div>
          </div>
          <div className="text-xs text-amber-400">
            注册时间：{new Date(participant.created_at).toLocaleString('zh-CN')}
          </div>
        </div>

        {/* Progress card */}
        <div className="bg-white/80 rounded-3xl p-5 card-shadow space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-amber-800">Bingo进度</span>
            <span className="text-amber-500 font-bold">{bingoLines.length} / {REQUIRED_LINES} 条</span>
          </div>
          <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full orange-gradient rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (completedCount / TOTAL) * 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="text-sm text-amber-600">{completedCount}/{TOTAL} 任务完成</div>
        </div>

        <motion.button
          onClick={() => navigate('/bingo')}
          className="w-full orange-gradient text-white font-bold text-lg py-4 rounded-2xl shadow-lg"
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.02 }}
        >
          ◎ &nbsp;继续游戏 →
        </motion.button>

        <p className="text-center text-amber-500 text-sm">完成{REQUIRED_LINES}条Bingo线即可完成挑战！🎯</p>

        <button
          onClick={handleLogout}
          className="w-full text-amber-400 text-sm py-2 underline underline-offset-2"
        >
          换一个账号
        </button>
      </motion.div>
    </div>
  )
}
