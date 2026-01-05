import { useState, useEffect, useCallback, useRef } from 'react'
import { decodeAndVerifyJWT } from '@starter/shared'
import { IrlOnboarding } from 'irl-browser-onboarding/react'
import { QRCodePanel } from './components/QRCodePanel'
import { AdminSection } from './components/AdminSection'
import { Avatar } from './components/Avatar'

// TypeScript declarations for IRL Browser API
declare global {
  interface Window {
    irlBrowser?: {
      getProfileDetails(): Promise<string>;
      getAvatar(): Promise<string | null>;
      getBrowserDetails(): {
        name: string;
        version: string;
        platform: 'ios' | 'android' | 'browser';
        supportedPermissions: string[];
      };
      requestPermission(permission: string): Promise<boolean>;
      close(): void;
    };
  }
}

interface User {
  did: string
  name: string
  avatar?: string
  socials?: Array<{ platform: string; handle: string }>
  isAdmin: boolean
}

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Handler for when onboarding completes - now window.irlBrowser is available
  const handleOnboardingComplete = useCallback(() => {
    setIsOnboardingModalOpen(false)
    setNeedsOnboarding(false)
    loadUser()
    loadAvatar()
  }, [])

  useEffect(() => {
    // Check if window.irlBrowser is available
    const hasIrlBrowser = !!window.irlBrowser
    setNeedsOnboarding(!hasIrlBrowser)

    if (hasIrlBrowser) {
      loadUser()
      loadAvatar()
    } else {
      setLoading(false)
    }
  }, [])

  const getProfileJwt = async (): Promise<string | undefined> => {
    if (!window.irlBrowser) return undefined
    return await window.irlBrowser.getProfileDetails()
  }

  const loadUser = async () => {
    try {
      if (!window.irlBrowser) {
        setLoading(false)
        return
      }

      // Get profile details JWT
      const profileJwt = await window.irlBrowser.getProfileDetails()

      // Add user to database and get user with isAdmin
      const user = await addUserToDatabase(profileJwt)
      setUser(prev => prev ? { ...prev, ...user } : user)

      setLoading(false)
    } catch (err) {
      console.error('Error loading profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profile')
      setLoading(false)
    }
  }

  const loadAvatar = async () => {
    try {
      if (!window.irlBrowser) return

      const avatarJWT = await window.irlBrowser.getAvatar()
      if (!avatarJWT) return

      await addAvatarToDatabase(avatarJWT)

      // Decode avatar JWT and update user
      const avatarPayload = await decodeAndVerifyJWT(avatarJWT)
      if (avatarPayload?.data) {
        const { avatar } = avatarPayload.data as { avatar: string }
        setUser(prev => prev ? { ...prev, avatar } : null)
      }
    } catch (err) {
      console.error('Error loading avatar:', err)
    }
  }

  const addUserToDatabase = async (profileJwt: string): Promise<User> => {
    const response = await fetch('/api/add-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileJwt }),
    })
    if (!response.ok) {
      throw new Error('Failed to add user')
    }
    return response.json()
  }

  const addAvatarToDatabase = async (avatarJwt: string) => {
    try {
      const response = await fetch('/api/add-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarJwt }),
      })
      if (!response.ok) {
        throw new Error('Failed to add avatar')
      }
    } catch (err) {
      console.error('Error adding avatar to database:', err)
    }
  }

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!user) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/ws`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'reset') {
          setResetMessage(data.data.message)
          // Non-admins are removed from DB, clear their user state
          if (!user.isAdmin) {
            setUser(null)
          }
        }
      } catch (err) {
        console.error('WebSocket message error:', err)
      }
    }

    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [user?.did, user?.isAdmin])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="grid md:grid-cols-2 min-h-screen">
          <QRCodePanel />
          <div className="flex items-center justify-center px-4">
            <div className="text-gray-500">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="grid md:grid-cols-2 min-h-screen">
          <QRCodePanel />
          <div className="flex items-center justify-center px-4">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-6">⚠️</div>
              <h1 className="text-3xl font-bold mb-4 text-gray-800">Error</h1>
              <p className="text-gray-600">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main view with profile
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="grid md:grid-cols-2 min-h-screen">
        <QRCodePanel />
        <div className="flex px-4 py-8">
          <div className="w-full max-w-md mx-auto">
            {/* User Card */}
            {user && (
              <div className="bg-white rounded-lg shadow-lg p-6 text-center mb-6">
                <Avatar avatar={user.avatar} name={user.name} />
                <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                <p className="text-gray-500 text-sm mt-1 truncate">{user.did}</p>
              </div>
            )}

            {/* "Add yourself" button - only show on mobile */}
            <button
              onClick={() => setIsOnboardingModalOpen(true)}
              className="w-full bg-[#403B51] text-white px-8 py-4 rounded-full shadow-lg hover:bg-[#322d40] transition-all hover:scale-105 font-semibold text-lg z-40 md:hidden"
            >
              Add yourself
            </button>

            {/* Admin Section - only show if user is admin */}
            {user?.isAdmin && (
              <AdminSection
                getProfileJwt={getProfileJwt}
                onReset={() => {}}
              />
            )}
          </div>
        </div>
      </div>

      {/* Onboarding modal */}
      {isOnboardingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsOnboardingModalOpen(false)}
            />
            <div className="relative z-10 w-full max-w-lg mx-4 max-h-[90vh] overflow-auto rounded-2xl shadow-2xl">
              <IrlOnboarding
                mode="choice"
                onComplete={handleOnboardingComplete}
                customStyles={{ primaryColor: '#403B51' }}
              />
            </div>
          </div>
        )}

      {/* Reset Modal */}
      {resetMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative z-10 bg-white rounded-lg shadow-xl p-8 max-w-md mx-4 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Event Reset</h2>
            <p className="text-gray-600">{resetMessage}</p>
            <button
              onClick={() => setResetMessage(null)}
              className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
