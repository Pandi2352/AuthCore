import {
  Activity,
  Bell,
  Building2,
  CircleHelp,
  ExternalLink,
  FileText,
  FolderTree,
  HardDrive,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListTree,
  Lock,
  MailPlus,
  Monitor,
  MonitorSmartphone,
  Moon,
  Palette,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icons that configs may reference by name (navigation, navbar actions).
 * Configs stay plain data; components look the name up here. Add an icon:
 * import it above and add it to the map — `IconName` updates automatically.
 */
export const icons = {
  Activity,
  Bell,
  Building2,
  CircleHelp,
  ExternalLink,
  FileText,
  FolderTree,
  HardDrive,
  History,
  KeyRound,
  LayoutDashboard,
  Layers,
  ListTree,
  Lock,
  MailPlus,
  Monitor,
  MonitorSmartphone,
  Moon,
  Palette,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserPlus,
  UserRound,
  Users,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export const isIconName = (value: string): value is IconName => Object.hasOwn(icons, value);
