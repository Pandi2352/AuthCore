import { ThemeCustomizer } from '@/components/common/ThemeCustomizer';
import { Card } from '@/components/ui';

export function AppearanceSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Appearance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how the application looks on this device.
        </p>
      </div>
      <Card>
        <ThemeCustomizer />
      </Card>
    </div>
  );
}
