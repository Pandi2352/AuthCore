import { ThemeCustomizer } from '@/components/common/ThemeCustomizer';
import { PageContainer, PageHeader, PageSection } from '@/components/page';

export function AppearanceSettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Appearance"
        description="Choose how the application looks on this device."
      />
      <PageSection title="Theme" description="Saved in this browser.">
        <ThemeCustomizer />
      </PageSection>
    </PageContainer>
  );
}
