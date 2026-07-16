import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Settings } from 'lucide-react'

const PARTICIPANT_KEY = 'bingo_participant_id'

export default function LandingPage() {
  const navigate = useNavigate()
  const [adminTaps, setAdminTaps] = useState(0)
  const [showAdminPrompt, setShowAdminPrompt] = useState(false)
  const [adminPw, setAdminPw] = useState('')
  const [pwError, setPwError] = useState(false)

  useEffect(() => {
    // If returning user, go to welcome
    const id = localStorage.getItem(PARTICIPANT_KEY)
    if (id) navigate('/welcome', { replace: true })
  }, [navigate])

  const handleAdminTap = () => {
    const next = adminTaps + 1
    setAdminTaps(next)
    if (next >= 1) {
      setShowAdminPrompt(true)
      setAdminTaps(0)
    }
  }

  const submitAdmin = () => {
    const correct = import.meta.env.VITE_ADMIN_PASSWORD || 'admin2016'
    if (adminPw === correct) {
      setShowAdminPrompt(false)
      sessionStorage.setItem('admin_verified', 'true')
      navigate('/admin')
    } else {
      setPwError(true)
      setTimeout(() => setPwError(false), 1500)
    }
  }

  return (
    <div className="min-h-dvh cream-bg flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Admin button */}
      <button
        onClick={handleAdminTap}
        className="absolute top-5 right-5 p-2 rounded-full text-amber-300 hover:text-amber-500 transition-colors"
      >
        <Settings size={20} />
      </button>

      <motion.div
        className="flex flex-col items-center gap-6 w-full max-w-sm"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Logo */}
        <motion.div
          className="w-40 h-40 rounded-full overflow-hidden shadow-xl"
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <img
            src="/logo.jpeg"
            alt="10th Anniversary Reunion"
            className="w-full h-full object-cover"
            onError={e => {
              (e.target as HTMLImageElement).style.display = 'none'
              ;(e.target as HTMLImageElement).parentElement!.innerHTML =
                '<div class="w-full h-full orange-gradient flex items-center justify-center text-white text-5xl font-bold">10</div>'
            }}
          />
        </motion.div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-amber-900">十周年校友聚会</h1>
          <p className="text-amber-700 font-medium">欢迎回来！10年美好时光。</p>
          <p className="text-amber-600 text-sm">
            用一场有趣的Bingo游戏来庆祝吧——重聚、探索、记录回忆！
          </p>
        </div>

        {/* CTA */}
        <motion.button
          onClick={() => navigate('/register')}
          className="w-full orange-gradient text-white font-bold text-lg py-4 rounded-2xl shadow-lg"
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          🎉 &nbsp;开始
        </motion.button>

        <p className="text-amber-500 text-sm">📸 准备好拍照吧！</p>
      </motion.div>

      {/* Admin modal */}
      {showAdminPrompt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-6">
          <motion.div
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <h3 className="text-lg font-bold text-amber-900 mb-1">管理员登录</h3>
            <p className="text-sm text-gray-500 mb-4">请输入管理员密码</p>
            <input
              type="password"
              value={adminPw}
              onChange={e => setAdminPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAdmin()}
              placeholder="密码"
              className={`w-full border-2 rounded-xl px-4 py-3 outline-none mb-3 transition-colors ${
                pwError ? 'border-red-400' : 'border-amber-200 focus:border-amber-400'
              }`}
            />
            {pwError && <p className="text-red-500 text-sm mb-3">密码错误，请重试</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAdminPrompt(false); setAdminPw('') }}
                className="flex-1 border-2 border-amber-200 text-amber-700 rounded-xl py-3 font-medium"
              >
                取消
              </button>
              <button
                onClick={submitAdmin}
                className="flex-1 orange-gradient text-white rounded-xl py-3 font-bold"
              >
                进入
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
