import {
  HardDrive,
  Smartphone,
  FolderOpen,
  History,
  Settings,
  LogOut,
  User,
  Crown,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import vividropLogo from '@renderer/assets/vividrop-logo-cutout.png';
import { useAppStore, type AppView } from '@renderer/stores/app-store';
import { useAuthStore } from '@renderer/stores/auth-store';
import { useSettingsStore } from '@renderer/stores/settings-store';
import { getProductName } from '../../../shared/market';
import { LogoutConfirmDialog } from '@renderer/components/shared/LogoutConfirmDialog';

const navItems: { key: AppView; labelKey: string; icon: LucideIcon }[] = [
  { key: 'dashboard', labelKey: 'layout.nav.dashboard', icon: HardDrive },
  { key: 'devices', labelKey: 'layout.nav.devices', icon: Smartphone },
  { key: 'library', labelKey: 'layout.nav.library', icon: FolderOpen },
  { key: 'records', labelKey: 'layout.nav.records', icon: History },
  { key: 'settings', labelKey: 'layout.nav.settings', icon: Settings },
];

const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;
const activeNavStyle = {
  background: 'rgba(238,234,255,0.7)',
  boxShadow: '0 12px 28px rgba(126,116,190,0.12)',
  border: '1px solid rgba(216,210,255,0.6)',
  WebkitAppRegion: 'no-drag',
} as CSSProperties;

export function Sidebar() {
  const { t } = useTranslation();
  const currentView = useAppStore((s) => s.currentView);
  const setView = useAppStore((s) => s.setView);
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const deviceName = useSettingsStore((s) => s.settings.deviceName);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = useCallback(() => {
    setShowLogoutConfirm(true);
  }, []);

  const handleConfirmLogout = useCallback(() => {
    setShowLogoutConfirm(false);
    void logout();
  }, [logout]);

  const accountIdentifier =
    session?.phone?.trim() || session?.email?.trim() || session?.accountLabel?.trim();
  const accountLabel = accountIdentifier || t('layout.account.connected');

  return (
    <aside
      className="z-10 m-3 mr-0 flex w-[238px] shrink-0 flex-col rounded-lg border border-white/70 shadow-[0_24px_70px_rgba(70,96,138,0.14)]"
      style={{
        background: 'rgba(255,255,255,0.52)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5" style={dragRegionStyle}>
        <img
          src={vividropLogo}
          alt={getProductName()}
          draggable={false}
          className="h-7 w-auto object-contain"
        />
        <span className="text-[15px] font-semibold leading-none" style={{ color: '#17191c' }}>
          {getProductName().replace(' ', '')}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-5">
        {navItems.map(({ key, labelKey, icon: Icon }) => {
          const active =
            currentView === key || (key === 'dashboard' && currentView === 'device-detail');
          return (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-[color,background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.985] focus-visible:outline-none ${
                active ? 'text-[#534b71]' : 'text-[#626d7c] hover:bg-white/60 hover:text-[#17191c]'
              }`}
              style={active ? activeNavStyle : noDragRegionStyle}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${active ? 'text-[#746aa8]' : 'text-[#858b96]'}`}
              />
              <span>{t(labelKey)}</span>
            </button>
          );
        })}
      </nav>

      {/* User Account / Profile at bottom */}
      {session ? (
        <div className="px-3 pb-4" style={noDragRegionStyle}>
          <div className="group relative flex w-full items-center gap-2.5 rounded-lg border border-[#b8dfff] bg-[#e4f5ff] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_14px_34px_rgba(38,128,190,0.12)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3fbff] text-[#1b78c2] ring-1 ring-white/80">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-[13px] font-semibold leading-tight text-[#1d5f93]">
                  {deviceName || 'macOS'}
                </span>
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/82 text-[#1b78c2] shadow-[0_4px_10px_rgba(38,128,190,0.14)] ring-1 ring-white/90"
                  aria-label="商务会员"
                  title="商务会员"
                >
                  <Crown className="h-2.5 w-2.5" />
                </span>
              </div>
              <p
                className="mt-0.5 truncate text-[12px] leading-tight text-[#327db3]"
                title={accountLabel}
              >
                {accountLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/80 hover:text-rose-500"
              title={t('layout.account.logout')}
              aria-label={t('layout.account.logout')}
            >
              <LogOut className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      ) : null}

      <LogoutConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        accountLabel={accountLabel}
      />
    </aside>
  );
}
