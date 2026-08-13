import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Ticket, RefreshCw, LogOut } from 'lucide-react'
import type { Participant } from '../types'

const PARTICIPANT_KEY = 'bingo_participant_id'

interface CheckInGuardProps {
  participant: Participant
  onRefresh: () => Promise<void>
}

export default function CheckInGuard({ participant, onRefresh }: CheckInGuardProps) {
  const navigate = useNavigate()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      // Small timeout to make the animation feel nice and show progress
      setTimeout(() => setRefreshing(false), 600)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(PARTICIPANT_KEY)
    navigate('/', { replace: true })
  }

  if (participant.checked_in) {
    return null
  }

  return (
    <div className="min-h-dvh cream-bg flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Blur blobs */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] aspect-square rounded-full bg-amber-200/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] aspect-square rounded-full bg-orange-200/20 blur-3xl pointer-events-none" />

      <motion.div
        className="w-full max-w-sm flex flex-col items-center text-center gap-6 z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Ticket Icon with Pulse / Rotation */}
        <motion.div
          className="w-24 h-24 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shadow-lg relative"
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 2, -2, 0]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <div className="w-20 h-20 rounded-full orange-gradient flex items-center justify-center text-white">
            <Ticket size={38} className="animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500"></span>
          </span>
        </motion.div>

        {/* Messaging */}
        <div className="space-y-3">
          <h2 className="text-3xl font-black text-amber-900 tracking-tight">
            请到报到处签到
          </h2>
          <div className="bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-white/40 shadow-sm text-sm text-amber-800 leading-relaxed font-medium">
            <p className="text-amber-900 font-bold mb-1">
              您好，{participant.name}！
            </p>
            您已成功注册，但需要现场管理员在后台为您完成“报到”确认后，才能进入游戏。请联系服务台管理员进行报到。
          </div>
        </div>

        {/* Controls */}
        <div className="w-full space-y-3">
          <motion.button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full orange-gradient text-white font-bold text-base py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2"
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.02 }}
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '正在检查状态...' : '我已完成报到，进入游戏'}
          </motion.button>

          <button
            onClick={handleLogout}
            className="w-full text-amber-500 hover:text-amber-700 text-sm font-semibold py-2.5 flex items-center justify-center gap-1.5 transition-colors underline underline-offset-4"
          >
            <LogOut size={14} />
            更换账号 / 重新注册
          </button>
        </div>
      </motion.div>
    </div>
  )
}
