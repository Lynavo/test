import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { Button } from '@renderer/components/ui/button';

interface LogoutConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  accountLabel: string;
}

export function LogoutConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  accountLabel,
}: LogoutConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[380px] border border-white/80 bg-white/95 p-6 shadow-2xl backdrop-blur-xl rounded-2xl">
        <DialogHeader className="text-left space-y-2">
          <DialogTitle className="text-lg font-semibold text-[#17191c]">
            {t('layout.account.logoutConfirmTitle', { defaultValue: '退出登录' })}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#5c6470] leading-relaxed">
            {t('layout.account.logoutConfirmDescription', {
              account: accountLabel,
              defaultValue: `确定要退出当前账号 ${accountLabel} 吗？退出后需重新登录才能使用同步功能。`,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex flex-row justify-end gap-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-full border-dashed border-warning text-warning hover:bg-warning/10 transition-colors"
          >
            {t('layout.account.logoutConfirmCancel', { defaultValue: '取消' })}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            className="rounded-full bg-destructive text-white hover:bg-destructive/90 transition-colors"
          >
            {t('layout.account.logoutConfirmOk', { defaultValue: '确认退出' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
