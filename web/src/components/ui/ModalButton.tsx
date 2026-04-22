"use client";

import { Modal } from "@/components/ui/Modal";
import {
  type ReactElement,
  cloneElement,
  isValidElement,
  useState,
} from "react";

interface ModalButtonProps {
  label: string;
  title: string;
  children: ReactElement<{ onSuccess?: () => void }>;
  variant?: "primary" | "secondary";
}

export function ModalButton({
  label,
  title,
  children,
  variant = "primary",
}: ModalButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const buttonClass =
    variant === "primary"
      ? "px-4 py-2 text-sm bg-white text-black font-medium hover:bg-[#ddd] transition-colors min-w-[140px] cursor-pointer"
      : "px-4 py-2 text-sm border border-[#333] text-[#888] hover:border-white hover:text-white transition-colors min-w-[140px] cursor-pointer";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={buttonClass}
      >
        {label}
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={title}>
        {isValidElement(children)
          ? cloneElement(children, { onSuccess: () => setIsOpen(false) })
          : children}
      </Modal>
    </>
  );
}
