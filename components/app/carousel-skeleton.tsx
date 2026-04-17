"use client";

import { motion } from "framer-motion";

function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className="card-offset overflow-hidden"
    >
      {/* Thumbnail area */}
      <div className="h-44 bg-[#FFF6EC] border-b border-[#0A0A0A]/10 flex items-center justify-center gap-2 px-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="skeleton rounded-lg"
            style={{ width: 80, height: 80 }}
          />
        ))}
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Date + slide count */}
        <div className="skeleton h-3 w-32" />
        {/* Title */}
        <div className="skeleton h-7 w-3/4" />
        {/* Actions */}
        <div className="pt-4 border-t border-[#0A0A0A]/10 flex items-center gap-2">
          <div className="skeleton h-8 w-20 rounded-lg" />
          <div className="skeleton h-8 w-20 rounded-lg" />
          <div className="skeleton h-8 w-16 rounded-lg" />
        </div>
      </div>
    </motion.div>
  );
}

export function CarouselListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} index={i} />
      ))}
    </div>
  );
}
