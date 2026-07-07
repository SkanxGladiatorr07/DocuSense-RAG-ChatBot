import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const Profile = () => {
  const { user, token, updateUser } = useAuth()
  const navigate = useNavigate()

  // Form state
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [isEmployed, setIsEmployed] = useState(false)
  const [company, setCompany] = useState('')

  // UI state
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showEmail, setShowEmail] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  // Pre-populate fields from user context
  useEffect(() => {
    if (user) {
      setDateOfBirth(
        user.dateOfBirth
          ? new Date(user.dateOfBirth).toISOString().split('T')[0]
          : ''
      )
      setIsEmployed(user.isEmployed || false)
      setCompany(user.company || '')
    }
  }, [user])

  // Compute initials
  const getInitials = () => {
    if (!user?.name) return 'U'
    const parts = user.name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return user.name.slice(0, 2).toUpperCase()
  }

  // Compute member since
  const getMemberSince = () => {
    if (!user?.createdAt) return '—'
    return new Date(user.createdAt).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  // Compute age from DOB
  const getAge = () => {
    if (!dateOfBirth) return null
    const today = new Date()
    const dob = new Date(dateOfBirth)
    let age = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
    return age >= 0 ? age : null
  }

  // Email masking utility
  const maskEmail = (email) => {
    if (!email) return '—'
    const [localPart, domain] = email.split('@')
    if (!domain) return email
    if (localPart.length <= 2) {
      return `${localPart}*****@${domain}`
    }
    return `${localPart.slice(0, 2)}*****@${domain}`
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    setSaved(false)
    try {
      const payload = {
        isEmployed,
        dateOfBirth: dateOfBirth || null,
        company: isEmployed ? company : null,
      }
      const res = await api.patch('/auth/profile', payload)
      const updatedUser = res.data?.data?.user || res.data?.user
      if (updatedUser) updateUser(updatedUser)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const age = getAge()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9ff] via-[#eef1fb] to-[#e8edf9] pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto animate-fade-in-up">

        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-6 font-medium text-[14px] group"
        >
          <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
          Back to Dashboard
        </button>

        {/* Profile Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-outline-variant/50 overflow-hidden">

          {/* Header Banner */}
          <div className="h-28 bg-gradient-to-r from-primary via-[#6366f1] to-[#8b5cf6] relative">
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 40%)'
            }} />
          </div>

          {/* Avatar + Name */}
          <div className="px-8 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5 mb-6 relative z-10">
              <div className="w-24 h-24 -mt-12 rounded-2xl bg-gradient-to-br from-primary to-[#6366f1] shadow-lg border-4 border-white flex items-center justify-center shrink-0">
                <span className="text-[32px] font-black text-white tracking-tight">{getInitials()}</span>
              </div>
              <div className="mb-2">
                <h1 className="text-[22px] font-black text-on-surface leading-tight">{user?.name || 'Your Name'}</h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold mt-1 ${
                  user?.role === 'admin'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-primary-fixed text-primary'
                }`}>
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {user?.role === 'admin' ? 'admin_panel_settings' : 'badge'}
                  </span>
                  {user?.role === 'admin' ? 'Admin' : 'Member'}
                </span>
              </div>
            </div>

            {/* Info Pills */}
            <div className="flex flex-wrap gap-3 mb-8">
              <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/30">
                <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
                <span className="text-[12px] text-secondary font-medium">Member since {getMemberSince()}</span>
              </div>
              {age !== null && (
                <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/30">
                  <span className="material-symbols-outlined text-[#6366f1] text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>cake</span>
                  <span className="text-[12px] text-secondary font-medium">{age} years old</span>
                </div>
              )}
              {isEmployed && company && (
                <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/30">
                  <span className="material-symbols-outlined text-emerald-600 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>business</span>
                  <span className="text-[12px] text-secondary font-medium">{company}</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-outline-variant/40 mb-8" />

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-6">

              {/* Read-only fields */}
              <div>
                <p className="text-[11px] font-black text-outline uppercase tracking-widest mb-4">Account Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name (read-only) */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-secondary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">person</span>
                      Full Name
                    </label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container border border-outline-variant/50 cursor-not-allowed">
                      <span className="text-on-surface text-[14px] font-medium">{user?.name || '—'}</span>
                      <span className="ml-auto text-[10px] font-bold text-outline bg-surface-container-high px-2 py-0.5 rounded-full">Locked</span>
                    </div>
                  </div>

                  {/* Email (read-only) with toggle eye decryption */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-secondary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">mail</span>
                      Email Address
                    </label>
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/50">
                      <span className="text-on-surface text-[14px] font-medium truncate">
                        {showEmail ? user?.email : maskEmail(user?.email)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowEmail(prev => !prev)}
                        className="p-1 rounded-lg text-outline hover:text-primary hover:bg-surface-container-high transition-colors cursor-pointer flex items-center justify-center shrink-0"
                        title={showEmail ? "Hide email address" : "Show email address"}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showEmail ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                      <span className="ml-auto shrink-0 text-[10px] font-bold text-outline bg-surface-container-high px-2 py-0.5 rounded-full cursor-not-allowed">Locked</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable fields */}
              <div>
                <p className="text-[11px] font-black text-outline uppercase tracking-widest mb-4">Personal Details</p>
                <div className="space-y-4">

                  {/* Date of Birth */}
                  <div className="space-y-1.5">
                    <label htmlFor="dob" className="text-[12px] font-semibold text-secondary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">cake</span>
                      Date of Birth
                    </label>
                    <input
                      id="dob"
                      type="date"
                      value={dateOfBirth}
                      onChange={e => setDateOfBirth(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-white text-on-surface text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all hover:border-outline"
                    />
                    {dateOfBirth && age !== null && (
                      <p className="text-[12px] text-primary font-medium pl-1">🎂 You are {age} years old</p>
                    )}
                  </div>

                  {/* Employment Toggle */}
                  <div className="flex items-center justify-between px-4 py-4 rounded-xl border border-outline-variant bg-white hover:bg-surface-container-low/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        isEmployed ? 'bg-emerald-100' : 'bg-surface-container'
                      }`}>
                        <span className={`material-symbols-outlined text-[20px] transition-colors ${
                          isEmployed ? 'text-emerald-600' : 'text-outline'
                        }`} style={{ fontVariationSettings: "'FILL' 1" }}>work</span>
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-on-surface">Currently Employed</p>
                        <p className="text-[12px] text-secondary">{isEmployed ? 'Add your company below' : 'Toggle to add company info'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEmployed(prev => !prev)
                        if (isEmployed) setCompany('')
                      }}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                        isEmployed ? 'bg-primary' : 'bg-outline-variant'
                      }`}
                      aria-checked={isEmployed}
                      role="switch"
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
                        isEmployed ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* Company Name (only when employed) */}
                  {isEmployed && (
                    <div className="space-y-1.5 animate-fade-in">
                      <label htmlFor="company" className="text-[12px] font-semibold text-secondary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">business</span>
                        Company / Organisation
                      </label>
                      <input
                        id="company"
                        type="text"
                        value={company}
                        onChange={e => setCompany(e.target.value)}
                        placeholder="e.g. Google, Infosys, HDFC Bank..."
                        maxLength={100}
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-white text-on-surface text-[14px] placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all hover:border-outline"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] font-medium">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {error}
                </div>
              )}

              {/* Success */}
              {saved && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] font-medium animate-fade-in">
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Profile saved successfully!
                </div>
              )}

              {/* Save Button */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-[12px] text-outline italic">
                  Name and email cannot be changed here.
                </p>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-semibold text-[14px] hover:bg-on-primary-fixed-variant transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
                      Save Profile
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
