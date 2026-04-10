import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/context/LanguageContext";
import { DirectionWrapper } from "@/components/DirectionWrapper";
import { AuthProvider } from "@/lib/context/AuthProvider";
import { SpeedInsights } from '@vercel/speed-insights/next'

const RubikFont = Rubik({
  subsets: ["latin"],
  variable: "--font-rubik",
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Swipyeat - Restaurant Management",
  description: "Manage your restaurant seamlessly with Swipyeat's intuitive platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || `${process.env.NEXT_PUBLIC_LANDING_URL}/sign-in`}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || `${process.env.NEXT_PUBLIC_LANDING_URL}/sign-up`}
    >
      <html lang="en">
        <body
          className={`${RubikFont.variable} antialiased`}
        >
          <SpeedInsights />
          <AuthProvider>
            <LanguageProvider>
              <DirectionWrapper>
                {children}
              </DirectionWrapper>
            </LanguageProvider>
          </AuthProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
