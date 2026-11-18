import {
  ArrowSquareOutIcon,
  BellIcon,
  BuildingsIcon,
  ClockCounterClockwiseIcon,
  DevicesIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  GearSixIcon,
  HardDrivesIcon,
  KeyIcon,
  ListBulletsIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  PulseIcon,
  QuestionIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  SquaresFourIcon,
  SunIcon,
  TreeStructureIcon,
  UserIcon,
  UsersThreeIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';

import type { IconName } from './icons';

/**
 * Loaded on demand (only when the icon style is not "classic") — keep it out of eager
 * imports; use useModernIcons() in app/layouts/sidebar.
 *
 * The same icons from Phosphor (MIT, 6 weights incl. duotone) for the "modern", "duotone"
 * and "color" icon styles (theme appearance.icons). Every IconName needs an entry — the
 * type check fails otherwise. Pick the closest Phosphor equivalent: https://phosphoricons.com
 */
export const modernIcons = {
  Activity: PulseIcon,
  Bell: BellIcon,
  Building2: BuildingsIcon,
  CircleHelp: QuestionIcon,
  ExternalLink: ArrowSquareOutIcon,
  FileText: FileTextIcon,
  FolderTree: TreeStructureIcon,
  HardDrive: HardDrivesIcon,
  History: ClockCounterClockwiseIcon,
  KeyRound: KeyIcon,
  LayoutDashboard: SquaresFourIcon,
  ListTree: ListBulletsIcon,
  Lock: LockSimpleIcon,
  MailPlus: EnvelopeSimpleIcon,
  Monitor: MonitorIcon,
  MonitorSmartphone: DevicesIcon,
  Moon: MoonIcon,
  Palette: PaletteIcon,
  Search: MagnifyingGlassIcon,
  Settings: GearSixIcon,
  Shield: ShieldIcon,
  ShieldCheck: ShieldCheckIcon,
  SlidersHorizontal: SlidersHorizontalIcon,
  Sun: SunIcon,
  UserRound: UserIcon,
  Users: UsersThreeIcon,
} satisfies Record<IconName, PhosphorIcon>;
