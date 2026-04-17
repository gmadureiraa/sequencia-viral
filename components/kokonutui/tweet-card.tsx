"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TweetReply {
  authorName: string;
  authorHandle: string;
  content: string;
  avatarUrl?: string;
}

export interface TweetCardProps {
  authorName: string;
  authorHandle: string;
  content: string[];
  avatarUrl?: string;
  reply?: TweetReply;
  className?: string;
}

function Avatar({ src, name }: { src?: string; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        className="h-10 w-10 rounded-full border border-black/[0.06] object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8534] to-[#EC6000] text-sm font-bold text-white">
      {name.charAt(0)}
    </div>
  );
}

export function TweetCard({
  authorName,
  authorHandle,
  content,
  avatarUrl,
  reply,
  className,
}: TweetCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.5 }}
      className={cn(
        "rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(10,10,10,0.04),0_12px_30px_-8px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar src={avatarUrl} name={authorName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-bold text-neutral-900">
              {authorName}
            </span>
            <span className="text-[13px] text-neutral-500">
              @{authorHandle}
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            {content.map((line, i) => (
              <p key={i} className="text-[14px] leading-relaxed text-neutral-800">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {reply && (
        <div className="mt-4 ml-12 rounded-2xl border border-black/[0.06] bg-neutral-50 p-4">
          <div className="flex items-start gap-2.5">
            <Avatar src={reply.avatarUrl} name={reply.authorName} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-neutral-900">
                  {reply.authorName}
                </span>
                <span className="text-[12px] text-neutral-500">
                  @{reply.authorHandle}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-700">
                {reply.content}
              </p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
