import {
  MonitorSmartphone,
  Library,
  History,
  Settings,
  LogIn,
  LogOut,
  User,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import syncflowLogo from '@renderer/assets/syncflow-mark-transparent.png';
import { LoginDialog } from '@renderer/components/shared/LoginDialog';
import { useAppStore, type AppView } from '@renderer/stores/app-store';
import { useAuthStore } from '@renderer/stores/auth-store';
import { useSettingsStore } from '@renderer/stores/settings-store';
import { getProductName } from '../../../shared/market';

const navItems: { key: AppView; labelKey: string; icon: typeof MonitorSmartphone }[] = [
  { key: 'dashboard', labelKey: 'layout.nav.dashboard', icon: Library }, // using Library or custom icon
  { key: 'devices', labelKey: 'layout.nav.devices', icon: MonitorSmartphone },
  { key: 'library', labelKey: 'layout.nav.library', icon: Library },
  { key: 'records', labelKey: 'layout.nav.records', icon: History },
  { key: 'settings', labelKey: 'layout.nav.settings', icon: Settings },
];

const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;
const activeNavStyle = {
  background: 'rgba(242,238,255,0.8)',
  boxShadow: '0 8px 24px rgba(126,116,190,0.08)',
  border: '1px solid rgba(216,210,255,0.5)',
  WebkitAppRegion: 'no-drag',
} as CSSProperties;

export function Sidebar() {
  const { t } = useTranslation();
  const currentView = useAppStore((s) => s.currentView);
  const setView = useAppStore((s) => s.setView);
  const session = useAuthStore((s) => s.session);
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const logout = useAuthStore((s) => s.logout);
  const deviceName = useSettingsStore((s) => s.settings.deviceName);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void refreshSession().finally(() => {
      if (active) {
        setAuthInitialized(true);
      }
    });
    return () => {
      active = false;
    };
  }, [refreshSession]);

  const handleLoginSuccess = useCallback(() => {
    void refreshSession();
  }, [refreshSession]);

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

  const accountIdentifier =
    session?.phone?.trim() || session?.email?.trim() || session?.accountLabel?.trim();
  const accountLabel = accountIdentifier || t('layout.account.connected');

  return (
    <>
      <aside
        className="z-10 flex w-[238px] shrink-0 flex-col pt-6 m-3 mr-0 rounded-2xl border border-white/75 shadow-[0_20px_50px_rgba(70,96,138,0.08)]"
        style={{
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5" style={dragRegionStyle}>
          <img
            src={syncflowLogo}
            alt={getProductName()}
            draggable={false}
            className="h-7 w-auto object-contain"
          />
          <span className="text-[15px] font-semibold leading-none" style={{ color: '#17191c' }}>
            {getProductName().replace(' ', '')}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
          {navItems.map(({ key, labelKey, icon: Icon }) => {
            const active =
              currentView === key || (key === 'dashboard' && currentView === 'device-detail');
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-[color,background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.985] focus-visible:outline-none ${
                  active ? 'text-[#534b71]' : 'text-[#626d7c] hover:bg-white/60 hover:text-[#17191c]'
                }`}
                style={active ? activeNavStyle : noDragRegionStyle}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 transition-colors ${active ? 'text-[#746aa8]' : 'text-[#858b96]'}`} />
                <span>{t(labelKey)}</span>
              </button>
            );
          })}
        </nav>

        {/* User Account / Profile at bottom */}
        {authInitialized ? (
          <div className="px-3 pb-4" style={noDragRegionStyle}>
            {session ? (
              <div className="flex w-full items-center gap-2.5 rounded-xl border border-[#bae0ff]/40 bg-[#e6f4ff]/40 p-2.5 text-left shadow-[0_2px_8px_rgba(186,224,255,0.06)]">
                <div className="relative h-8 w-8 shrink-0 rounded-full bg-gradient-to-tr from-[#91caff] to-[#bae7ff] flex items-center justify-center font-bold text-xs text-[#0050b3] border border-white/60 shadow-[0_2px_6px_rgba(0,80,179,0.08)]">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] font-bold leading-none text-slate-800">
                      {deviceName || 'macOS'}
                    </span>
                    <ShieldCheck className="h-3.5 w-3.5 text-[#52c41a] shrink-0" />
                  </div>
                  <p className="mt-0.5 truncate text-[10px] leading-tight text-[#0050b3]" title={accountLabel}>
                    {accountLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/80 hover:text-rose-500 transition-colors"
                  title={t('layout.account.logout')}
                  aria-label={t('layout.account.logout')}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-white/60 bg-white/45 p-3 shadow-[0_2px_8px_rgba(100,100,100,0.04)]">
                <div className="mb-2 flex items-start gap-2">
                  <LogIn className="mt-0.5 h-4 w-4 shrink-0 text-[#746aa8]" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1a2a3a]">
                      {t('layout.account.promptTitle')}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-4 text-[#626d7c]">
                      {t('layout.account.dialogDescription')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#746aa8] px-3 text-xs font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[#5f5592] active:scale-[0.985] focus-visible:outline-none"
                  onClick={() => setLoginDialogOpen(true)}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {t('layout.account.login')}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </aside>

      <LoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
        onLoginSuccess={handleLoginSuccess}
        title={t('layout.account.dialogTitle')}
        description={t('layout.account.dialogDescription')}
      />
    </>
  );
}
