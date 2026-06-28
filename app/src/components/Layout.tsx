import { useState, useEffect, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './Sidebar'
import GlobalSearch from './GlobalSearch'
import ToastContainer from './Toast'
import NotificationDrawer from './NotificationDrawer'
import { ContextMenuProvider } from './ContextMenu'

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-4 h-4 border border-txt-3 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
}

const pageTransition = { duration: 0.13, ease: [0.4, 0, 0.2, 1] as const }

export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <ContextMenuProvider>
      <div className="flex flex-row h-screen overflow-hidden bg-bg text-txt font-sans">
        <Sidebar onOpenSearch={() => setSearchOpen(true)} onOpenNotif={() => setNotifOpen(true)} />

        {/*
          main is overflow-hidden + relative so the motion.div can be
          absolute-inset, moving the scroll context inside the animated wrapper.
          This lets AnimatePresence properly unmount exiting pages.
        */}
        <main className="flex-1 overflow-hidden min-w-0 relative">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="absolute inset-0 overflow-y-auto"
            >
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
        {notifOpen  && <NotificationDrawer onClose={() => setNotifOpen(false)} />}
        <ToastContainer />
      </div>
    </ContextMenuProvider>
  )
}
