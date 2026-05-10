'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'

export { motion, AnimatePresence } from 'framer-motion'

export function FadeIn({
  children,
  className,
  delay = 0,
  ...props
}: HTMLMotionProps<'div'> & { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}
