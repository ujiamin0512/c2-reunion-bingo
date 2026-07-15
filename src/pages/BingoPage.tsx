import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactConfetti from 'react-confetti'
import html2canvas from 'html2canvas-pro'
import { Download, Send } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import BingoTile from '../components/BingoTile'
import { getParticipant, getTasks, getSubmissions, checkBingo, submitParticipant } from '../lib/db'
import type { Participant, Task, Submission } from '../types'

const PARTICIPANT_KEY = 'bingo_participant_id'
const BOARD_SIZE = 3
const TOTAL = BOARD_SIZE * BOARD_SIZE
const FREE_INDEX = Math.floor(TOTAL / 2) // index 4 for 3x3

export default function BingoPage() {
  const navigate = useNavigate()
  const boardRef = useRef<HTMLDivElement>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [prevBingoCount, setPrevBingoCount] = useState(0)
  const [showCelebration, setShowCelebration] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const participantId = localStorage.getItem(PARTICIPANT_KEY)

  useEffect(() => {
    if (!participantId) { navigate('/', { replace: true }); return }
    loadData(participantId)
  }, [participantId, navigate])

  const loadData = useCallback(async (id: string) => {
    const [p, allTasks, subs] = await Promise.all([
      getParticipant(id),
      getTasks(3),
      getSubmissions(id),
    ])
    if (!p) { navigate('/register', { replace: true }); return }
    setParticipant(p)
    setTasks(allTasks)
    setSubmissions(subs)
    setLoading(false)
  }, [navigate])

  const refresh = useCallback(() => {
    if (participantId) loadData(participantId)
  }, [participantId, loadData])

  // Build ordered task list: [task0, task1, task2, task3, FREE, task4, task5, task6, task7]
  const orderedTasks: (Task | null)[] = Array(TOTAL).fill(null)
  if (participant && tasks.length > 0) {
    const taskMap = new Map(tasks.map(t => [t.id, t]))
    let taskSlot = 0
    for (let i = 0; i < TOTAL; i++) {
      if (i === FREE_INDEX) continue
      const taskId = participant.task_order[taskSlot++]
      orderedTasks[i] = taskMap.get(taskId) ?? null
    }
  }

  const submissionMap = new Map(submissions.map(s => [s.task_id, s]))

  // Compute bingo
  const completedIndices = new Set<number>()
  completedIndices.add(FREE_INDEX)
  orderedTasks.forEach((task, i) => {
    if (task && submissionMap.has(task.id) && submissionMap.get(task.id)!.status !== 'rejected') {
      completedIndices.add(i)
    }
  })
  const bingoLines = checkBingo(completedIndices, BOARD_SIZE)
  const highlightedCells = new Set(bingoLines.flat())
  const completedTaskCount = submissions.filter(s => s.status !== 'rejected').length

  // Trigger celebration on new bingo
  useEffect(() => {
    if (bingoLines.length > prevBingoCount && prevBingoCount >= 0 && !loading) {
      setShowCelebration(true)
      setTimeout(() => setShowCelebration(false), 4000)
    }
    setPrevBingoCount(bingoLines.length)
  }, [bingoLines.length]) // eslint-disable-line

  const handleSaveImage = async () => {
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
      alert('下载图片失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!participantId || submitting || completedTaskCount === 0) return
    setSubmitting(true)
    try {
      await submitParticipant(participantId)
      await loadData(participantId)
    } catch (e) {
      console.error(e)
      alert('提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh cream-bg flex items-center justify-center">
        <div className="text-amber-400 text-4xl animate-spin">◎</div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh cream-bg flex flex-col pb-20">
      {/* Confetti */}
      {showCelebration && (
        <ReactConfetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={300}
          colors={['#F59E0B', '#F97316', '#FCD34D', '#FBBF24', '#FDE68A']}
        />
      )}

      {/* Celebration banner */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            className="fixed top-0 left-0 right-0 z-50 orange-gradient text-white text-center py-4 font-bold text-lg shadow-lg"
            initial={{ y: -80 }}
            animate={{ y: 0 }}
            exit={{ y: -80 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            🎉 Bingo！恭喜完成一条线！
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-3">
        <h1 className="text-xl font-bold text-amber-900">聚会Bingo</h1>
        <button
          onClick={handleSaveImage}
          disabled={saving}
          className="flex items-center gap-1.5 border-2 border-amber-200 rounded-xl px-3 py-2 text-amber-700 text-sm font-medium disabled:opacity-60"
        >
          <Download size={15} />
          {saving ? '下载中...' : '下载'}
        </button>
      </div>

      {/* Progress */}
      <div className="mx-5 bg-white/80 rounded-2xl p-4 card-shadow mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-amber-800">Bingo进度</span>
          <span className="text-amber-500 font-bold text-sm">{bingoLines.length} / 3 条</span>
        </div>
        <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full orange-gradient rounded-full"
            animate={{ width: `${Math.min(100, (completedTaskCount + 1) / TOTAL * 100)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="text-xs text-amber-500 mt-1.5">{completedTaskCount + 1}/{TOTAL} 任务</div>
      </div>

      {/* Grid */}
      <div className="flex-1 px-5">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
        >
          {orderedTasks.map((task, i) => (
            <BingoTile
              key={i}
              task={task}
              isFree={i === FREE_INDEX}
              submission={task ? (submissionMap.get(task.id) ?? null) : null}
              participantId={participantId!}
              isHighlighted={highlightedCells.has(i)}
              onUpdate={refresh}
            />
          ))}
        </div>
      </div>

      <p className="text-center text-amber-400 text-xs mt-4 mb-2">完成3条Bingo线即可完成挑战！🎯</p>

      {/* Submit */}
      <div className="px-5 mt-2">
        <motion.button
          onClick={handleSubmit}
          disabled={completedTaskCount === 0 || submitting}
          className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
            completedTaskCount === 0
              ? 'orange-gradient-disabled text-white cursor-not-allowed'
              : 'orange-gradient text-white shadow-lg'
          }`}
          whileTap={completedTaskCount > 0 ? { scale: 0.97 } : {}}
        >
          <Send size={16} />
          {submitting ? '提交中...' : participant?.submitted_at ? '重新提交' : '提交我的Bingo'}
        </motion.button>
        {participant?.submitted_at && !submitting && (
          <p className="text-center text-amber-400 text-xs mt-2">
            已于 {new Date(participant.submitted_at).toLocaleString('zh-CN')} 提交
          </p>
        )}
      </div>

      {/* Hidden shareable card used only for html2canvas capture */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        <div
          ref={boardRef}
          className="w-[380px] rounded-3xl p-5"
          style={{ background: 'linear-gradient(135deg, #FFF8E7 0%, #FFE8A0 100%)' }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full orange-gradient flex items-center justify-center text-white font-bold text-lg">
              {participant?.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-amber-900 text-lg">{participant?.name}</div>
              <div className="text-amber-500 text-sm">十周年聚会Bingo</div>
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
                    <img src="/new-logo.png" alt="Free" className="w-full h-full object-contain" />
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
            <span>{completedTaskCount + 1}/{TOTAL} 任务完成</span>
            <span>{new Date().toLocaleDateString('zh-CN')}</span>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
