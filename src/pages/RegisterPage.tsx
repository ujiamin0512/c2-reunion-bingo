import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, User, BookOpen, GraduationCap } from 'lucide-react'
import { createParticipant, findExistingParticipant, getTasks, shuffle } from '../lib/db'
import type { Identity } from '../types'

const PARTICIPANT_KEY = 'bingo_participant_id'
const YEARS = Array.from({ length: 20 }, (_, i) => 2007 + i) // 2007-2026
const CLASS_OPTIONS = [
  'DAISY', 'IXORA', 'LOTUS', 'ROSE', 'TULIP', 'HIBISCUS', 
  'JASMINE', 'VIOLET', 'ALLAMANDA', 'BALSAM', 'CARNATION'
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [identity, setIdentity] = useState<Identity>('alumni')
  const [year, setYear] = useState<number | null>(null)
  const [classVal, setClassVal] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValid = name.trim() && (identity === 'teacher' || (year !== null && classVal !== ''))

  const handleSubmit = async () => {
    if (!isValid || loading) return
    setLoading(true)
    setError('')
    try {
      const existing = await findExistingParticipant(
        name.trim(),
        identity,
        identity !== 'teacher' ? year : null
      )
      if (existing) {
        localStorage.setItem(PARTICIPANT_KEY, existing.id)
        navigate('/welcome', { replace: true })
        return
      }
      const tasks = await getTasks(3)
      const shuffled = shuffle(tasks.map(t => t.id))
      const participant = await createParticipant(
        name.trim(),
        identity,
        identity !== 'teacher' ? year : null,
        shuffled,
        identity !== 'teacher' ? classVal : null
      )
      localStorage.setItem(PARTICIPANT_KEY, participant.id)
      navigate('/bingo', { replace: true })
    } catch (e) {
      setError('注册失败，请重试')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh cream-bg flex flex-col px-6 pt-safe">
      {/* Header */}
      <div className="flex items-center pt-6 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-amber-700 font-medium"
        >
          <ArrowLeft size={18} />
          返回
        </button>
      </div>

      <motion.div
        className="flex-1 flex flex-col gap-6"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h2 className="text-2xl font-bold text-amber-900">加入我们！</h2>
          <p className="text-amber-600 mt-1">注册开始你的游戏。</p>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-amber-800 font-medium text-sm">
            <User size={15} /> 姓名
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value.toUpperCase())}
            placeholder="请输入您的姓名"
            className="w-full border-2 border-amber-100 focus:border-amber-400 rounded-2xl px-4 py-3.5 outline-none bg-white/80 text-amber-900 placeholder-amber-300 transition-colors uppercase"
          />
          <p className="text-xs text-amber-500/80 leading-normal pl-1">
            * 请根据您报名时登记的名字（中文或英文）填入；若报名时填写的为中英双语，请以英文名字为准（系统会自动将英文字母转为大写）。
          </p>
        </div>

        {/* Identity */}
        <div className="space-y-2">
          <label className="text-amber-800 font-medium text-sm">我是...</label>
          <div className="grid grid-cols-3 gap-2">
            {([['alumni', '🎓', '校友'], ['student', '🏫', '在校生'], ['teacher', '📖', '老师']] as const).map(
              ([val, icon, label]) => (
                <button
                  key={val}
                  onClick={() => setIdentity(val as Identity)}
                  className={`flex items-center gap-1 px-2.5 py-3 rounded-2xl border-2 text-sm font-medium transition-all ${
                    identity === val
                      ? 'border-amber-400 bg-amber-50 text-amber-800'
                      : 'border-gray-200 bg-white/60 text-gray-500'
                  }`}
                >
                  <input
                    type="radio"
                    checked={identity === val}
                    readOnly
                    className="accent-amber-500"
                  />
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Year & Class (only for alumni & student) */}
        {identity !== 'teacher' && (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.25 }}
          >
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-amber-800 font-medium text-sm">
                <BookOpen size={15} /> 毕业年份
              </label>
              <select
                value={year ?? ''}
                onChange={e => setYear(e.target.value ? Number(e.target.value) : null)}
                className="w-full border-2 border-amber-100 focus:border-amber-400 rounded-2xl px-4 py-3.5 outline-none bg-white/80 text-amber-900 transition-colors appearance-none"
              >
                <option value="">选择年份</option>
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-amber-800 font-medium text-sm">
                <GraduationCap size={15} /> 班级
              </label>
              <select
                value={classVal}
                onChange={e => setClassVal(e.target.value)}
                className="w-full border-2 border-amber-100 focus:border-amber-400 rounded-2xl px-4 py-3.5 outline-none bg-white/80 text-amber-900 transition-colors appearance-none"
              >
                <option value="">选择班级</option>
                {CLASS_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </motion.div>
        )}

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <motion.button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg transition-all mt-auto ${
            isValid && !loading ? 'orange-gradient' : 'orange-gradient-disabled cursor-not-allowed'
          }`}
          whileTap={isValid ? { scale: 0.97 } : {}}
        >
          {loading ? '注册中...' : '进入游戏 🎯'}
        </motion.button>

        <div className="h-6" />
      </motion.div>
    </div>
  )
}
