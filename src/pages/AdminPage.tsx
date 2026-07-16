import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, ListChecks, Trophy, Settings, LogOut,
  Plus, Pencil, Trash2, CheckCircle, XCircle, Search, Download, Menu,
  Eye, GraduationCap, BookOpen, X, ChevronRight
} from 'lucide-react'
import {
  getAllParticipants, getAllTasks, getAllSubmissions,
  createParticipant, updateParticipant, deleteParticipant,
  createTask, updateTask, deleteTask,
  updateSubmissionStatus, checkBingo, getTasks, shuffle, REQUIRED_LINES
} from '../lib/db'
import type { Participant, Task, Submission, BoardSize, Identity } from '../types'

type AdminTab = 'participants' | 'tasks' | 'submissions' | 'leaderboard'

const BOARD_SIZE = 3
const TOTAL = BOARD_SIZE * BOARD_SIZE
const FREE_INDEX = Math.floor(TOTAL / 2)
const YEARS = Array.from({ length: 19 }, (_, i) => 2007 + i)

export default function AdminPage() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_verified') === 'true')
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState(false)
  const [tab, setTab] = useState<AdminTab>('participants')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Data
  const [participants, setParticipants] = useState<Participant[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [identityFilter, setIdentityFilter] = useState<'all' | Identity>('all')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Forms
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null)
  const [taskBoardSize, setTaskBoardSize] = useState<BoardSize>(3)
  const [editingParticipant, setEditingParticipant] = useState<Partial<Participant> | null>(null)
  const [savingParticipant, setSavingParticipant] = useState(false)

  // Submission review
  const [reviewingParticipantId, setReviewingParticipantId] = useState<string | null>(null)
  const [rejectedTaskIds, setRejectedTaskIds] = useState<Set<number>>(new Set())
  const [reviewSaving, setReviewSaving] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    const [ps, ts, subs] = await Promise.all([getAllParticipants(), getAllTasks(), getAllSubmissions()])
    setParticipants(ps)
    setTasks(ts)
    setSubmissions(subs)
    setLoading(false)
  }

  useEffect(() => {
    if (authed) loadAll()
  }, [authed])

  const loginAdmin = () => {
    const correct = import.meta.env.VITE_ADMIN_PASSWORD || 'admin2016'
    if (pw === correct) {
      sessionStorage.setItem('admin_verified', 'true')
      setAuthed(true)
    } else {
      setPwErr(true)
      setTimeout(() => setPwErr(false), 1500)
    }
  }

  const logoutAdmin = () => {
    sessionStorage.removeItem('admin_verified')
    navigate('/')
  }

  // ── Shared stats helper ─────────────────────────────────────────────────────
  const getParticipantStats = (p: Participant) => {
    const pSubs = submissions.filter(s => s.participant_id === p.id && s.status !== 'rejected')
    const completedIds = new Set(pSubs.map(s => s.task_id))
    const completedIndices = new Set<number>([FREE_INDEX])
    p.task_order.forEach((id, idx) => {
      const gi = idx < FREE_INDEX ? idx : idx + 1
      if (completedIds.has(id)) completedIndices.add(gi)
    })
    const bingoLines = checkBingo(completedIndices, BOARD_SIZE)
    const lastSubmissionAt = pSubs.reduce<string | null>(
      (latest, s) => (!latest || s.created_at > latest) ? s.created_at : latest,
      null
    )
    return { completedCount: pSubs.length, bingoCount: bingoLines.length, lastSubmissionAt }
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-dvh cream-bg flex items-center justify-center px-6">
        <motion.div
          className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-6">
            <Settings size={40} className="text-amber-400 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-amber-900">管理员登录</h2>
          </div>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loginAdmin()}
            placeholder="管理员密码"
            className={`w-full border-2 rounded-xl px-4 py-3 outline-none mb-3 ${pwErr ? 'border-red-400' : 'border-amber-200 focus:border-amber-400'}`}
          />
          {pwErr && <p className="text-red-500 text-sm mb-3">密码错误</p>}
          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="flex-1 border-2 border-amber-200 text-amber-700 rounded-xl py-3">返回</button>
            <button onClick={loginAdmin} className="flex-1 orange-gradient text-white rounded-xl py-3 font-bold">进入</button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Sidebar tabs ───────────────────────────────────────────────────────────
  const navItems: { id: AdminTab; icon: React.ElementType; label: string }[] = [
    { id: 'participants', icon: Users, label: '参与者' },
    { id: 'tasks', icon: ListChecks, label: '任务管理' },
    { id: 'submissions', icon: CheckCircle, label: '提交审核' },
    { id: 'leaderboard', icon: Trophy, label: '排行榜' },
  ]

  // NOTE: rendered via direct function calls (renderX(...)), never as <X /> JSX
  // component invocations. Defining these as components and using <X/> would
  // give React a fresh function identity every render, forcing a full
  // unmount/remount of their subtree (including any focused <input>) on every
  // keystroke — that was the cause of the "新增任务" modal flicker/refocus bug.
  const renderSidebar = (mobile: boolean) => (
    <div className={`flex flex-col h-full ${mobile ? '' : 'w-56 min-h-screen'} bg-white/90 border-r border-amber-100 py-6`}>
      <div className="px-5 mb-6">
        <div className="text-sm font-bold text-amber-400 uppercase tracking-wider">管理后台</div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setSidebarOpen(false) }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors font-medium ${
              tab === id ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-amber-50 hover:text-amber-700'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
      <div className="px-3 mt-4">
        <button
          onClick={logoutAdmin}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} />
          退出
        </button>
      </div>
    </div>
  )

  // ── Participants tab ───────────────────────────────────────────────────────
  const totalCount = participants.length
  const alumniCount = participants.filter(p => p.identity === 'alumni').length
  const teacherCount = participants.filter(p => p.identity === 'teacher').length
  const finishedCount = participants.filter(p => getParticipantStats(p).bingoCount >= REQUIRED_LINES).length

  const years = Array.from(
    new Set(participants.filter(p => p.identity === 'alumni' && p.graduation_year).map(p => p.graduation_year as number))
  ).sort((a, b) => b - a)

  const filteredParticipants = participants.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (identityFilter !== 'all' && p.identity !== identityFilter) return false
    if (yearFilter !== 'all' && String(p.graduation_year) !== yearFilter) return false
    return true
  })

  const exportCSV = () => {
    const rows = [
      ['ID', '姓名', '身份', '毕业年份', '注册时间'].join(','),
      ...participants.map(p => [p.id, p.name, p.identity, p.graduation_year ?? '', p.created_at].join(','))
    ].join('\n')
    const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'participants.csv'
    link.click()
  }

  const saveParticipant = async () => {
    if (!editingParticipant?.name?.trim()) return
    const identity = editingParticipant.identity ?? 'alumni'
    const year = identity === 'alumni' ? (editingParticipant.graduation_year ?? null) : null
    setSavingParticipant(true)
    try {
      if (editingParticipant.id) {
        await updateParticipant(editingParticipant.id, {
          name: editingParticipant.name.trim(),
          identity,
          graduation_year: year,
        })
      } else {
        const poolTasks = await getTasks(3)
        const shuffled = shuffle(poolTasks.map(t => t.id))
        await createParticipant(editingParticipant.name.trim(), identity, year, shuffled)
      }
      setEditingParticipant(null)
      loadAll()
    } finally {
      setSavingParticipant(false)
    }
  }

  const renderStatCard = (icon: React.ElementType, label: string, value: number, color: string) => {
    const Icon = icon
    return (
      <div className="bg-white/80 rounded-2xl p-4 flex flex-col gap-1 card-shadow">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
        <div className="text-2xl font-black text-amber-900">{value}</div>
        <div className="text-xs text-amber-500">{label}</div>
      </div>
    )
  }

  const renderParticipantsTab = () => (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {renderStatCard(Users, '总参与人数', totalCount, 'bg-blue-100 text-blue-500')}
        {renderStatCard(CheckCircle, '已完成人数', finishedCount, 'bg-green-100 text-green-500')}
        {renderStatCard(GraduationCap, '校友', alumniCount, 'bg-amber-100 text-amber-500')}
        {renderStatCard(BookOpen, '老师', teacherCount, 'bg-purple-100 text-purple-500')}
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索姓名..."
            className="w-full pl-9 pr-4 py-2.5 border-2 border-amber-100 focus:border-amber-400 rounded-xl outline-none bg-white/80 text-sm"
          />
        </div>
        <select
          value={identityFilter}
          onChange={e => setIdentityFilter(e.target.value as 'all' | Identity)}
          className="border-2 border-amber-100 rounded-xl px-3 py-2.5 text-sm bg-white/80 outline-none"
        >
          <option value="all">全部</option>
          <option value="alumni">校友</option>
          <option value="teacher">老师</option>
        </select>
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="border-2 border-amber-100 rounded-xl px-3 py-2.5 text-sm bg-white/80 outline-none"
        >
          <option value="all">全部年份</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={exportCSV} className="flex items-center gap-1.5 border-2 border-amber-200 text-amber-700 rounded-xl px-4 py-2.5 text-sm font-medium">
          <Download size={15} /> 导出
        </button>
        <button
          onClick={() => setEditingParticipant({ name: '', identity: 'alumni', graduation_year: null })}
          className="flex items-center gap-2 orange-gradient text-white rounded-xl px-4 py-2.5 text-sm font-bold"
        >
          <Plus size={16} /> 新增参与者
        </button>
      </div>

      <div className="text-sm text-amber-500">共 {filteredParticipants.length} 位参与者</div>

      <div className="space-y-2">
        {filteredParticipants.map(p => {
          const { bingoCount, lastSubmissionAt } = getParticipantStats(p)
          const isFinished = bingoCount >= REQUIRED_LINES
          const pSubmissions = submissions.filter(s => s.participant_id === p.id)
          const isExpanded = expandedId === p.id
          return (
            <div key={p.id} className="bg-white/80 rounded-2xl p-4 card-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full orange-gradient flex items-center justify-center text-white font-bold flex-shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-amber-900 truncate">{p.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-medium">
                      {p.identity === 'alumni' ? '校友' : '老师'}
                    </span>
                    {p.identity === 'alumni' && (
                      <span className="text-xs text-amber-400">Class of {p.graduation_year}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isFinished ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                      {isFinished ? '已完成' : '进行中'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium">
                      {bingoCount} 条线
                    </span>
                    {p.submitted_at && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
                        已提交
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-amber-400 mt-1">
                    注册：{new Date(p.created_at).toLocaleString('zh-CN')}
                    {lastSubmissionAt && <> · 完成：{new Date(lastSubmissionAt).toLocaleString('zh-CN')}</>}
                  </div>
                </div>
                {pSubmissions.length > 0 && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    className="p-2 text-amber-400 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    <Eye size={16} />
                  </button>
                )}
                <button
                  onClick={() => setEditingParticipant(p)}
                  className="p-2 text-amber-400 hover:bg-amber-50 rounded-lg transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={async () => { await deleteParticipant(p.id); loadAll() }}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {isExpanded && (
                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-amber-100">
                  {pSubmissions.map(s => (
                    <img key={s.id} src={s.image_url} alt="" className="aspect-square object-cover rounded-lg" />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {filteredParticipants.length === 0 && (
          <div className="text-center text-amber-400 py-8">没有找到参与者</div>
        )}
      </div>

      {/* Create / Edit participant modal */}
      <AnimatePresence>
        {editingParticipant && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <motion.div
              className="bg-white rounded-3xl p-6 w-full max-w-sm"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
            >
              <h3 className="font-bold text-amber-900 mb-4">{editingParticipant.id ? '编辑参与者' : '新增参与者'}</h3>
              <div className="space-y-3">
                <input
                  value={editingParticipant.name || ''}
                  onChange={e => setEditingParticipant(p => ({ ...p!, name: e.target.value.toUpperCase() }))}
                  placeholder="姓名"
                  className="w-full border-2 border-amber-100 focus:border-amber-400 rounded-xl px-4 py-2.5 outline-none text-sm uppercase"
                />
                <div className="grid grid-cols-2 gap-3">
                  {(['alumni', 'teacher'] as const).map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditingParticipant(p => ({ ...p!, identity: val }))}
                      className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium ${
                        (editingParticipant.identity ?? 'alumni') === val
                          ? 'border-amber-400 bg-amber-50 text-amber-800'
                          : 'border-gray-200 text-gray-500'
                      }`}
                    >
                      {val === 'alumni' ? '校友' : '老师'}
                    </button>
                  ))}
                </div>
                {(editingParticipant.identity ?? 'alumni') === 'alumni' && (
                  <select
                    value={editingParticipant.graduation_year ?? ''}
                    onChange={e => setEditingParticipant(p => ({ ...p!, graduation_year: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full border-2 border-amber-100 rounded-xl px-4 py-2.5 outline-none text-sm"
                  >
                    <option value="">选择毕业年份</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setEditingParticipant(null)} className="flex-1 border-2 border-amber-200 text-amber-700 rounded-xl py-3">取消</button>
                <button
                  onClick={saveParticipant}
                  disabled={savingParticipant || !editingParticipant.name?.trim()}
                  className="flex-1 orange-gradient text-white rounded-xl py-3 font-bold disabled:opacity-60"
                >
                  {savingParticipant ? '保存中...' : '保存'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )

  // ── Tasks tab ──────────────────────────────────────────────────────────────
  const taskRequiredCount = taskBoardSize * taskBoardSize - 1
  const taskSelectedCount = tasks.filter(t => t.board_size === taskBoardSize && t.is_active).length
  const taskSelectionExact = taskSelectedCount === taskRequiredCount

  const toggleTaskSelection = async (task: Task) => {
    const isSelected = task.board_size === taskBoardSize && task.is_active
    if (isSelected) {
      await updateTask(task.id, { is_active: false })
    } else {
      if (taskSelectedCount >= taskRequiredCount) {
        alert(`${taskBoardSize}×${taskBoardSize} 棋盘只能选择 ${taskRequiredCount} 个任务，请先取消其他任务`)
        return
      }
      await updateTask(task.id, { board_size: taskBoardSize, is_active: true })
    }
    loadAll()
  }

  const saveTask = async () => {
    if (!editingTask?.title) return
    if (editingTask.id) {
      await updateTask(editingTask.id, {
        title: editingTask.title,
        icon: editingTask.icon || '📷',
        description: editingTask.description || null,
      })
    } else {
      await createTask({
        title: editingTask.title,
        icon: editingTask.icon || '📷',
        description: editingTask.description || null,
        is_active: false,
        board_size: taskBoardSize,
      })
    }
    setEditingTask(null)
    loadAll()
  }

  const renderTasksTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={taskBoardSize}
          onChange={e => setTaskBoardSize(Number(e.target.value) as BoardSize)}
          className="border-2 border-amber-200 rounded-xl px-4 py-2.5 text-sm font-medium text-amber-800 bg-white outline-none"
        >
          <option value={3}>3×3 棋盘</option>
          <option value={4}>4×4 棋盘</option>
          <option value={5}>5×5 棋盘</option>
        </select>
        <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${taskSelectionExact ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
          已选 {taskSelectedCount} / {taskRequiredCount}
        </span>
        <button
          onClick={() => setEditingTask({ title: '', icon: '📷', description: '' })}
          className="flex items-center gap-2 orange-gradient text-white rounded-xl px-4 py-2.5 text-sm font-bold ml-auto"
        >
          <Plus size={16} /> 新增任务
        </button>
      </div>
      {!taskSelectionExact && (
        <p className="text-xs text-amber-500">
          {taskBoardSize}×{taskBoardSize} 棋盘需要恰好选择 {taskRequiredCount} 个任务（中间为免费格，不计入内）
        </p>
      )}

      <div className="space-y-2">
        {tasks.map(task => {
          const isSelected = task.board_size === taskBoardSize && task.is_active
          const assignedElsewhere = task.is_active && task.board_size !== taskBoardSize
          return (
            <div key={task.id} className={`bg-white/80 rounded-2xl p-4 flex items-center gap-3 card-shadow ${isSelected ? 'ring-2 ring-amber-300' : ''}`}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleTaskSelection(task)}
                className="w-5 h-5 accent-amber-500 flex-shrink-0"
              />
              <span className="text-2xl">{task.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-amber-900 truncate">{task.title}</div>
                <div className="text-xs text-amber-400">
                  {assignedElsewhere ? `已用于 ${task.board_size}×${task.board_size} 棋盘` : isSelected ? '已选中' : '未选中'}
                </div>
              </div>
              <button onClick={() => setEditingTask(task)} className="p-2 text-amber-400 hover:bg-amber-50 rounded-lg">
                <Pencil size={15} />
              </button>
              <button onClick={async () => { await deleteTask(task.id); loadAll() }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                <Trash2 size={15} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Edit / Create modal */}
      <AnimatePresence>
        {editingTask && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <motion.div
              className="bg-white rounded-3xl p-6 w-full max-w-sm"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
            >
              <h3 className="font-bold text-amber-900 mb-4">{editingTask.id ? '编辑任务' : '新增任务'}</h3>
              <div className="space-y-3">
                <input
                  value={editingTask.title || ''}
                  onChange={e => setEditingTask(t => ({ ...t!, title: e.target.value }))}
                  placeholder="任务名称"
                  className="w-full border-2 border-amber-100 focus:border-amber-400 rounded-xl px-4 py-2.5 outline-none text-sm"
                />
                <input
                  value={editingTask.icon || ''}
                  onChange={e => setEditingTask(t => ({ ...t!, icon: e.target.value }))}
                  placeholder="图标 Emoji"
                  className="w-full border-2 border-amber-100 focus:border-amber-400 rounded-xl px-4 py-2.5 outline-none text-sm"
                />
                <textarea
                  value={editingTask.description || ''}
                  onChange={e => setEditingTask(t => ({ ...t!, description: e.target.value }))}
                  placeholder="描述（可选）"
                  rows={2}
                  className="w-full border-2 border-amber-100 focus:border-amber-400 rounded-xl px-4 py-2.5 outline-none text-sm resize-none"
                />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setEditingTask(null)} className="flex-1 border-2 border-amber-200 text-amber-700 rounded-xl py-3">取消</button>
                <button onClick={saveTask} className="flex-1 orange-gradient text-white rounded-xl py-3 font-bold">
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )

  // ── Submissions tab ────────────────────────────────────────────────────────
  // Grouped by participant, sorted by earliest submission time (submitted_at).
  // Only participants with at least one 'pending' submission show up here —
  // 'draft' (uploaded but not yet Submitted by the user) stays invisible.
  const pendingByParticipant = participants
    .map(p => ({
      participant: p,
      pendingCount: submissions.filter(s => s.participant_id === p.id && s.status === 'pending').length,
    }))
    .filter(g => g.pendingCount > 0)
    .sort((a, b) => {
      const aTime = a.participant.submitted_at ? new Date(a.participant.submitted_at).getTime() : Infinity
      const bTime = b.participant.submitted_at ? new Date(b.participant.submitted_at).getTime() : Infinity
      return aTime - bTime
    })

  const openReview = (participantId: string) => {
    setReviewingParticipantId(participantId)
    setRejectedTaskIds(new Set())
  }

  const toggleReject = (taskId: number) => {
    setRejectedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const confirmReview = async () => {
    if (!reviewingParticipantId) return
    const group = submissions.filter(s => s.status === 'pending' && s.participant_id === reviewingParticipantId)
    setReviewSaving(true)
    try {
      await Promise.all(group.map(s =>
        updateSubmissionStatus(s.id, rejectedTaskIds.has(s.task_id) ? 'rejected' : 'approved')
      ))
      setReviewingParticipantId(null)
      await loadAll()
    } finally {
      setReviewSaving(false)
    }
  }

  const renderSubmissionsTab = () => (
    <div className="space-y-3">
      <div className="text-sm text-amber-500">{pendingByParticipant.length} 位参与者待审核</div>
      {pendingByParticipant.map(({ participant: p, pendingCount }) => (
        <button
          key={p.id}
          onClick={() => openReview(p.id)}
          className="w-full bg-white/80 rounded-2xl p-4 flex items-center gap-3 card-shadow text-left"
        >
          <div className="w-10 h-10 rounded-full orange-gradient flex items-center justify-center text-white font-bold flex-shrink-0">
            {p.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-amber-900 truncate">{p.name}</div>
            <div className="text-xs text-amber-400">
              {p.identity === 'alumni' ? `${p.graduation_year}届校友` : '老师'}
              {p.submitted_at && <> · 提交于 {new Date(p.submitted_at).toLocaleString('zh-CN')}</>}
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-600 font-bold flex-shrink-0">
            {pendingCount} 张待审
          </span>
          <ChevronRight size={18} className="text-amber-300 flex-shrink-0" />
        </button>
      ))}
      {pendingByParticipant.length === 0 && (
        <div className="text-center text-amber-400 py-8">还没有待审核的提交</div>
      )}
    </div>
  )

  const renderReviewModal = () => {
    if (!reviewingParticipantId) return null
    const p = participants.find(x => x.id === reviewingParticipantId)
    const group = submissions.filter(s => s.status === 'pending' && s.participant_id === reviewingParticipantId)
    const taskMap = new Map(tasks.map(t => [t.id, t]))

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
        <motion.div
          className="bg-white rounded-3xl w-full max-w-sm max-h-[85vh] flex flex-col"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="flex items-center justify-between p-5 border-b border-amber-100">
            <div>
              <h3 className="font-bold text-amber-900">{p?.name || '审核'}</h3>
              <p className="text-xs text-amber-400 mt-0.5">点击照片标记为不通过，其余将一键通过</p>
            </div>
            <button onClick={() => setReviewingParticipantId(null)}>
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-3">
            {group.map(s => {
              const task = taskMap.get(s.task_id)
              const isRejected = rejectedTaskIds.has(s.task_id)
              return (
                <button
                  key={s.id}
                  onClick={() => toggleReject(s.task_id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-colors ${
                    isRejected ? 'border-red-400 bg-red-50' : 'border-amber-100 bg-white/70'
                  }`}
                >
                  <img src={s.image_url} alt="" className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{task?.icon || '📷'}</span>
                      <span className="font-semibold text-amber-900 text-sm truncate">{task?.title || '未知任务'}</span>
                    </div>
                    <div className={`text-xs mt-1 font-medium ${isRejected ? 'text-red-500' : 'text-green-600'}`}>
                      {isRejected ? '将标记为不通过' : '将通过'}
                    </div>
                  </div>
                  {isRejected ? (
                    <XCircle size={20} className="text-red-500 flex-shrink-0" />
                  ) : (
                    <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="p-5 border-t border-amber-100">
            <button
              onClick={confirmReview}
              disabled={reviewSaving || group.length === 0}
              className="w-full orange-gradient text-white rounded-2xl py-3.5 font-bold disabled:opacity-60"
            >
              {reviewSaving
                ? '处理中...'
                : `通过其余 ${group.length - rejectedTaskIds.size} 项，拒绝 ${rejectedTaskIds.size} 项`}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Leaderboard tab ────────────────────────────────────────────────────────
  // Sort: highest bingo-line count first; ties broken by earliest "提交" time
  // (participants who haven't hit the Bingo-page Submit button rank after
  // those who have, within the same line count).
  const renderLeaderboardTab = () => {
    const ranked = participants
      .map(p => ({ ...p, ...getParticipantStats(p) }))
      .sort((a, b) => {
        if (b.bingoCount !== a.bingoCount) return b.bingoCount - a.bingoCount
        const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : Infinity
        const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : Infinity
        return aTime - bTime
      })

    return (
      <div className="space-y-2">
        {ranked.map((p, i) => (
          <div key={p.id} className="bg-white/80 rounded-2xl p-4 flex items-center gap-3 card-shadow">
            <span className="w-8 text-center font-bold text-lg">{['🥇','🥈','🥉'][i] || `#${i+1}`}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-amber-900 truncate">{p.name}</div>
              <div className="text-xs text-amber-400">
                {p.completedCount}/{TOTAL-1} 完成
                {p.submitted_at && <> · 已提交 {new Date(p.submitted_at).toLocaleString('zh-CN')}</>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-amber-600 text-lg">{p.bingoCount}</div>
              <div className="text-xs text-amber-400">条Bingo</div>
            </div>
          </div>
        ))}
        {ranked.length === 0 && (
          <div className="text-center text-amber-400 py-8">还没有参与者</div>
        )}
      </div>
    )
  }

  const tabContent: Record<AdminTab, React.ReactNode> = {
    participants: renderParticipantsTab(),
    tasks: renderTasksTab(),
    submissions: renderSubmissionsTab(),
    leaderboard: renderLeaderboardTab(),
  }

  return (
    <div className="min-h-dvh cream-bg flex">
      {/* Desktop sidebar */}
      <div className="hidden md:block flex-shrink-0">
        {renderSidebar(false)}
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              className="fixed top-0 left-0 bottom-0 w-56 z-50 md:hidden"
              initial={{ x: -224 }} animate={{ x: 0 }} exit={{ x: -224 }}
              transition={{ type: 'spring', damping: 30 }}
            >
              {renderSidebar(true)}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 py-4 bg-white/80 border-b border-amber-100">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1 text-amber-600">
            <Menu size={22} />
          </button>
          <h1 className="font-bold text-amber-900 text-lg">
            {navItems.find(n => n.id === tab)?.label}
          </h1>
          {loading && <div className="ml-auto text-amber-400 text-sm animate-pulse">加载中...</div>}
        </div>

        <div className="flex-1 p-5 overflow-auto">
          {tabContent[tab]}
        </div>
      </div>

      <AnimatePresence>
        {reviewingParticipantId && renderReviewModal()}
      </AnimatePresence>
    </div>
  )
}
