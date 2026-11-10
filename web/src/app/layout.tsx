import type { Metadata } from "next";
import "@fontsource-variable/cairo";
import "./globals.css";
import "./modular.css";
import "./design-v2.css";
import NavigationFeedback from "@/components/NavigationFeedback";
import DemoDataCleanup from "@/components/DemoDataCleanup";
import ThemeBootstrap from "@/components/ThemeBootstrap";
import AdminSessionGuard from "@/components/AdminSessionGuard";
import ServiceAvailabilityGuard from "@/components/ServiceAvailabilityGuard";
import { LiveRefreshProvider } from "@/lib/live-refresh";
import { Toaster } from "sonner";
export const metadata: Metadata = {
  title: "طريقك | لوحة التحكم",
  description: "لوحة تحكم منصة طريقك للبلاغات المجتمعية",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Toaster dir="rtl" position="top-center" richColors closeButton duration={6500} />
        <ThemeBootstrap />
        <LiveRefreshProvider />
        <AdminSessionGuard />
        <DemoDataCleanup />
        <ServiceAvailabilityGuard>
          <NavigationFeedback>{children}</NavigationFeedback>
        </ServiceAvailabilityGuard>
      </body>
    </html>
  );
}
