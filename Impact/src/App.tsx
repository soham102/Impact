import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { PublicOnly, RequireAuth, RequireProfile } from '@/components/Guards'
import { FeedSkeleton, FullPageLoader } from '@/components/Skeletons'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from '@/pages/AuthPages'
import ForYouPage from '@/pages/ForYouPage'

const ArticlePage = lazy(() => import('@/pages/ArticlePage'))
const ExplorePage = lazy(() => import('@/pages/ExplorePage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const SavedPage = lazy(() => import('@/pages/SavedPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))

const page = (el: ReactNode) => <Suspense fallback={<FeedSkeleton count={2} />}>{el}</Suspense>

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
      {/* Reached from the recovery email; Supabase signs the user in with a recovery session. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/onboarding" element={<RequireAuth><Suspense fallback={<FullPageLoader />}><OnboardingPage /></Suspense></RequireAuth>} />

      <Route
        element={
          <RequireAuth>
            <RequireProfile>
              <AppLayout />
            </RequireProfile>
          </RequireAuth>
        }
      >
        <Route index element={<ForYouPage />} />
        <Route path="explore" element={page(<ExplorePage />)} />
        <Route path="search" element={page(<SearchPage />)} />
        <Route path="saved" element={page(<SavedPage />)} />
        <Route path="profile" element={page(<ProfilePage />)} />
        <Route path="article/:id" element={page(<ArticlePage />)} />
        <Route path="*" element={page(<NotFoundPage />)} />
      </Route>
    </Routes>
  )
}
