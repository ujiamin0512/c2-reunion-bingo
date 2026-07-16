import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, CheckCircle, RefreshCw, X, XCircle } from 'lucide-react'
import type { Task, Submission } from '../types'
import { uploadImage, upsertSubmission, deleteSubmission } from '../lib/db'

interface Props {
  task: Task | null
  isFree: boolean
  submission: Submission | null
  participantId: string
  isHighlighted?: boolean
  onUpdate: () => void
}

export default function BingoTile({ task, isFree, submission, participantId, isHighlighted, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isComplete = isFree || (submission !== null && submission.status !== 'rejected')
  const isDraft = submission?.status === 'draft'
  const isPending = submission?.status === 'pending'
  const isApproved = submission?.status === 'approved'
  const isRejected = submission?.status === 'rejected'

  const handleTileClick = () => {
    if (isFree) return
    if (submission) {
      setShowOptions(true)
    } else {
      fileRef.current?.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !task) return
    e.target.value = ''
    setUploading(true)
    setShowOptions(false)
    try {
      const url = await uploadImage(participantId, task.id, file)
      await upsertSubmission(participantId, task.id, url)
      onUpdate()
    } catch (err) {
      console.error('Upload failed', err)
      alert('照片上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const handleReset = async () => {
    if (!task) return
    setShowOptions(false)
    await deleteSubmission(participantId, task.id)
    setPreview(null)
    onUpdate()
  }

  if (isFree) {
    return (
      <motion.div
        className={`aspect-square rounded-2xl orange-gradient flex items-center justify-center relative overflow-hidden tile-shadow p-2 ${isHighlighted ? 'ring-4 ring-green-400' : ''}`}
        whileTap={{ scale: 0.95 }}
      >
        <img src="/logo.jpeg" alt="Free" className="w-full h-full object-contain" />
        {isHighlighted && (
          <motion.div
            className="absolute inset-0 bg-green-400/20 rounded-2xl"
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </motion.div>
    )
  }

  const imgSrc = preview || submission?.image_url

  return (
    <>
      <motion.button
        onClick={handleTileClick}
        disabled={uploading}
        className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center p-2 relative overflow-hidden tile-shadow transition-all ${
          isRejected
            ? 'border-red-400 bg-red-50'
            : isApproved
              ? 'border-green-400 bg-green-50'
              : isPending
                ? 'border-orange-400 bg-orange-50'
                : isDraft
                  ? 'border-slate-300 bg-slate-50'
                  : 'border-amber-100 bg-white/70 hover:border-amber-300'
        } ${isHighlighted ? 'ring-4 ring-green-400' : ''}`}
        whileTap={{ scale: 0.94 }}
      >
        {/* Background image */}
        {imgSrc && (
          <img
            src={imgSrc}
            alt={task?.title}
            className="absolute inset-0 w-full h-full object-cover opacity-30 rounded-2xl"
          />
        )}

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-1 text-center">
          <span className="text-2xl leading-none">{task?.icon || '📷'}</span>
          <span className="text-xs font-semibold text-amber-800 leading-tight line-clamp-2">
            {task?.title}
          </span>
          {uploading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
            >
              <RefreshCw size={14} className="text-amber-500 mt-1" />
            </motion.div>
          ) : isRejected ? (
            <XCircle size={14} className="text-red-500 mt-1" />
          ) : isApproved ? (
            <CheckCircle size={14} className="text-green-500 mt-1" />
          ) : isPending ? (
            <CheckCircle size={14} className="text-orange-500 mt-1" />
          ) : isDraft ? (
            <Camera size={14} className="text-slate-400 mt-1" />
          ) : (
            <Camera size={14} className="text-amber-300 mt-1" />
          )}
        </div>

        {/* Pending badge */}
        {isPending && (
          <span className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-[9px] rounded-full px-1.5 py-0.5 font-bold">
            待审
          </span>
        )}

        {/* Refresh/edit affordance — tapping the tile re-opens edit/reset options */}
        {submission && !uploading && (
          <span className="absolute bottom-1 right-1 z-10 bg-white/90 rounded-full p-1 shadow-sm">
            <RefreshCw size={12} className="text-amber-600" />
          </span>
        )}

        {isHighlighted && (
          <motion.div
            className="absolute inset-0 bg-green-400/20 rounded-2xl"
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </motion.button>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Options modal */}
      <AnimatePresence>
        {showOptions && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50"
            onClick={() => setShowOptions(false)}
          >
            <motion.div
              className="bg-white rounded-t-3xl p-6 w-full max-w-sm safe-bottom"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-amber-900">{task?.title}</h3>
                <button onClick={() => setShowOptions(false)}>
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
              {imgSrc && (
                <img src={imgSrc} alt="" className="w-full h-40 object-cover rounded-2xl mb-4" />
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowOptions(false); fileRef.current?.click() }}
                  className="flex-1 orange-gradient text-white rounded-2xl py-3 font-bold"
                >
                  重新上传
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 border-2 border-red-200 text-red-500 rounded-2xl py-3 font-medium"
                >
                  清除照片
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
