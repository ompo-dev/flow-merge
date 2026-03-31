import type { ReactNode } from "react";
import { X } from "lucide-react";

export function ModalPanelShell({
  title,
  subtitle,
  children,
  headerContent,
  footer,
  onClose,
  maxWidthClass = "max-w-[640px]",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  headerContent?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  maxWidthClass?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] bg-black/60 px-4 py-6"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className={`fc-panel flex max-h-[calc(100vh-3rem)] w-full ${maxWidthClass} flex-col overflow-hidden`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="space-y-3 border-b border-[#30363d] px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[#e6edf3]">{title}</div>
                <div className="text-[11px] text-[#7d8590]">{subtitle}</div>
              </div>
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[#7d8590] transition-colors hover:text-[#e6edf3]"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {headerContent}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

          {footer ? <div className="border-t border-[#30363d] px-4 py-3">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
