"use client";
import * as React from 'react';
import {
  Modal as CanonicalModal,
  ModalBody,
  ModalFooter,
  ModalHeader as CanonicalModalHeader,
} from '../components/ui/Modal';

export { ModalBody, ModalFooter };

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  titleId?: string;
  closeDisabled?: boolean;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
  children: React.ReactNode;
}

export function Modal({ titleId = 'modal-title', ...props }: ModalProps) {
  return <CanonicalModal {...props} titleId={titleId} />;
}

export interface ModalHeaderProps {
  titleId?: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  closeDisabled?: boolean;
  children?: React.ReactNode;
}

export function ModalHeader({
  titleId = 'modal-title',
  title,
  subtitle,
  icon,
  onClose,
  closeDisabled,
  children,
}: ModalHeaderProps) {
  if (title || subtitle || icon || onClose) {
    return (
      <CanonicalModalHeader
        titleId={titleId}
        title={title ?? ''}
        subtitle={subtitle}
        icon={icon}
        onClose={onClose ?? (() => {})}
        closeDisabled={closeDisabled}
      />
    );
  }
  return <div id={titleId} className="shrink-0 border-b border-border pb-3">{children}</div>;
}
