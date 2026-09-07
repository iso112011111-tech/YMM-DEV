"use client";

import { useEffect, useCallback } from "react";
import { type BotConfig } from "@/data/siteData";

interface GuideModalProps {
  bot: BotConfig;
  isOpen: boolean;
  onClose: () => void;
}

export default function GuideModal({ bot, isOpen, onClose }: GuideModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="guide-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="guide-close"
          type="button"
          aria-label="ปิดวิธีการใช้งาน"
          onClick={onClose}
        >
          ×
        </button>
        <p className="guide-kicker">YMM-DEV / QUICK START</p>
        <h2 id="guide-title">วิธีการใช้งาน {bot.name}</h2>
        <p className="guide-intro">
          เพิ่ม {bot.name} เข้าเซิร์ฟเวอร์ของคุณ แล้วเริ่มใช้งานได้ในไม่กี่ขั้นตอน
        </p>

        <ol className="guide-steps">
          {bot.guideSteps.map((step) => (
            <li key={step.step}>
              <span>{step.step}</span>
              <div>
                <b>{step.title}</b>
                <small>
                  {step.detail}
                  {step.codeSnippet && (
                    <>
                      {" "}
                      <code>{step.codeSnippet}</code>
                    </>
                  )}
                </small>
              </div>
            </li>
          ))}
        </ol>

        <a
          className="discord-button guide-action"
          href={bot.inviteUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>◉</span> เพิ่มบอทตอนนี้ <b>→</b>
        </a>
      </section>
    </div>
  );
}
