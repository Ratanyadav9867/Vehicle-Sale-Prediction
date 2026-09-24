import React from 'react';
import { Download } from 'lucide-react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { InstallIOSModal } from './InstallIOSModal';

export interface InstallAppButtonProps {
  variant?: 'hero' | 'drawer';
  className?: string;
  onInstalledClick?: () => void;
}

export const InstallAppButton: React.FC<InstallAppButtonProps> = ({
  variant = 'hero',
  className = '',
  onInstalledClick,
}) => {
  const { canInstall, isInstalled, showIOSModal, setShowIOSModal, promptInstall } = useInstallPrompt();

  // If already installed or unsupported browser (cannot install and not iOS Safari), hide completely
  if (isInstalled || !canInstall) {
    return null;
  }

  const handleClick = async () => {
    onInstalledClick?.();
    await promptInstall();
  };

  const buttonContent = (
    <>
      <Download className={variant === 'hero' ? 'w-4 h-4 text-sky-400' : 'w-5 h-5 text-sky-400 shrink-0'} />
      <span>Install App</span>
    </>
  );

  return (
    <>
      {variant === 'hero' ? (
        <button
          onClick={handleClick}
          type="button"
          className={`px-6 py-3.5 rounded-xl font-semibold text-sm text-gray-200 bg-white/10 hover:bg-white/15 border border-white/10 hover:text-white transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center gap-2 ${className}`}
        >
          {buttonContent}
        </button>
      ) : (
        <button
          onClick={handleClick}
          type="button"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 border border-sky-500/20 transition-colors cursor-pointer ${className}`}
        >
          {buttonContent}
        </button>
      )}

      {/* iOS Safari instruction modal */}
      <InstallIOSModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
    </>
  );
};

export default InstallAppButton;
